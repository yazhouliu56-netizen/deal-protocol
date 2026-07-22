import { NextResponse } from "next/server"
import { withAuth } from "@/lib/api-auth"
import { getServiceClient } from "@/lib/supabase-client"

export const POST = withAuth(async (req, user) => {
  const svc = getServiceClient()

  const { data: profile } = await svc
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single()

  if (!profile || profile.role !== "ADMIN") {
    return NextResponse.json({ error: "Forbidden: Admin access required" }, { status: 403 })
  }

  const { orderId, action } = await req.json()
  if (!orderId || !["refund", "force_settle"].includes(action)) {
    return NextResponse.json({ error: "Invalid parameters" }, { status: 400 })
  }

  const { data: demand, error: demandError } = await svc
    .from("demands")
    .select("id, title, price, status, client_id, matched_provider_id")
    .eq("id", orderId)
    .single()

  if (demandError || !demand) {
    return NextResponse.json({ error: "Order not found" }, { status: 404 })
  }

  if (action === "refund") {
    const { error: updateError } = await svc
      .from("demands")
      .update({ status: "refunded" })
      .eq("id", orderId)

    if (updateError) {
      return NextResponse.json({ error: "Failed to refund order" }, { status: 500 })
    }

    await svc
      .from("order_disputes")
      .update({ status: "refunded" })
      .eq("order_id", orderId)

    return NextResponse.json({ success: true, message: "Arbitration: Escrow fully refunded to customer." })
  }

  if (action === "force_settle") {
    if (!demand.matched_provider_id) {
      return NextResponse.json({ error: "No provider assigned to this order" }, { status: 400 })
    }

    const totalAmount = demand.price ?? 0
    const platformFee = Math.round(totalAmount * 0.10 * 100) / 100
    const providerNet = Math.round((totalAmount - platformFee) * 100) / 100

    const { error: orderUpdateErr } = await svc
      .from("demands")
      .update({ status: "settled" })
      .eq("id", orderId)

    if (orderUpdateErr) {
      return NextResponse.json({ error: "Failed to settle order" }, { status: 500 })
    }

    await svc
      .from("order_disputes")
      .update({ status: "force_settled" })
      .eq("order_id", orderId)

    const { data: wallet, error: walletFetchErr } = await svc
      .from("provider_wallets")
      .select("balance")
      .eq("provider_id", demand.matched_provider_id)
      .single()

    if (walletFetchErr || !wallet) {
      await svc.from("demands").update({ status: "completed" }).eq("id", orderId)
      await svc.from("order_disputes").update({ status: "pending" }).eq("order_id", orderId)
      return NextResponse.json({ error: "Provider wallet not found, rolled back" }, { status: 500 })
    }

    const newBalance = Math.round((Number(wallet.balance) + providerNet) * 100) / 100

    const { error: walletUpdateErr } = await svc
      .from("provider_wallets")
      .update({ balance: newBalance, updated_at: new Date().toISOString() })
      .eq("provider_id", demand.matched_provider_id)

    if (walletUpdateErr) {
      await svc.from("demands").update({ status: "completed" }).eq("id", orderId)
      await svc.from("order_disputes").update({ status: "pending" }).eq("order_id", orderId)
      return NextResponse.json({ error: "Wallet update failed, transaction rolled back" }, { status: 500 })
    }

    const logs = [
      {
        provider_id: demand.matched_provider_id,
        amount: providerNet,
        type: "payout",
        order_id: orderId,
        description: `Arbitration force payout for order ${orderId}`,
      },
      {
        provider_id: demand.matched_provider_id,
        amount: -platformFee,
        type: "platform_fee",
        order_id: orderId,
        description: `Arbitration platform 10% fee extraction for order ${orderId}`,
      },
    ]

    await svc.from("wallet_logs").insert(logs)

    return NextResponse.json({ success: true, message: "Arbitration: Funds split and transferred to provider wallet." })
  }

  return NextResponse.json({ error: "Unhandled operation" }, { status: 400 })
})
