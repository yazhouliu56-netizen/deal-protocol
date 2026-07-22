import { getServiceClient } from "@/lib/supabase-client"

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
