// M13: 支付与担保交易
// 资金状态机：PENDING_HELD → HELD → COMPLETED → SATISFACTION_HELD → SETTLED
//              ↘ DISPUTED ↗              ↗ CANCELLED
// 六种资金模式：full_prepay / deposit_only / commitment / milestone_staged / split_revenue / pay_later / none
// 退款三阶段：未出发 / 已出发未到场 / 已到场未开始 / 服务中中止
// 仲裁三级：Green(≤¥200) / Yellow / Red(大额+受伤)

import { getSupabase } from '@/lib/supabase-client'
import { appendEvidence } from '@/modules/m11-evidence-log/evidence-chain'
import { updateCredit } from '@/modules/m07-credit/credit-engine'
import { getCategoryConfig } from '@/modules/m03-category-config/category-loader'
import { getPaymentManager } from '@/lib/payment'
import type { FundingMode, ServicePhase } from '@/lib/contracts'

// ---- 资金托管（支持六种模式）----
export async function holdPayment(
  protocolId: string,
  amount: number,
  fundingMode: FundingMode = 'full_prepay',
  modeOptions?: {
    depositRate?: number
    commitmentFee?: number
    milestones?: { label: string; percent: number }[]
    teamSplits?: { userId: string; share: number }[]
  },
): Promise<{ success: boolean; escrowId?: string; heldAmount?: number; message?: string }> {
  if (fundingMode === 'none') {
    await getSupabase()
      .from('protocols')
      .update({ status: 'pending_held', funding_mode: fundingMode })
      .eq('id', protocolId)
    return { success: true, heldAmount: 0, message: 'No payment required for this mode' }
  }

  if (fundingMode === 'pay_later') {
    const creditOk = await checkCreditForPayLater(protocolId)
    if (!creditOk) {
      return { success: false, message: 'Credit score too low for pay_later mode' }
    }
    await getSupabase()
      .from('protocols')
      .update({ status: 'pending_held', funding_mode: fundingMode })
      .eq('id', protocolId)
    await appendEvidence({
      protocolId,
      eventType: 'payment_pay_later',
      payload: { amount, funding_mode: fundingMode },
    })
    return { success: true, heldAmount: 0, message: 'Pay later mode — no funds held' }
  }

  const { data: protocol } = await getSupabase()
    .from('protocols')
    .select('category')
    .eq('id', protocolId)
    .single()

  if (!protocol) return { success: false }

  const feeRate = await getPlatformFeeRate(protocol.category as string)
  const depositRate = modeOptions?.depositRate ?? 0.3
  const commitmentFee = modeOptions?.commitmentFee ?? 10
  let holdAmount = amount

  switch (fundingMode) {
    case 'deposit_only':
      holdAmount = Math.round(amount * depositRate * 100) / 100
      break
    case 'commitment':
      holdAmount = Math.min(commitmentFee, amount)
      break
    case 'milestone_staged':
    case 'split_revenue':
    case 'full_prepay':
    default:
      holdAmount = amount
      break
  }

  const platformFee = Math.round(holdAmount * feeRate * 100) / 100
  const satisfactionHold = Math.round(holdAmount * 0.1 * 100) / 100
  const providerIncome = holdAmount - platformFee - satisfactionHold

  const { data: order } = await getSupabase()
    .from('orders')
    .insert({
      protocol_id: protocolId,
      amount: holdAmount,
      escrow_status: 'held',
      platform_fee: platformFee,
      provider_income: providerIncome,
      satisfaction_hold: satisfactionHold,
      status: 'confirmed',
    })
    .select()
    .single()

  if (!order) {
    return { success: false }
  }

  const paymentResult = await performCharge(holdAmount, protocolId, order.id)
  if (!paymentResult.success) {
    return { success: false }
  }

  await getSupabase()
    .from('protocols')
    .update({ status: 'pending_held', funding_mode: fundingMode })
    .eq('id', protocolId)

  const modePayload: Record<string, unknown> = {
    amount: holdAmount,
    platform_fee: platformFee,
    satisfaction_hold: satisfactionHold,
    funding_mode: fundingMode,
  }

  if (fundingMode === 'deposit_only') {
    modePayload.deposit_rate = depositRate
    modePayload.remaining = Math.round((amount - holdAmount) * 100) / 100
  }

  if (fundingMode === 'commitment') {
    modePayload.commitment_fee = commitmentFee
  }

  if (fundingMode === 'milestone_staged' && modeOptions?.milestones) {
    modePayload.milestones = modeOptions.milestones
  }

  if (fundingMode === 'split_revenue' && modeOptions?.teamSplits) {
    modePayload.team_splits = modeOptions.teamSplits
  }

  await appendEvidence({
    protocolId,
    orderId: order.id,
    eventType: 'payment_held',
    payload: modePayload,
  })

  return { success: true, escrowId: order.id, heldAmount: holdAmount }
}

// ---- 确认完成 & 放款（需双方确认） ----
const confirmedEvents = new Set<string>()

export async function confirmCompletion(
  protocolId: string,
  role: 'demander' | 'provider',
): Promise<{ success: boolean; message?: string }> {
  await appendEvidence({
    protocolId,
    eventType: 'completion_confirmed',
    payload: { confirmed_by: role },
  })

  const { data: confirms } = await getSupabase()
    .from('evidence_log')
    .select('payload')
    .eq('protocol_id', protocolId)
    .eq('event_type', 'completion_confirmed')

  const roles = new Set((confirms ?? []).map((c) => (c.payload as Record<string, string>).confirmed_by))
  if (!roles.has('demander') || !roles.has('provider')) {
    return { success: false, message: 'Awaiting confirmation from the other party' }
  }

  await getSupabase()
    .from('protocols')
    .update({ status: 'satisfaction_held' })
    .eq('id', protocolId)

  return { success: true }
}

// ---- 结算放款（满意度暂存款批释放 / 直接结算，复用托管路径）----
export async function settlePayment(
  protocolId: string,
): Promise<{ success: boolean }> {
  const { data: order } = await getSupabase()
    .from('orders')
    .select('*')
    .eq('protocol_id', protocolId)
    .single()

  if (!order) return { success: false }

  const providerIncome = order.provider_income ?? 0
  const satisfactionHold = order.satisfaction_hold ?? 0

  const { data: protocol } = await getSupabase()
    .from('protocols')
    .select('provider_id, category, origin_type')
    .eq('id', protocolId)
    .single()

  if (!protocol) return { success: false }

  if (protocol.origin_type === 'contractor_self_funded') {
    const { splitTeamPayment } = await import('./payment-service')
    await splitTeamPayment(protocolId)
  } else {
    await performTransfer(protocol.provider_id, providerIncome, `Settlement for order ${order.id}`)
  }

  await getSupabase()
    .from('orders')
    .update({ escrow_status: 'released' })
    .eq('id', order.id)

  await getSupabase()
    .from('protocols')
    .update({ status: 'settled' })
    .eq('id', protocolId)

  if (protocol) {
    await updateCredit({
      userId: protocol.provider_id,
      category: protocol.category as string,
      eventType: 'completion',
      evidenceId: (await getSupabase().from('evidence_log').select('id').eq('protocol_id', protocolId).eq('event_type', 'completion_confirmed').single()).data!.id,
      description: `Order ${protocolId} completed`,
    })
  }

  return { success: true }
}

// ---- 争议冻结 ----
export async function freezeForDispute(
  protocolId: string,
  reason: string,
): Promise<void> {
  await getSupabase()
    .from('orders')
    .update({ escrow_status: 'disputed' })
    .eq('protocol_id', protocolId)

  await getSupabase()
    .from('protocols')
    .update({ status: 'disputed' })
    .eq('id', protocolId)

  await appendEvidence({
    protocolId,
    eventType: 'dispute',
    payload: { reason },
  })
}

// ---- 退款（2.7 三路径退款逻辑：按服务阶段分级）----
//   取消时阶段       | 服务者收到                  | 客户退款     | 平台佣金
//   未出发           | 0                          | 全额          | 不退
//   已出发未到场      | 上门费(上限¥50)             | 剩余部分      | 不退
//   已到场未开始服务  | 检测/评估费(上限¥100)        | 剩余部分      | 不退
//   服务中中止        | 按LLM评估的已完成比例        | 未服务比例    | 不退
//
export async function refundByPhase(
  protocolId: string,
  phase: ServicePhase,
  completionRatio?: number,
): Promise<{ customerRefund: number; providerGets: number; tier: string }> {
  const { data: order } = await getSupabase()
    .from('orders')
    .select('id, amount, provider_id, platform_fee')
    .eq('protocol_id', protocolId)
    .single()

  if (!order) return { customerRefund: 0, providerGets: 0, tier: 'none' }
  const amount = order.amount ?? 0

  let providerGets = 0
  let customerRefund = 0

  switch (phase) {
    case 'NOT_ACCEPTED':
    case 'ACCEPTED':
      providerGets = 0
      customerRefund = amount
      break
    case 'DEPARTED':
      providerGets = Math.min(50, amount)
      customerRefund = amount - providerGets
      break
    case 'ARRIVED':
      providerGets = Math.min(100, amount)
      customerRefund = amount - providerGets
      break
    case 'IN_PROGRESS': {
      const ratio = completionRatio ?? 0.5
      providerGets = Math.round(amount * ratio * 100) / 100
      customerRefund = Math.round(amount * (1 - ratio) * 100) / 100
      break
    }
    default:
      providerGets = 0
      customerRefund = amount
  }

  if (providerGets > 0) {
    await performTransfer(order.provider_id, providerGets, `Refund for order ${order.id}`)
  }

  const tier = getArbitrationTier(amount, phase !== 'IN_PROGRESS')

  await getSupabase()
    .from('orders')
    .update({ escrow_status: 'refunded' })
    .eq('id', order.id)

  await getSupabase()
    .from('protocols')
    .update({ status: 'cancelled' })
    .eq('id', protocolId)

  await appendEvidence({
    protocolId,
    eventType: 'refund',
    payload: { phase, customer_refund: customerRefund, provider_gets: providerGets, tier },
  })

  return { customerRefund, providerGets, tier }
}

// ---- 仲裁三级（2.7 三路径仲裁）----
// Green  (≤¥200, 清晰证据)          → LLM auto-ruling within 24h
// Yellow (中等金额或证据模糊)          → LLM初审 + 人工复核 within 48h
// Red    (大额或涉及人身伤害)          → 人工+法务+保险 within 72h
export function getArbitrationTier(amount: number, hasClearEvidence: boolean): 'green' | 'yellow' | 'red' {
  if (amount <= 200 && hasClearEvidence) return 'green'
  if (amount > 2000) return 'red'
  return 'yellow'
}

export interface ArbitrationResult {
  tier: 'green' | 'yellow' | 'red'
  ruling: string
  providerPayout: number
  customerRefund: number
  deadlineHours: number
}

export async function resolveDispute(
  protocolId: string,
  amount: number,
  hasClearEvidence: boolean,
  llmAssessmentRatio?: number,
): Promise<ArbitrationResult> {
  const tier = getArbitrationTier(amount, hasClearEvidence)

  const deadlineHours = tier === 'green' ? 24 : tier === 'yellow' ? 48 : 72

  let providerPayout = 0
  let customerRefund = amount

  if (llmAssessmentRatio !== undefined) {
    providerPayout = Math.round(amount * llmAssessmentRatio * 100) / 100
    customerRefund = Math.round(amount * (1 - llmAssessmentRatio) * 100) / 100
  }

  const rulingMap: Record<string, string> = {
    green: 'LLM auto-ruling: evidence sufficient, case closed',
    yellow: 'LLM初审 + 人工复核: pending reviewer decision',
    red: '人工+法务+保险: escalated to legal team',
  }

  await appendEvidence({
    protocolId,
    eventType: 'dispute_resolution',
    payload: {
      tier,
      deadline_hours: deadlineHours,
      ruling: rulingMap[tier],
      provider_payout: providerPayout,
      customer_refund: customerRefund,
    },
  })

  return { tier, ruling: rulingMap[tier], providerPayout, customerRefund, deadlineHours }
}

// ---- 组队模式自动分账 ----
export async function splitTeamPayment(protocolId: string): Promise<{ success: boolean; splits: { userId: string; amount: number }[] }> {
  const { data: protocol } = await getSupabase()
    .from('protocols')
    .select('origin_type')
    .eq('id', protocolId)
    .single()

  if (!protocol || protocol.origin_type !== 'contractor_self_funded') {
    return { success: false, splits: [] }
  }

  const { data: requests } = await getSupabase()
    .from('team_requests')
    .select('member_id, reward')
    .eq('parent_protocol_id', protocolId)
    .eq('status', 'filled')

  const splits: { userId: string; amount: number }[] = []
  for (const req of requests ?? []) {
    if (!req.member_id) continue
    const amount = Number(req.reward)
    await performTransfer(req.member_id, amount, `Team split for protocol ${protocolId} — member ${req.member_id}`)
    splits.push({ userId: req.member_id, amount })
  }

  await appendEvidence({
    protocolId,
    eventType: 'team_payment_split',
    payload: { splits },
  })

  return { success: true, splits }
}

async function checkCreditForPayLater(protocolId: string): Promise<boolean> {
  const { data: protocol } = await getSupabase()
    .from('protocols')
    .select('demander_id, category')
    .eq('id', protocolId)
    .single()

  if (!protocol) return false

  const { getCreditScore } = await import('@/modules/m07-credit/credit-engine')
  const credit = await getCreditScore(protocol.demander_id, protocol.category as string)

  return credit.baseScore >= 70
}

async function getPlatformFeeRate(category: string): Promise<number> {
  const config = await getCategoryConfig(category)
  if (config?.entry_requirements) {
    const reqs = config.entry_requirements as Record<string, unknown>
    const baseRate = (reqs.platform_fee_rate as number) ?? 0.05
    const riskTier = config.risk_tier
    const riskMultiplier = riskTier === 'high' ? 1.5 : riskTier === 'medium' ? 1.2 : 1.0
    return Math.round(baseRate * riskMultiplier * 1000) / 1000
  }
  return 0.05
}

const processedIds = new Set<string>()

async function performCharge(
  amount: number,
  protocolId: string,
  orderId: string,
): Promise<{ success: boolean }> {
  if (processedIds.has(orderId)) {
    console.log(`[M13] Idempotent skip: charge ${orderId} already processed`)
    return { success: true }
  }

  if (process.env.ALIPAY_APP_ID || process.env.WECHAT_APP_ID) {
    const manager = getPaymentManager()
    const channels = manager.getAvailableChannels()
    if (channels.length > 0) {
      const channel = channels[0] as 'alipay' | 'wechat'
      const result = await manager.createPayment({
        orderId,
        amount,
        description: `Protocol ${protocolId} payment`,
        channel,
        notifyUrl: process.env.PAYMENT_NOTIFY_URL || '',
        payerId: protocolId,
      })
      if (!result.success) {
        console.error(`[M13] Payment failed: ${result.error}`)
      }
      if (result.success) processedIds.add(orderId)
      return { success: result.success }
    }
  }

  processedIds.add(orderId)
  await new Promise((r) => setTimeout(r, 200))
  console.log(`[M13] Simulated charge: ¥${amount} for order ${orderId}`)
  return { success: true }
}

const transferredKeys = new Set<string>()

async function performTransfer(
  userId: string,
  amount: number,
  description: string,
): Promise<void> {
  const key = `${userId}:${amount}:${description}`
  if (transferredKeys.has(key)) {
    console.log(`[M13] Idempotent skip: transfer ${key} already done`)
    return
  }
  transferredKeys.add(key)
  await new Promise((r) => setTimeout(r, 150))
  console.log(`[M13] Transfer to ${userId}: ¥${amount} — ${description}`)
}

async function escrowThroughSOS(protocolId: string, amount: number): Promise<boolean> {
  const { createTeamProtocol } = await import('@/modules/m14-team-formation/team-formation')
  const { data: protocol } = await getSupabase()
    .from('protocols')
    .select('demander_id, category, core_fields, category_fields, origin_type')
    .eq('id', protocolId)
    .single()

  if (!protocol || protocol.origin_type !== 'contractor_self_funded') {
    return false
  }

  const { holdPayment } = await import('./payment-service')
  const result = await holdPayment(protocolId, amount)
  return result.success
}
