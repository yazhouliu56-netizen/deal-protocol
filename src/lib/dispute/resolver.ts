import { getServiceClient } from "@/lib/supabase-client"
import { arbitrate } from "@/lib/arbitration"
import {
  appealDeadline,
  classifyEvidence,
  decideRefundTiming,
  determineTierWithPolicy,
  evaluateIssuance,
  parseVerdictEnvelope,
  resolvePolicy,
  type IssuanceVerdict,
} from "@/lib/arbitration/policy"
import type { DisputeDef } from "@/base/order/protocol-types"
// D-5 Phase E：协议定义资产归位 Base
import { getProtocol } from "@/base/order/protocol-definitions"
import { appendEvidence } from '@/modules/m11-evidence-log/evidence-chain'
import { updateCredit } from "@/modules/m07-credit/credit-engine"

interface DisputeChannel {
  maxAmount?: number
  minAmount?: number
  llmHours: number
  resolveHours: number
}

export interface DisputeResolution {
  resolution: string;
  providerAmount: number;
  customerAmount: number;
  /** ADR-0021 签发门禁结论（调用方据此决定是否划转）。 */
  issuance: IssuanceVerdict;
  /** 终裁申诉截止（毫秒时间戳；REVIEW 时为 null）。 */
  appealUntil: number | null;
}

/** contract.terms 中协议预置争议条款勾选位（ADR-0021 §三-1 前提①）。 */
function readAgreementSigned(terms: unknown): boolean {
  if (!terms) return false;
  try {
    const t = typeof terms === "string" ? JSON.parse(terms) : terms;
    return (t as Record<string, unknown>)?.arbitrationAgreement === true;
  } catch {
    return false;
  }
}

export async function resolveDispute(
  disputeId: string,
  _channel?: DisputeChannel | null,
  disputeDef?: DisputeDef | null,
): Promise<DisputeResolution> {
  const supabase = getServiceClient()

  const { data: dispute } = await supabase
    .from('disputes')
    .select('*')
    .eq('id', disputeId)
    .single()

  if (!dispute) throw new Error("争议不存在")

  const { data: contract } = await supabase
    .from('contracts')
    .select('amount, customer_id, provider_id, protocol_id, terms')
    .eq('id', dispute.contract_id)
    .single()

  if (!contract) throw new Error("关联合同不存在")

  // ADR-0021 · 宪法 #5：策略归一（弹药显式 ＞ 协议通道 ＞ 全局默认）。
  // 调用方未传 disputeDef 时按合同 protocol_id 回查（cron 路径已传参，此处兜底）。
  const def: DisputeDef | null | undefined =
    disputeDef ?? (contract.protocol_id ? getProtocol(contract.protocol_id)?.dispute ?? null : null);
  const policy = resolvePolicy(def?.channels ?? null, def?.arbitration ?? null);

  const contractAmount = contract.amount
  const evidenceState = classifyEvidence(dispute.evidence);
  const tier = determineTierWithPolicy(contractAmount, policy)
  const issuance = evaluateIssuance(
    {
      tier,
      // HARD 不调用 LLM：confidence 置 0，门禁必拦截（hard-tier-manual）。
      confidence: 0,
      evidence: evidenceState,
      agreementSigned: readAgreementSigned(contract.terms),
      // TODO(ADR-0021 后续)：商家反驳举证独立字段落库后，此处由 false 改为实读；
      // 当前单 evidence 字段无法区分双方举证，有反驳内容一律走人工由客服判定。
      providerCounterEvidence: false,
    },
    policy,
  );

  // HARD 强制人工：不调用 arbitrate()（其 HARD 分支抛错），直接挂 PENDING_REVIEW。
  // 修复旧行为：HARD 抛错导致争议永久 OPEN、无人接管。
  if (tier === "HARD") {
    const envelope = { gate: issuance, policy };
    const { error } = await supabase
      .from('disputes')
      .update({
        status: 'PENDING_REVIEW',
        resolution: 'HARD 级争议转人工仲裁',
        tier,
        llm_verdict: JSON.stringify(envelope),
        needs_human_review: true,
      })
      .eq('id', dispute.id);
    if (error) throw error;
    return {
      resolution: 'HARD 级争议转人工仲裁',
      providerAmount: 0,
      customerAmount: 0,
      issuance,
      appealUntil: null,
    };
  }

  const serviceTitle = contract.terms
    ? (() => { try { const t = JSON.parse(contract.terms); return t.title ?? "服务订单" } catch { return "服务订单" } })()
    : "服务订单"

  const verdict = await arbitrate({
    disputeId: dispute.id,
    tier,
    reason: dispute.reason,
    evidence: dispute.evidence ?? "无证据",
    contractAmount,
    serviceTitle,
    initiatorId: dispute.initiator_id,
    responderId: dispute.initiator_id === contract.customer_id
      ? contract.provider_id
      : contract.customer_id,
  })

  // ADR-0021 签发门禁：LLM 输出只是《仲裁建议书》，能否生效看门禁。
  // MEDIUM 经议会仲裁且高置信仍可 AUTO（议会本身即复核）；仅 HARD 恒人工（上已返回）。
  const gate = evaluateIssuance(
    {
      tier,
      confidence: verdict.confidence,
      evidence: evidenceState,
      agreementSigned: readAgreementSigned(contract.terms),
      providerCounterEvidence: false,
    },
    policy,
  );
  const autoExecutable = gate.decision === "AUTO";
  const resolutionStatus = autoExecutable ? 'RESOLVED' : 'PENDING_REVIEW'
  // 终裁申诉窗：窗内资金冻结不划转（ADR-0021 §三；调用方据 appealUntil 延期划转）。
  const nowMs = Date.now();
  const appealUntil = autoExecutable ? appealDeadline(nowMs, policy.appealWindowHours) : null;

  const { error: disputeUpdateError } = await supabase
    .from('disputes')
    .update({
      status: resolutionStatus,
      resolution: verdict.resolution,
      tier,
      loser_id: verdict.loserId || null,
      // 信封加法：结算路径只读 providerAmount/customerAmount（settle_after_dispute 兼容）。
      llm_verdict: JSON.stringify({
        providerAmount: verdict.providerAmount,
        customerAmount: verdict.customerAmount,
        policy,
        gate,
        appealUntil,
      }),
      llm_confidence: verdict.confidence,
      council_results: verdict.councilVotes ? JSON.stringify(verdict.councilVotes) : null,
      ...(autoExecutable ? {} : { needs_human_review: true }),
    })
    .eq('id', dispute.id)
  if (disputeUpdateError) throw disputeUpdateError

  if (!autoExecutable) {
    // 门禁拦截：标记需人工复核，不继续执行（修复旧行为：REVIEW 仍被划转）。
    return {
      resolution: verdict.resolution,
      providerAmount: verdict.providerAmount,
      customerAmount: verdict.customerAmount,
      issuance: gate,
      appealUntil,
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
    issuance: gate,
    appealUntil,
  };
}

/** 终裁信封解析见 policy.parseVerdictEnvelope（纯核，可单测）。 */

/** 扫描所有需要 LLM 裁决的争议并自动处理 */
export async function processPendingDisputes(): Promise<string[]> {
  const results: string[] = []
  const supabase = getServiceClient()

  // OPEN（待裁决）＋ RESOLVED（申诉窗暂缓、待窗过补划转）同扫；
  // 已结算（contracts.fund_status === 'SETTLED'）终态不重入。
  const { data: openDisputes } = await supabase
    .from('disputes')
    .select('id, contract_id, reason, evidence, initiator_id, created_at, status, llm_verdict')
    .in('status', ['OPEN', 'RESOLVED'])

  if (!openDisputes || openDisputes.length === 0) return results

  const contractIds = [...new Set(openDisputes.map(d => d.contract_id))]
  const { data: contractsMap } = await supabase
    .from('contracts')
    .select('id, amount, protocol_id, customer_id, provider_id, fund_status')
    .in('id', contractIds)

  const contractById = new Map((contractsMap || []).map(c => [c.id, c]))

  for (const dispute of openDisputes) {
    const contract = contractById.get(dispute.contract_id)
    if (!contract) continue
    // 已结算终态不重入（防重复划转）。
    if (contract.fund_status === 'SETTLED') continue

    const channels = getProtocol(contract.protocol_id)?.dispute.channels
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
      let providerAmount: number;
      let customerAmount: number;
      let label: string;
      if (dispute.status === 'OPEN') {
        const decision = await resolveDispute(
          dispute.id,
          channel,
          getProtocol(contract.protocol_id)?.dispute ?? null,
        );

        // ADR-0021 划转唯一闸口（pur核 decideRefundTiming）：REVIEW 只排队人工，
        // AUTO 窗内冻结等窗过（修复旧行为：REVIEW 仍被退款）。
        const timing = decideRefundTiming(decision.issuance.decision, decision.appealUntil, Date.now());
        if (timing === "QUEUE_REVIEW") {
          results.push(`review_queued: ${dispute.id} — ${decision.issuance.reasons.join(",") || decision.resolution}`)
          continue
        }
        if (timing === "HOLD_APPEAL") {
          results.push(`appeal_hold: ${dispute.id} — 申诉窗至 ${new Date(decision.appealUntil!).toISOString()}`)
          continue
        }
        providerAmount = decision.providerAmount;
        customerAmount = decision.customerAmount;
        label = decision.resolution;
      } else {
        // RESOLVED：申诉窗暂缓件，窗过补划转（不重仲裁，直接读终裁信封；同走划转闸口）。
        const env = parseVerdictEnvelope(dispute.llm_verdict);
        if (!env) {
          results.push(`appeal_hold_broken: ${dispute.id} — 终裁信封不可解析，转人工`);
          continue
        }
        if (decideRefundTiming("AUTO", env.appealUntil, Date.now()) === "HOLD_APPEAL") {
          results.push(`appeal_hold: ${dispute.id} — 申诉窗至 ${new Date(env.appealUntil!).toISOString()}`)
          continue
        }
        providerAmount = env.providerAmount;
        customerAmount = env.customerAmount;
        label = '申诉窗过补划转';
      }

      // D-5 Phase C 改道：退款事务直连真身模块（门面 contract-machine 已退役）
      const { createRefundTransactions } = await import("@/lib/contract/refund")
      await createRefundTransactions(
        dispute.contract_id,
        contract.customer_id,
        contract.provider_id,
        { provider: providerAmount, customer: customerAmount },
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
          reason: `AI 自动裁决: ${label}`,
        })
      if (eventError) throw eventError

      results.push(`auto_resolved: ${dispute.id} — ${label}`)
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e)
      results.push(`auto_resolve FAILED ${dispute.id}: ${msg}`)
    }
  }

  return results
}
