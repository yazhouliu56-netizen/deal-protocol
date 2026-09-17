import { getServiceClient } from "@/lib/supabase-client"

type Svc = ReturnType<typeof getServiceClient>

/** R11 双账本统一：读服务商钱包余额（缺行按 0，不自动建——调用方 Freeroll 前先 ensure）。 */
async function getWalletBalance(supabase: Svc, providerId: string): Promise<number> {
  const { data } = await supabase
    .from('provider_wallets')
    .select('balance')
    .eq('provider_id', providerId)
    .single()
  return Number((data as { balance?: number } | null)?.balance ?? 0)
}

/** R11：钱包不存在则建零行（转入前置，幂等）。 */
async function ensureWallet(supabase: Svc, providerId: string): Promise<void> {
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

/** R11：钱包记账＋双写（wallet_logs 动向＋transactions 台账沿用 R9 表）。 */
async function moveWallet(
  supabase: Svc,
  providerId: string,
  delta: number,
  log: { type: string; orderId?: string | null; description: string },
  tx?: { user_id: string; type: string; amount: number; balance_before: number; balance_after: number; description: string },
): Promise<void> {
  await ensureWallet(supabase, providerId)
  const before = await getWalletBalance(supabase, providerId)
  const after = Math.round((before + delta) * 100) / 100
  const { error: updateError } = await supabase
    .from('provider_wallets')
    .update({ balance: after, updated_at: new Date().toISOString() })
    .eq('provider_id', providerId)
  if (updateError) throw updateError
  const { error: logError } = await supabase.from('wallet_logs').insert({
    provider_id: providerId,
    amount: delta,
    type: log.type,
    order_id: log.orderId ?? null,
    description: log.description,
  })
  if (logError) throw logError
  if (tx) {
    const { error: txError } = await supabase.from('transactions').insert({
      ...tx,
      balance_before: before,
      balance_after: after,
    })
    if (txError) throw txError
  }
}

/** P1-04: 担保连带扣款 (§5.10) */
async function applyJointGuarantee(
  supabase: ReturnType<typeof getServiceClient>,
  providerId: string,
  shortfall: number,
  contractId: string,
): Promise<void> {
  const { data: guarantees } = await supabase
    .from('guarantee_links')
    .select('id, guarantor_id, max_liability, stake_amount')
    .eq('guaranteed_id', providerId)
    .eq('status', 'active')
    .limit(3)

  if (!guarantees || guarantees.length === 0) {
    throw new Error(
      `服务商余额不足 (缺 ¥${shortfall}) 且无有效担保人，无法完成退款`,
    )
  }

  let remaining = shortfall
  for (const link of guarantees) {
    if (remaining <= 0) break
    const liabilityCap = Math.min(
      link.max_liability ?? link.stake_amount ?? 0,
      link.stake_amount ?? 0,
    )
    const deductAmount = Math.min(liabilityCap, remaining)
    if (deductAmount <= 0) continue

    const guarantorBefore = await getWalletBalance(supabase, link.guarantor_id)
    const actualDeduct = Math.min(
      deductAmount,
      Math.max(0, guarantorBefore),
    )
    if (actualDeduct <= 0) continue

    await moveWallet(
      supabase,
      link.guarantor_id,
      -actualDeduct,
      {
        type: 'GUARANTEE_DEDUCTION',
        orderId: contractId,
        description: `连带担保扣款: 合同 ${contractId} 服务商缺额 ¥${shortfall}, 担保人扣 ¥${actualDeduct}`,
      },
      {
        user_id: link.guarantor_id,
        type: 'GUARANTEE_DEDUCTION',
        amount: -actualDeduct,
        balance_before: 0,
        balance_after: 0,
        description: `连带担保扣款: 合同 ${contractId} 服务商缺额 ¥${shortfall}, 担保人扣 ¥${actualDeduct}`,
      },
    )

    await supabase
      .from('credit_events')
      .insert({
        user_id: link.guarantor_id,
        dimension: 'integrity',
        previous_score: 0,
        new_score: 0,
        delta: -2,
        reason: `连带责任触发: 担保扣款 ¥${actualDeduct} (合同 ${contractId})`,
        triggered_by: 'system',
      })

    remaining -= actualDeduct
  }

  if (remaining > 0) {
    throw new Error(
      `担保人连带扣款后仍有 ¥${remaining} 缺口，退款不完整`,
    )
  }
}

export async function createRefundTransactions(
  contractId: string,
  customerId: string,
  providerId: string,
  refund: { provider: number; customer: number },
  type: string = "REFUND",
): Promise<void> {
  const supabase = getServiceClient()

  if (refund.customer > 0) {
    // R11：客户退款走钱包账本（语义沿用：先验余额再退；无钱包行按 0，同旧 profiles 缺席即拒）。
    const customerBefore = await getWalletBalance(supabase, customerId)

    if (customerBefore < refund.customer) {
      throw new Error(`客户余额不足: 当前余额 ${customerBefore}, 需退款 ${refund.customer}`)
    }

    await moveWallet(
      supabase,
      customerId,
      refund.customer,
      {
        type,
        orderId: contractId,
        description: `${type === "REFUND" ? "取消退款" : "争议退款"}: 合同 ${contractId} 退¥${refund.customer}`,
      },
      {
        user_id: customerId,
        type,
        amount: refund.customer,
        balance_before: 0,
        balance_after: 0,
        description: `${type === "REFUND" ? "取消退款" : "争议退款"}: 合同 ${contractId} 退¥${refund.customer}`,
      },
    )
  }

  if (refund.provider > 0) {
    const providerBalance = await getWalletBalance(supabase, providerId)
    if (providerBalance < refund.provider) {
      const shortfall = refund.provider - providerBalance
      await applyJointGuarantee(supabase, providerId, shortfall, contractId)
    }

    await moveWallet(
      supabase,
      providerId,
      refund.provider,
      {
        type,
        orderId: contractId,
        description: `${type === "REFUND" ? "取消服务费" : "争议服务费"}: 合同 ${contractId} 得¥${refund.provider}`,
      },
      {
        user_id: providerId,
        type,
        amount: refund.provider,
        balance_before: 0,
        balance_after: 0,
        description: `${type === "REFUND" ? "取消服务费" : "争议服务费"}: 合同 ${contractId} 得¥${refund.provider}`,
      },
    )
  }
}
