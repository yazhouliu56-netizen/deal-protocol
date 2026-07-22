import { NextResponse } from "next/server"
import { withAuth } from "@/lib/api-auth"
import { getRouteClient } from "@/lib/supabase-route-client"

export const POST = withAuth(async (req, user) => {
  const { orderId } = await req.json()

  if (!orderId) {
    return NextResponse.json({ error: "缺少订单 ID" }, { status: 400 })
  }

  const supabase = await getRouteClient()

  const { data: demand, error: demandError } = await supabase
    .from("demands")
    .select("id, title, price, status, client_id, matched_provider_id")
    .eq("id", orderId)
    .single()

  if (demandError || !demand) {
    return NextResponse.json({ error: "订单不存在" }, { status: 404 })
  }

  if (demand.client_id !== user.id) {
    return NextResponse.json({ error: "仅下单客户可执行放款操作" }, { status: 403 })
  }

  if (demand.status !== "COMPLETED") {
    return NextResponse.json({ error: "当前订单状态不可放款，请等待师傅完成服务" }, { status: 400 })
  }

  if (!demand.matched_provider_id) {
    return NextResponse.json({ error: "未找到服务商信息，放款中断" }, { status: 500 })
  }

  const amount = demand.price ?? 0
  const platformFee = Math.round(amount * 0.10 * 100) / 100
  const providerNet = Math.round((amount - platformFee) * 100) / 100

  const { data: wallet, error: walletError } = await supabase
    .from("provider_wallets")
    .select("balance")
    .eq("provider_id", demand.matched_provider_id)
    .single()

  if (walletError || !wallet) {
    return NextResponse.json({ error: "服务商钱包尚未初始化" }, { status: 500 })
  }

  const newBalance = Math.round((wallet.balance + providerNet) * 100) / 100

  const { data: updatedDemand, error: updateDemandError } = await supabase
    .from("demands")
    .update({ status: "settled" })
    .eq("id", orderId)
    .eq("status", "COMPLETED")
    .select("id")
    .single()

  if (updateDemandError || !updatedDemand) {
    return NextResponse.json({ error: "放款失败，请稍后重试" }, { status: 500 })
  }

  const { error: walletUpdateError } = await supabase
    .from("provider_wallets")
    .update({ balance: newBalance, updated_at: new Date().toISOString() })
    .eq("provider_id", demand.matched_provider_id)

  if (walletUpdateError) {
    await supabase
      .from("demands")
      .update({ status: "COMPLETED" })
      .eq("id", orderId)

    return NextResponse.json({ error: "钱包写入失败，已回滚" }, { status: 500 })
  }

  const logEntries = [
    {
      provider_id: demand.matched_provider_id,
      amount: providerNet,
      type: "payout",
      order_id: orderId,
      description: `订单「${demand.title || orderId.slice(0, 8)}」服务收入分成 ${providerNet} 元`,
    },
    {
      provider_id: demand.matched_provider_id,
      amount: -platformFee,
      type: "platform_fee",
      order_id: orderId,
      description: `订单「${demand.title || orderId.slice(0, 8)}」平台服务费 ${platformFee} 元`,
    },
  ]

  const { error: logError } = await supabase
    .from("wallet_logs")
    .insert(logEntries)

  if (logError) {
    console.warn("wallet_logs 写入失败，但资金已发放:", logError)
  }

  return NextResponse.json({
    success: true,
    payout: providerNet,
    fee: platformFee,
    newBalance,
  })
})
