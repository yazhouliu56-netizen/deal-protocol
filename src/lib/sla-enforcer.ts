import { getServiceClient } from "@/lib/supabase-client";
// D-5 Phase C：事件流水直连真身模块，状态推导收编 Base 纯函数核（门面已退役）
import { addContractEvent } from "@/lib/contract/events";
import { getNextFundStatus } from "@/base/order/contract-engine";
import { getEngine } from "@/lib/protocol/engine";
import { updateCredit } from "@/modules/m07-credit/credit-engine"
import { appendEvidence } from "@/modules/m11-evidence-log/evidence-chain"

function parseOrderDate(order: Record<string, unknown>): Date {
  const rawDate = order.created_at ?? order.createdAt ?? order.updated_at ?? order.updatedAt
  if (typeof rawDate === "string" || typeof rawDate === "number") {
    const parsed = new Date(rawDate)
    if (!isNaN(parsed.getTime())) return parsed
  }
  console.warn(
    `[SLA Enforcer] Invalid order date for order ${String(order.id ?? "unknown")}, fallback to Date.now()`,
  )
  return new Date()
}

function extractEvidenceId(ev: unknown): string {
  if (typeof ev === "string") return ev
  if (ev && typeof ev === "object") {
    const obj = ev as Record<string, unknown>
    if (typeof obj.id === "string") return obj.id
    if (typeof obj.evidence_id === "string") return obj.evidence_id
    if (typeof obj.hash === "string") return obj.hash
  }
  return `ev_fallback_${Date.now()}`
}

interface SLAEntry {
  maxMinutes: number
  label: string
}

const SLA_MAP: Record<string, SLAEntry> = {
  ACCEPTED: { maxMinutes: 30, label: "接单到出发" },
  DEPARTED: { maxMinutes: 60, label: "出发到到达" },
}

interface ContractQueryRow {
  id: string
  demand_id: string | null
  customer_id: string
  provider_id: string
  fund_status: string
  amount: number
  created_at: string
}

interface OrderQueryRow {
  id: string
  protocol_id: string
  service_phase: string
  status: string
  updated_at: string | null
  created_at: string
}

export async function checkAndEnforceSLA(): Promise<string[]> {
  const supabase = getServiceClient()
  const now = new Date()
  const results: string[] = []

  const { data: contracts } = await supabase
    .from("contracts")
    .select("id, demand_id, customer_id, provider_id, fund_status, amount, created_at")
    .eq("fund_status", "HELD")

  if (!contracts || contracts.length === 0) return results

  for (const c of contracts) {
    const contract = c as unknown as ContractQueryRow

    const { data: orders } = await supabase
      .from("orders")
      .select("id, protocol_id, service_phase, status, updated_at, created_at")
      .eq("contract_id", contract.id)
      .order("created_at", { ascending: false })
      .limit(1)

    if (!orders || orders.length === 0) continue

    const order = orders[0] as unknown as OrderQueryRow

    if (order.service_phase === "CANCELLED" || order.status === "cancelled") {
      continue
    }

    const sla = SLA_MAP[order.service_phase]
    if (!sla) continue

    const stageStart = parseOrderDate(order as unknown as Record<string, unknown>)
    const elapsedMs = now.getTime() - stageStart.getTime()
    const elapsedMin = elapsedMs / 60000

    if (elapsedMin < sla.maxMinutes) continue

    await enforceSLABreach(contract, order, sla, now, results)
  }

  return results
}

async function enforceSLABreach(
  contract: ContractQueryRow,
  order: OrderQueryRow,
  sla: SLAEntry,
  now: Date,
  results: string[],
): Promise<void> {
  const supabase = getServiceClient()
  const penaltyPct = 0.05
  const compensationAmount = Math.round(contract.amount * penaltyPct * 100) / 100
  const slaAction = "sla_breach"

  const protocolId = contract.demand_id ?? order.protocol_id
  const protocolDef = protocolId ? getEngine(protocolId)?.getDefinition() : undefined
  const nextFundStatus = protocolDef
    ? getNextFundStatus(protocolDef, slaAction)
    : null
  const targetFundStatus = nextFundStatus ?? "CANCELLED"

  const { data: recheckOrder } = await supabase
    .from("orders")
    .select("service_phase")
    .eq("id", order.id)
    .single()

  if (recheckOrder && recheckOrder.service_phase === "CANCELLED") {
    results.push(`SLA_SKIP ${contract.id}: order already processed`)
    return
  }

  const { data: recheckContract } = await supabase
    .from("contracts")
    .select("fund_status")
    .eq("id", contract.id)
    .single()

  if (recheckContract && recheckContract.fund_status !== "HELD") {
    results.push(`SLA_SKIP ${contract.id}: contract fund_status already changed to ${recheckContract.fund_status}`)
    return
  }

  await supabase
    .from("orders")
    .update({ service_phase: "CANCELLED" as const, status: "cancelled" as const })
    .eq("id", order.id)
    .in("service_phase", ["ACCEPTED", "DEPARTED"])

  await supabase
    .from("contracts")
    .update({ fund_status: targetFundStatus })
    .eq("id", contract.id)
    .eq("fund_status", "HELD")

  await addContractEvent({
    contractId: contract.id,
    actorId: "system",
    fromStatus: contract.fund_status,
    toStatus: targetFundStatus,
    action: slaAction,
    reason: `SLA超时: ${sla.label}超过${sla.maxMinutes}分钟`,
  })

  const orderDate = parseOrderDate(order as unknown as Record<string, unknown>)
  const elapsedMinutes = Math.round((now.getTime() - orderDate.getTime()) / 60000)

  const ev = await appendEvidence({
    protocolId: protocolId ?? undefined,
    orderId: order.id,
    eventType: "SLA_AUTO_RELEASED",
    payload: {
      contract_id: contract.id,
      provider_id: contract.provider_id,
      customer_id: contract.customer_id,
      stage: order.service_phase,
      elapsed_minutes: elapsedMinutes,
      sla_max_minutes: sla.maxMinutes,
      compensation: compensationAmount,
      target_fund_status: targetFundStatus,
    },
  })

  if (!ev) {
    results.push(`SLA_FAIL ${contract.id}: evidence append failed`)
    return
  }

  const evidenceId = extractEvidenceId(ev)

  await updateCredit({
    userId: contract.provider_id,
    eventType: "violation",
    evidenceId,
    description: `SLA超时违约: ${sla.label}超时，订单${contract.id}已取消`,
  })

  await supabase
    .from("wallet_logs")
    .insert({
      provider_id: contract.provider_id,
      amount: compensationAmount,
      type: "SLA_RELEASE",
      order_id: order.id,
      description: `SLA auto release penalty: ¥${compensationAmount} for order ${order.id}`,
    })

  if (compensationAmount > 0) {
    await supabase
      .from("insurance_pool")
      .insert({
        protocol_id: contract.demand_id,
        contract_id: contract.id,
        amount: compensationAmount,
        type: "payout",
        sub_type: "warranty",
        description: `SLA违约赔偿: ${sla.label}超时，向买家赔付${compensationAmount}`,
      })
      .maybeSingle()
  }

  results.push(
    `SLA_ENFORCED ${contract.id}: ${sla.label} over ${sla.maxMinutes}m, compensated ¥${compensationAmount}`,
  )
}

let slaStarted = false

export function startSLAEnforcer(): void {
  if (slaStarted) return
  if (
    !process.env.NEXT_PUBLIC_SUPABASE_URL ||
    process.env.NEXT_PUBLIC_SUPABASE_URL.includes("placeholder")
  )
    return
  slaStarted = true
  runSLA()
  setInterval(runSLA, 60_000)
}

async function runSLA(): Promise<void> {
  try {
    const enforced = await checkAndEnforceSLA()
    if (enforced.length > 0) {
      console.log(`[SLA] Enforced ${enforced.length} breaches:`, enforced.join("; "))
    }
  } catch (e: unknown) {
    console.error("[SLA] check error:", e)
  }
}
