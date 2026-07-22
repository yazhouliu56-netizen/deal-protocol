import { getServiceClient } from "@/lib/supabase-client"
import { arbitrate, determineTier, canAutoExecute, CONFIDENCE_AUTO_EXECUTE_THRESHOLD } from "@/lib/arbitration"
import { getEngine } from "@/lib/protocol/engine"
import { appendEvidence } from '@/modules/m11-evidence-log/evidence-chain'
import { updateCredit } from "@/modules/m07-credit/credit-engine"
import { callLLM } from "@/lib/llm"
import type { DisputeTier } from "@/lib/arbitration"

interface DisputeChannel {
  maxAmount?: number
  minAmount?: number
  llmHours: number
  resolveHours: number
}

export async function resolveDispute(disputeId: string, channel: DisputeChannel): Promise<{ resolution: string; providerAmount: number; customerAmount: number }> {
  const supabase = getServiceClient()

  const { data: dispute } = await supabase
    .from('disputes')
    .select('*')
    .eq('id', disputeId)
    .single()

  if (!dispute) throw new Error("争议不存在")

  const { data: contract } = await supabase
    .from('contracts')
    .select('amount, customer_id, provider_id, terms')
    .eq('id', dispute.contract_id)
    .single()

  if (!contract) throw new Error("关联合同不存在")

  const contractAmount = contract.amount
  const evidence = dispute.evidence ?? "无证据"
  const tier = determineTier(contractAmount)

  const serviceTitle = contract.terms
    ? (() => { try { const t = JSON.parse(contract.terms); return t.title ?? "服务订单" } catch { return "服务订单" } })()
    : "服务订单"

  const verdict = await arbitrate({
    disputeId: dispute.id,
    tier,
    reason: dispute.reason,
    evidence,
    contractAmount,
    serviceTitle,
    initiatorId: dispute.initiator_id,
    responderId: dispute.initiator_id === contract.customer_id
      ? contract.provider_id
      : contract.customer_id,
  })

  // 设计方案§4.2.4: 置信度阈值检查
  // ≥0.85 → 自动生效；<0.85 → 标记为需人工复核
  const autoExecutable = canAutoExecute(verdict)
  const resolutionStatus = autoExecutable ? 'RESOLVED' : 'PENDING_REVIEW'

  const { error: disputeUpdateError } = await supabase
    .from('disputes')
    .update({
      status: resolutionStatus,
      resolution: verdict.resolution,
      tier,
      loser_id: verdict.loserId || null,
      llm_verdict: JSON.stringify({ providerAmount: verdict.providerAmount, customerAmount: verdict.customerAmount }),
      llm_confidence: verdict.confidence,
      council_results: verdict.councilVotes ? JSON.stringify(verdict.councilVotes) : null,
      ...(autoExecutable ? {} : { needs_human_review: true }),
    })
    .eq('id', dispute.id)
  if (disputeUpdateError) throw disputeUpdateError

  if (!autoExecutable) {
    // 置信度不足，标记需人工复核，不继续执行
    return {
      resolution: verdict.resolution,
      providerAmount: verdict.providerAmount,
      customerAmount: verdict.customerAmount,
    }
  }

  const { error: contractUpdateError } = await supabase
    .from('contracts')
    .update({ dispute_status: 'RESOLVED' })
    .eq('id', dispute.contract_id)
  if (contractUpdateError) throw contractUpdateError

  if (verdict.loserId) {
    try {
      const { data: loser } = await supabase
        .from('profiles')
        .select('dispute_losses')
        .eq('id', verdict.loserId)
        .single()

      await supabase
        .from('profiles')
        .update({ dispute_losses: (loser?.dispute_losses ?? 0) + 1 })
        .eq('id', verdict.loserId)
    } catch (e) {
      console.warn("resolveDispute: failed to update dispute_losses:", e)
    }

    const ev = await appendEvidence({
      eventType: 'dispute_resolved',
      payload: {
        dispute_id: dispute.id,
        loser_id: verdict.loserId,
        resolution: verdict.resolution,
      },
    })
    if (!ev) throw new Error('Failed to append evidence for dispute resolution')
    await updateCredit({ userId: verdict.loserId, eventType: 'violation', evidenceId: ev.id, description: 'Lost dispute resolution' }).catch(() => {})
  }

  return {
    resolution: verdict.resolution,
    providerAmount: verdict.providerAmount,
    customerAmount: verdict.customerAmount,
  }
}

/** 扫描所有需要 LLM 裁决的争议并自动处理 */
export async function processPendingDisputes(): Promise<string[]> {
  const results: string[] = []
  const supabase = getServiceClient()

  const { data: openDisputes } = await supabase
    .from('disputes')
    .select('id, contract_id, reason, evidence, initiator_id, created_at')
    .eq('status', 'OPEN')

  if (!openDisputes || openDisputes.length === 0) return results

  const contractIds = [...new Set(openDisputes.map(d => d.contract_id))]
  const { data: contractsMap } = await supabase
    .from('contracts')
    .select('id, amount, protocol_id, customer_id, provider_id')
    .in('id', contractIds)

  const contractById = new Map((contractsMap || []).map(c => [c.id, c]))

  for (const dispute of openDisputes) {
    const contract = contractById.get(dispute.contract_id)
    if (!contract) continue

    const engine = getEngine(contract.protocol_id)
    const channels = engine?.getDefinition().dispute.channels
    if (!channels) continue

    const amount = contract.amount
    let channel: DisputeChannel | null = null
    if (amount <= channels.green.maxAmount) {
      channel = channels.green
    } else if (channels.yellow && amount <= channels.yellow.maxAmount) {
      channel = channels.yellow
    } else {
      channel = channels.red
    }

    const elapsedHours = (Date.now() - new Date(dispute.created_at).getTime()) / (1000 * 60 * 60)
    const llmElapsed = elapsedHours >= channel.llmHours

    if (!llmElapsed) continue

    try {
      const decision = await resolveDispute(dispute.id, channel)

      const { createRefundTransactions } = await import("@/lib/contract-machine")
      await createRefundTransactions(
        dispute.contract_id,
        contract.customer_id,
        contract.provider_id,
        { provider: decision.providerAmount, customer: decision.customerAmount },
        "DISPUTE_REFUND",
      )

      const { error: contractUpdateError } = await supabase
        .from('contracts')
        .update({ fund_status: 'SETTLED' })
        .eq('id', dispute.contract_id)
      if (contractUpdateError) throw contractUpdateError

      const { error: eventError } = await supabase
        .from('contract_events')
        .insert({
          contract_id: dispute.contract_id,
          actor_id: 'ai_arbitrator',
          from_status: 'HELD',
          to_status: 'SETTLED',
          action: 'resolve_dispute',
          reason: `AI 自动裁决: ${decision.resolution}`,
        })
      if (eventError) throw eventError

      results.push(`auto_resolved: ${dispute.id} — ${decision.resolution}`)
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e)
      results.push(`auto_resolve FAILED ${dispute.id}: ${msg}`)
    }
  }

  return results
}
