import { getSupabase } from "@/lib/supabase-client"
import { addContractEvent } from "@/lib/contract-machine"
import { updateCredit } from "@/modules/m07-credit/credit-engine"
import { appendEvidence } from "@/modules/m11-evidence-log/evidence-chain"
import { nextStage } from "@/lib/protocol/engine"

const STAGE_SLA = {
  ACCEPTED: { maxMinutes: 30, label: "接单到出发" },
  DEPARTED: { maxMinutes: 60, label: "出发到到达" },
}

const STAGE_ORDER: Record<string, number> = {
  NOT_ACCEPTED: 0,
  ACCEPTED: 1,
  DEPARTED: 2,
  ARRIVED: 3,
  IN_PROGRESS: 4,
  DONE: 5,
}

export async function checkAndEnforceSLA(): Promise<string[]> {
  const supabase = getSupabase()
  const now = new Date()
  const results: string[] = []

  const { data: contracts } = await supabase
    .from('contracts')
    .select('id, demand_id, customer_id, provider_id, fund_status, amount, created_at')
    .eq('fund_status', 'HELD')

  if (!contracts || contracts.length === 0) return results

  for (const c of contracts) {
    const { data: orders } = await supabase
      .from('orders')
      .select('id, service_phase, updated_at, created_at')
      .eq('contract_id', c.id)
      .order('created_at', { ascending: false })
      .limit(1)

    if (!orders || orders.length === 0) continue
    const order = orders[0]

    const sla = SLA_MAP[order.service_phase as string]
    if (!sla) continue

    const stageStart = order.updated_at ? new Date(order.updated_at) : new Date(order.created_at)
    const elapsedMs = now.getTime() - stageStart.getTime()
    const elapsedMin = elapsedMs / 60000

    if (elapsedMin < sla.maxMinutes) continue

    await enforceSLABreach(c, order, sla, now, results)
  }

  return results
}

interface SLAEntry {
  maxMinutes: number
  label: string
}

const SLA_MAP: Record<string, SLAEntry> = {
  ACCEPTED: { maxMinutes: 30, label: "接单到出发" },
  DEPARTED: { maxMinutes: 60, label: "出发到到达" },
}

async function enforceSLABreach(
  contract: { id: string; demand_id: string; customer_id: string; provider_id: string; amount: number },
  order: { id: string; service_phase: string },
  sla: SLAEntry,
  now: Date,
  results: string[],
): Promise<void> {
  const supabase = getSupabase()
  const penaltyPct = 0.05
  const compensationAmount = Math.round(contract.amount * penaltyPct * 100) / 100

  await supabase
    .from('orders')
    .update({ service_phase: 'CANCELLED', status: 'cancelled' })
    .eq('id', order.id)

  await supabase
    .from('contracts')
    .update({ fund_status: 'CANCELLED' })
    .eq('id', contract.id)

  await addContractEvent({
    contractId: contract.id,
    actorId: 'system',
    fromStatus: 'HELD',
    toStatus: 'CANCELLED',
    action: 'sla_breach',
    reason: `SLA超时: ${sla.label}超过${sla.maxMinutes}分钟`,
  })

  const ev = await appendEvidence({
    eventType: 'sla_breach',
    payload: {
      contract_id: contract.id,
      provider_id: contract.provider_id,
      customer_id: contract.customer_id,
      stage: order.service_phase,
      elapsed_minutes: Math.round((now.getTime() - new Date(order.created_at).getTime()) / 60000),
      sla_max_minutes: sla.maxMinutes,
      compensation: compensationAmount,
    },
  })

  if (!ev) {
    results.push(`SLA_FAIL ${contract.id}: evidence append failed`)
    return
  }

  await updateCredit({
    userId: contract.provider_id,
    eventType: 'violation',
    evidenceId: ev,
    description: `SLA超时违约: ${sla.label}超时，订单${contract.id}已取消`,
  })

  if (compensationAmount > 0) {
    await supabase
      .from('insurance_pool')
      .insert({
        protocol_id: contract.demand_id,
        contract_id: contract.id,
        amount: compensationAmount,
        type: 'payout',
        sub_type: 'warranty',
        description: `SLA违约赔偿: ${sla.label}超时，向买家赔付${compensationAmount}`,
      })
      .maybeSingle()
  }

  results.push(`SLA_ENFORCED ${contract.id}: ${sla.label} over ${sla.maxMinutes}m, compensated ¥${compensationAmount}`)
}

// ---- instrumentation entry point ----

let slaStarted = false

export function startSLAEnforcer() {
  if (slaStarted) return
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL.includes("placeholder")) return
  slaStarted = true
  runSLA()
  setInterval(runSLA, 60_000)
}

async function runSLA() {
  try {
    const results = await checkAndEnforceSLA()
    if (results.length > 0) {
      console.log(`[SLA] Enforced ${results.length} breaches:`, results.join("; "))
    }
  } catch (e) {
    console.error("[SLA] check error:", e)
  }
}
