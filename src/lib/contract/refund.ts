import { getServiceClient } from "@/lib/supabase-client"

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

    const { data: guarantor } = await supabase
      .from('profiles')
      .select('balance')
      .eq('id', link.guarantor_id)
      .single()

    const actualDeduct = Math.min(
      deductAmount,
      Math.max(0, (guarantor?.balance ?? 0)),
    )
    if (actualDeduct <= 0) continue

    const newBalance = (guarantor?.balance ?? 0) - actualDeduct
    await supabase
      .from('profiles')
      .update({ balance: newBalance })
      .eq('id', link.guarantor_id)

    await supabase.from('transactions').insert({
      user_id: link.guarantor_id,
      type: 'GUARANTEE_DEDUCTION',
      amount: -actualDeduct,
      balance_before: guarantor?.balance ?? 0,
      balance_after: newBalance,
      description: `连带担保扣款: 合同 ${contractId} 服务商缺额 ¥${shortfall}, 担保人扣 ¥${actualDeduct}`,
    })

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
    const { data: customer } = await supabase
      .from('profiles')
      .select('balance')
      .eq('id', customerId)
      .single()

    if (!customer || (customer.balance ?? 0) < refund.customer) {
      throw new Error(`客户余额不足: 当前余额 ${customer?.balance ?? 0}, 需退款 ${refund.customer}`)
    }

    const newBalance = (customer.balance ?? 0) + refund.customer
    const { error: updateError } = await supabase
      .from('profiles')
      .update({ balance: newBalance })
      .eq('id', customerId)
    if (updateError) throw updateError

    const { error: txError } = await supabase
      .from('transactions')
      .insert({
        user_id: customerId,
        type,
        amount: refund.customer,
        balance_before: customer.balance ?? 0,
        balance_after: newBalance,
        description: `${type === "REFUND" ? "取消退款" : "争议退款"}: 合同 ${contractId} 退¥${refund.customer}`,
      })
    if (txError) throw txError
  }

  if (refund.provider > 0) {
    const { data: provider } = await supabase
      .from('profiles')
      .select('balance')
      .eq('id', providerId)
      .single()

    const providerBalance = provider?.balance ?? 0
    if (providerBalance < refund.provider) {
      const shortfall = refund.provider - providerBalance
      await applyJointGuarantee(supabase, providerId, shortfall, contractId)
    }

    const newProviderBalance = providerBalance + refund.provider
    const { error: updateError } = await supabase
      .from('profiles')
      .update({ balance: newProviderBalance })
      .eq('id', providerId)
    if (updateError) throw updateError

    const { error: txError } = await supabase
      .from('transactions')
      .insert({
        user_id: providerId,
        type,
        amount: refund.provider,
        balance_before: providerBalance,
        balance_after: newProviderBalance,
        description: `${type === "REFUND" ? "取消服务费" : "争议服务费"}: 合同 ${contractId} 得¥${refund.provider}`,
      })
    if (txError) throw txError
  }
}
