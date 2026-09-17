import { getServiceClient } from "@/lib/supabase-client"
import { getConfig } from "@/lib/platform/config"
import { addContractEvent } from "./events"
import { appendEvidence } from '@/modules/m11-evidence-log/evidence-chain'
import { updateCredit } from "@/modules/m07-credit/credit-engine"
// D-5 Phase E：协议定义资产归位 Base
import { getProtocol } from "@/base/order/protocol-definitions"
// R5 单单释放（用户裁决 2026-09-17 · 宪法 §6.2 Clean Slate）：
// 15 单成团批经济整段删除，不留适配器；暂扣口径 + 到期判定 + 结算方程全委托纯核。
import {
  qualityHoldCents,
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

  // P4 双钟表：进入 HELD 即释 base（与评价无关）；失败不阻断（cron base 扫 recovery）。
  try {
    await releaseSatisfactionBase(contractId)
  } catch (e) {
    console.warn(`[satisfaction] base release deferred for ${contractId}:`, e instanceof Error ? e.message : e)
  }
}

export interface SatisfactionReleaseResult {
  released: boolean;
  /** 到期结算明细（未到期时为 null）。 */
  providerNetCents?: number;
  qualityFeeCents?: number;
  passedCount?: number | null;
}

/**
 * P4 双钟表之一：base 即释（用户裁决 2026-09-18）。
 * 确认完工（进入 HELD）即释放 base 85%（与评价无关，不泄露）；15% 勾池写入
 * satisfaction_holds 待批量；佣金一次记账。幂等（wallet_logs 对账＋hold 行唯一）。
 * P1 互斥：demand 侧已放款 → 不碰钱、不建 hold，直接 SETTLED。
 */
export async function releaseSatisfactionBase(
  contractId: string,
): Promise<SatisfactionReleaseResult> {
  const supabase = getServiceClient()

  const { data: contract } = await supabase
    .from('contracts')
    .select('provider_id, customer_id, amount, fund_status, protocol_id, satisfaction_held_at, demand_id')
    .eq('id', contractId)
    .single()

  if (!contract || contract.fund_status !== 'SATISFACTION_HELD') {
    return { released: false }
  }

  // P1 互斥锁：孪生 demand 已放款 → 只推状态。
  const demandId = (contract as { demand_id?: string | null }).demand_id
  if (demandId) {
    const { data: demand } = await supabase
      .from('demands')
      .select('released_at')
      .eq('id', demandId)
      .single()
    if ((demand as { released_at?: string | null } | null)?.released_at != null) {
      await supabase.from('contracts').update({ fund_status: 'SETTLED' }).eq('id', contractId)
      await addContractEvent({
        contractId,
        actorId: contract.provider_id,
        fromStatus: 'SATISFACTION_HELD',
        toStatus: 'SETTLED',
        action: 'release_satisfaction',
        reason: `互斥锁跳过记账: 孪生需求单 ${demandId} 已放款，本侧只推进状态`,
      })
      return { released: false }
    }
  }

  const totalCents = Math.round(Number(contract.amount) * 100)
  let commissionRate = 0
  try {
    commissionRate = (await getConfig()).fees.commissionRate ?? 0
  } catch {
    /* 配置缺席回落 0（免费政策方向 fail-safe） */
  }
  // base 与评价无关：pass 传 null 只为取 base 份额（勾池另行批量结算）。
  const settled = settleType1(totalCents, null, 0, { commissionRate });
  const baseYuan = settled.baseCents / 100
  const holdCents = totalCents - settled.commissionCents - settled.baseCents

  const { data: paid } = await supabase
    .from('wallet_logs')
    .select('id')
    .eq('order_id', contractId)
    .eq('type', 'satisfaction_base')
    .limit(1)
  if (!paid || paid.length === 0) {
    await ensureWallet(supabase, contract.provider_id)
    const before = await getWalletBalance(supabase, contract.provider_id)
    const after = Math.round((before + baseYuan) * 100) / 100
    const { error: creditError } = await supabase
      .from('provider_wallets')
      .update({ balance: after, updated_at: new Date().toISOString() })
      .eq('provider_id', contract.provider_id)
    if (creditError) throw creditError
    const { error: logError } = await supabase.from('wallet_logs').insert({
      provider_id: contract.provider_id,
      amount: baseYuan,
      type: 'satisfaction_base',
      order_id: contractId,
      description: `确认即释 base: 合同 ${contractId} ¥${baseYuan}`,
    })
    if (logError) throw logError
    const commission = settled.commissionCents / 100
    if (commission > 0) {
      const { error: commissionError } = await supabase.from('transactions').insert({
        user_id: contract.provider_id,
        type: 'COMMISSION',
        amount: -commission,
        balance_before: before,
        balance_after: after,
        description: `确认即释: 合同 ${contractId} 平台佣金¥${commission}`,
      })
      if (commissionError) throw commissionError
    }
  }

  // 勾池建行（唯一约束防重放；已存在即复用）。
  await supabase.from('satisfaction_holds').upsert(
    {
      contract_id: contractId,
      provider_id: contract.provider_id,
      hold_cents: holdCents,
      base_cents: settled.baseCents,
    },
    { onConflict: 'contract_id' },
  )

  await addContractEvent({
    contractId,
    actorId: contract.provider_id,
    fromStatus: 'SATISFACTION_HELD',
    toStatus: 'SATISFACTION_HELD',
    action: 'release_base',
    reason: `确认即释 base¥${baseYuan}，勾池¥${holdCents / 100}待批量`,
  })

  return { released: true, providerNetCents: settled.baseCents }
}

/** 确保钱包行存在（转入前置，幂等）。 */
async function ensureWallet(supabase: ReturnType<typeof getServiceClient>, providerId: string): Promise<void> {
  const { data } = await supabase
    .from('provider_wallets')
    .select('provider_id')
    .eq('provider_id', providerId)
    .single()
  if (!data) {
    const { error } = await supabase
      .from('provider_wallets')
      .insert({ provider_id: providerId, balance: 0 })
    if (error) throw error
  }
}

async function getWalletBalance(supabase: ReturnType<typeof getServiceClient>, providerId: string): Promise<number> {
  const { data } = await supabase
    .from('provider_wallets')
    .select('balance')
    .eq('provider_id', providerId)
    .single()
  return Number((data as { balance?: number } | null)?.balance ?? 0)
}

/**
 * P4 批量触发判定（纯函数，考卷锁定）：持有数 ≥ N 或最早持有龄 ≥ T 天。
 */
export function isBatchDue(
  holdCount: number,
  oldestCreatedAtMs: number,
  nowMs: number,
  minCount: number,
  maxAgeDays: number,
): boolean {
  if (!Number.isInteger(holdCount) || holdCount <= 0) return false
  if (holdCount >= minCount) return true
  if (!Number.isFinite(oldestCreatedAtMs) || !Number.isFinite(nowMs)) return false
  return nowMs - oldestCreatedAtMs >= maxAgeDays * 24 * 3600_000
}

export interface SatisfactionBatchItem {
  providerId: string
  contracts: number
  amountCents: number
  hooksPassed: number
  hooksTotal: number
}

/**
 * P4 双钟表之二：15% 批量结算（用户裁决 2026-09-18：N=10 单 / T=7 天先到触发）。
 * 窗过（held_at+72h）且未释放的 hold 按师傅分组，到触发线即整组结算：
 * 按勾释放→钱包＋留痕，未释勾→质管罚没（transactions QUALITY_FORFEIT）；
 * 合同逐个 SETTLED＋事件＋信用；评价随批量同步解密（聚合＋单条）；写批次行。
 * P1 互斥延续：结算前复查 demand 侧（后放款竞态）→ 命中则跳过记账只推状态。
 */
export async function settleSatisfactionBatch(
  nowMs: number = Date.now(),
  minCount?: number,
  maxAgeDays?: number,
): Promise<SatisfactionBatchItem[]> {
  const supabase = getServiceClient()
  let n = minCount
  let t = maxAgeDays
  try {
    const cfg = (await getConfig()).fees.batchRelease
    n ??= cfg.minCount
    t ??= cfg.maxAgeDays
  } catch {
    /* 配置缺席回落裁决值 */
  }
  n ??= 10
  t ??= 7

  const { data: holds } = await supabase
    .from('satisfaction_holds')
    .select('contract_id, provider_id, hold_cents, created_at')
    .eq('released', false)
    .order('created_at', { ascending: true })
    .limit(500)
  const rows = ((holds ?? []) as {
    contract_id: string; provider_id: string; hold_cents: number; created_at: string
  }[]).filter((h) => nowMs - Date.parse(h.created_at) >= 72 * 3600_000)
  if (rows.length === 0) return []

  const byProvider = new Map<string, typeof rows>()
  for (const h of rows) {
    const arr = byProvider.get(h.provider_id) ?? []
    arr.push(h)
    byProvider.set(h.provider_id, arr)
  }

  const out: SatisfactionBatchItem[] = []
  for (const [providerId, arr] of byProvider) {
    const oldest = Math.min(...arr.map((h) => Date.parse(h.created_at)))
    if (!isBatchDue(arr.length, oldest, nowMs, n, t)) continue

    let amountCents = 0
    let hooksPassed = 0
    let hooksTotal = 0
    let contracts = 0
    const batchId = crypto.randomUUID()
    const revealedContracts: string[] = []

    for (const h of arr) {
      try {
        const { data: contract } = await supabase
          .from('contracts')
          .select('customer_id, demand_id, protocol_id')
          .eq('id', h.contract_id)
          .single()
        if (!contract) continue
        // P1 复查：demand 侧后放款竞态 → 跳过记账。
        let skipPayout = false
        const demandId = (contract as { demand_id?: string | null }).demand_id
        if (demandId) {
          const { data: demand } = await supabase
            .from('demands')
            .select('released_at')
            .eq('id', demandId)
            .single()
          if ((demand as { released_at?: string | null } | null)?.released_at != null) {
            skipPayout = true
          }
        }

        // 评价口径：已提交行按勾，无提交全返（blind 只管展示，不管钱）。
        let pass: SubjectiveChecks | null = null
        let passedCount: number | null = null
        try {
          const { data: reviewRows } = await supabase
            .from('order_reviews')
            .select('checks, has_after_photo, passed_count')
            .eq('contract_id', h.contract_id)
            .eq('reviewer_id', (contract as { customer_id: string }).customer_id)
            .limit(1)
          const row = ((reviewRows ?? []) as {
            checks: unknown; has_after_photo: boolean | null; passed_count: number | null
          }[])[0]
          if (row && isSubjectiveChecks(row.checks)) {
            pass = effectiveSubjectivePass({ checks: row.checks, hasAfterPhoto: row.has_after_photo === true })
            passedCount = row.passed_count
          }
        } catch {
          /* 无评价全返 */
        }
        const p = pass ?? { attitude: true, appearance: true, restoration: true }
        const flags = [p.attitude, p.appearance, p.restoration]
        // 勾池按最大余数法还原三勾份额（与方程同语义；hold_cents 即三勾和）。
        const perHook = Math.floor(h.hold_cents / 3)
        const remainder = h.hold_cents - perHook * 3
        const hookShares = [perHook + (remainder > 0 ? 1 : 0), perHook + (remainder > 1 ? 1 : 0), perHook]
        let releasedCents = 0
        flags.forEach((ok, i) => {
          hooksTotal += 1
          if (ok) {
            hooksPassed += 1
            releasedCents += hookShares[i] ?? 0
          }
        })
        const forfeitCents = h.hold_cents - releasedCents

        if (!skipPayout && releasedCents > 0) {
          await ensureWallet(supabase, providerId)
          const before = await getWalletBalance(supabase, providerId)
          const releasedYuan = releasedCents / 100
          const after = Math.round((before + releasedYuan) * 100) / 100
          const { error: creditError } = await supabase
            .from('provider_wallets')
            .update({ balance: after, updated_at: new Date().toISOString() })
            .eq('provider_id', providerId)
          if (creditError) throw creditError
          const { error: logError } = await supabase.from('wallet_logs').insert({
            provider_id: providerId,
            amount: releasedYuan,
            type: 'satisfaction_hold_release',
            order_id: h.contract_id,
            description: `批量释放勾池: 合同 ${h.contract_id} ¥${releasedYuan}（批次 ${batchId.slice(0, 8)}）`,
          })
          if (logError) throw logError
        }
        if (!skipPayout && forfeitCents > 0) {
          const { error: forfeitError } = await supabase.from('transactions').insert({
            user_id: providerId,
            type: 'QUALITY_FORFEIT',
            amount: -(forfeitCents / 100),
            balance_before: 0,
            balance_after: 0,
            description: `批量罚没: 合同 ${h.contract_id} 质管费¥${forfeitCents / 100}（批次 ${batchId.slice(0, 8)}）`,
          })
          if (forfeitError) throw forfeitError
        }

        await supabase
          .from('satisfaction_holds')
          .update({ released: true, batch_id: batchId, released_at: new Date(nowMs).toISOString() })
          .eq('contract_id', h.contract_id)
          .eq('released', false)
        await supabase
          .from('contracts')
          .update({ fund_status: 'SETTLED' })
          .eq('id', h.contract_id)
        await addContractEvent({
          contractId: h.contract_id,
          actorId: providerId,
          fromStatus: 'SATISFACTION_HELD',
          toStatus: 'SETTLED',
          action: 'release_satisfaction',
          reason: skipPayout
            ? `互斥锁跳过记账: 孪生需求单已放款，本侧只推进状态`
            : `批量释放: 实得勾池¥${releasedCents / 100} / 质管费¥${forfeitCents / 100}${passedCount ?? '无评价默认全返'}`,
        })
        // 信用（整单一次，随终局；base 时不重复记）。
        const ev = await appendEvidence({
          protocolId: (contract as { protocol_id?: string }).protocol_id ?? '',
          eventType: 'satisfaction_released',
          payload: {
            contract_id: h.contract_id,
            provider_id: providerId,
            released_cents: releasedCents,
            quality_fee_cents: forfeitCents,
            passed_count: passedCount,
            batch_id: batchId,
          },
        })
        if (ev) {
          await updateCredit({ userId: providerId, eventType: 'completion', evidenceId: ev.id, description: 'Satisfaction batch released' })
        }

        revealedContracts.push(h.contract_id)
        amountCents += releasedCents
        contracts += 1
      } catch {
        /* 单 hold 失败不阻断整批（下轮 cron 重试未释放行） */
      }
    }

    if (contracts === 0) continue
    // 评价随批量同步解密（聚合＋单条；用户裁决：随资金同步显示）。
    if (revealedContracts.length > 0) {
      await supabase
        .from('order_reviews')
        .update({ blind_state: 'revealed' })
        .in('contract_id', revealedContracts)
        .eq('blind_state', 'blind')
    }
    await supabase.from('satisfaction_batches').insert({
      id: batchId,
      provider_id: providerId,
      settled_at: new Date(nowMs).toISOString(),
      contract_count: contracts,
      hooks_total: hooksTotal,
      hooks_passed: hooksPassed,
      amount_cents: amountCents,
    })
    out.push({ providerId, contracts, amountCents, hooksPassed, hooksTotal })
  }
  return out
}

/**
 * 单单释放（R5 · P4 已退役，保留签名防外部误调）。
 * @deprecated 改用 releaseSatisfactionBase（确认即释）＋ settleSatisfactionBatch（批量勾池）。
 */
export async function releaseSatisfactionOrder(
  _contractId: string,
  _nowMs: number = Date.now(),
): Promise<SatisfactionReleaseResult> {
  void _contractId
  void _nowMs
  throw new Error('releaseSatisfactionOrder 已退役（P4 双钟表）：改用 releaseSatisfactionBase + settleSatisfactionBatch')
}
