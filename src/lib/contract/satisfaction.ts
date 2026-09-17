import { getServiceClient } from "@/lib/supabase-client"
import { addContractEvent } from "./events"
import { appendEvidence } from '@/modules/m11-evidence-log/evidence-chain'
import { updateCredit } from "@/modules/m07-credit/credit-engine"
// D-5 Phase E：协议定义资产归位 Base
import { getProtocol } from "@/base/order/protocol-definitions"
// R5 单单释放（用户裁决 2026-09-17 · 宪法 §6.2 Clean Slate）：
// 15 单成团批经济整段删除，不留适配器；暂扣口径 + 到期判定 + 结算方程全委托纯核。
import {
  qualityHoldCents,
  satisfactionReleaseDue,
  settleType1,
} from "@/base/money/type1-settlement"
import {
  effectiveSubjectivePass,
  isSubjectiveChecks,
  type SubjectiveChecks,
} from "@/base/trust/subjective-check"

/**
 * 暂扣（hold）：COMPLETED → SATISFACTION_HELD + 暂扣时刻戳。
 * 幂等：已 HELD 且有 held_at 直接返回（路由与 cron 双入口互调不双扣）。
 */
export async function handleSatisfactionBatch(contractId: string) {
  const supabase = getServiceClient()

  const { data: contract } = await supabase
    .from('contracts')
    .select('provider_id, amount, fund_status, protocol_id, satisfaction_held_at')
    .eq('id', contractId)
    .single()

  if (!contract) return

  if (
    contract.fund_status === 'SATISFACTION_HELD' &&
    contract.satisfaction_held_at != null
  ) {
    return
  }

  const satisfactionHold = getProtocol(contract.protocol_id)?.funding.fees.satisfaction_hold ?? 0
  if (satisfactionHold <= 0) return

  const totalCents = Math.round(Number(contract.amount) * 100)
  const depositAmount = qualityHoldCents(totalCents, satisfactionHold) / 100
  const heldAt = new Date().toISOString()

  const { error: updateContractError } = await supabase
    .from('contracts')
    .update({
      satisfaction_held_at: heldAt,
      fund_status: 'SATISFACTION_HELD',
    })
    .eq('id', contractId)
  if (updateContractError) throw updateContractError

  await addContractEvent({
    contractId,
    actorId: contract.provider_id,
    fromStatus: contract.fund_status,
    toStatus: 'SATISFACTION_HELD',
    action: 'hold_satisfaction',
    reason: `满意度暂存款已冻结: ¥${depositAmount}`,
  })
}

export interface SatisfactionReleaseResult {
  released: boolean;
  /** 到期结算明细（未到期时为 null）。 */
  providerNetCents?: number;
  qualityFeeCents?: number;
  passedCount?: number | null;
}

/**
 * 单单释放（R5）：SATISFACTION_HELD + held_at+72h 到期 → settleType1 单单结算 → SETTLED。
 * 评价口径（用户裁决 2026-09-17）：需求方已提交行按勾结算（盲态不影响，
 * 勾已落库）；无提交行按 null 默认全返。举证门在释放时重算一次（幂等）。
 * 未到期 → { released: false }，调用方跳过。
 */
export async function releaseSatisfactionOrder(
  contractId: string,
  nowMs: number = Date.now(),
): Promise<SatisfactionReleaseResult> {
  const supabase = getServiceClient()

  const { data: contract } = await supabase
    .from('contracts')
    .select('provider_id, customer_id, amount, fund_status, protocol_id, satisfaction_held_at')
    .eq('id', contractId)
    .single()

  if (!contract || contract.fund_status !== 'SATISFACTION_HELD') {
    return { released: false }
  }
  const heldAtMs =
    contract.satisfaction_held_at != null
      ? Date.parse(contract.satisfaction_held_at)
      : NaN
  if (!satisfactionReleaseDue(heldAtMs, nowMs)) {
    return { released: false }
  }

  const totalCents = Math.round(Number(contract.amount) * 100)

  // 需求方提交行（有则按勾，无则全返；blind/抖动只管展示，不管钱）
  let pass: SubjectiveChecks | null = null;
  let passedCount: number | null = null;
  try {
    const { data: rows } = await supabase
      .from('order_reviews')
      .select('checks, has_after_photo, passed_count')
      .eq('contract_id', contractId)
      .eq('reviewer_id', contract.customer_id)
      .limit(1);
    const row = (rows ?? [])[0] as
      | { checks: unknown; has_after_photo: boolean | null; passed_count: number | null }
      | undefined;
    if (row && isSubjectiveChecks(row.checks)) {
      pass = effectiveSubjectivePass({
        checks: row.checks,
        hasAfterPhoto: row.has_after_photo === true,
      });
      passedCount = row.passed_count;
    }
  } catch {
    /* 评价表缺席 = 无评价，全返 */
  }

  // 方程真相源：85/15 内生（弹药表非零 hold 恒 0.15；hold=0 协议从不进 HELD，到此必为 85/15 单）
  const settled = settleType1(totalCents, pass, 0);
  const providerNet = settled.providerNetCents / 100
  const qualityFee = settled.qualityFeeCents / 100

  // R11 双账本统一：释放必须落 provider_wallets（此前零记账，钱凭空蒸发）。
  // 幂等对账：wallet_logs(order_id=contractId, type=satisfaction_payout) 存在即跳过记账
  // （崩溃重放：已记账未 SETTLED → 只补状态，绝不双付）。
  const { data: paid } = await supabase
    .from('wallet_logs')
    .select('id')
    .eq('order_id', contractId)
    .eq('type', 'satisfaction_payout')
    .limit(1)
  if (!paid || paid.length === 0) {
    const { data: wallet } = await supabase
      .from('provider_wallets')
      .select('balance')
      .eq('provider_id', contract.provider_id)
      .single()
    if (!wallet) {
      const { error: ensureError } = await supabase
        .from('provider_wallets')
        .insert({ provider_id: contract.provider_id, balance: 0 })
      if (ensureError) throw ensureError
    }
    const base = Number((wallet as { balance?: number } | null)?.balance ?? 0)
    const { error: creditError } = await supabase
      .from('provider_wallets')
      .update({
        balance: Math.round((base + providerNet) * 100) / 100,
        updated_at: new Date().toISOString(),
      })
      .eq('provider_id', contract.provider_id)
    if (creditError) throw creditError
    const { error: logError } = await supabase.from('wallet_logs').insert([
      {
        provider_id: contract.provider_id,
        amount: providerNet,
        type: 'satisfaction_payout',
        order_id: contractId,
        description: `72h单单释放: 合同 ${contractId} 实得¥${providerNet}`,
      },
      {
        provider_id: contract.provider_id,
        amount: -qualityFee,
        type: 'platform_fee',
        order_id: contractId,
        description: `72h单单释放: 合同 ${contractId} 质管费¥${qualityFee}`,
      },
    ])
    if (logError) throw logError
  }

  const { error: updateContractError } = await supabase
    .from('contracts')
    .update({ fund_status: 'SETTLED' })
    .eq('id', contractId)
  if (updateContractError) throw updateContractError

  await addContractEvent({
    contractId,
    actorId: contract.provider_id,
    fromStatus: 'SATISFACTION_HELD',
    toStatus: 'SETTLED',
    action: 'release_satisfaction',
    reason: `72h单单释放: 实得¥${settled.providerNetCents / 100} / 质管费¥${settled.qualityFeeCents / 100}${pass ? ` / ${passedCount ?? '?'}勾` : ' / 无评价默认全返'}`,
  })

  const ev = await appendEvidence({
    protocolId: contract.protocol_id,
    eventType: 'satisfaction_released',
    payload: {
      contract_id: contractId,
      provider_id: contract.provider_id,
      total_cents: totalCents,
      provider_net_cents: settled.providerNetCents,
      quality_fee_cents: settled.qualityFeeCents,
      passed_count: passedCount,
    },
  })
  if (!ev) throw new Error('Failed to append evidence for satisfaction release')
  await updateCredit({ userId: contract.provider_id, eventType: 'completion', evidenceId: ev.id, description: 'Satisfaction order released' })

  return {
    released: true,
    providerNetCents: settled.providerNetCents,
    qualityFeeCents: settled.qualityFeeCents,
    passedCount,
  }
}
