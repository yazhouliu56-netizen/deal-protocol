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
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  const { requestId, action } = await req.json()
  if (!requestId || !["approve", "reject"].includes(action)) {
    return NextResponse.json({ error: "Invalid parameters" }, { status: 400 })
  }

  const { data: withdrawal, error: fetchErr } = await svc
    .from("withdrawal_requests")
    .select("*")
    .eq("id", requestId)
    .single()

  if (fetchErr || !withdrawal || withdrawal.status !== "pending") {
    return NextResponse.json(
      { error: "Request not found or already processed" },
      { status: 404 },
    )
  }

  if (action === "approve") {
    const { error: appErr } = await svc
      .from("withdrawal_requests")
      .update({ status: "approved", updated_at: new Date().toISOString() })
      .eq("id", requestId)

    if (appErr) {
      return NextResponse.json({ error: appErr.message }, { status: 500 })
    }

    // P8 提现通道费（从到账扣，微信提现同逻辑；服务端重算，不信任客户端）。
    let feeDesc = ""
    try {
      const { getConfig } = await import("@/lib/platform/config")
      const { withdrawFee } = await import("@/lib/channel-fee")
      const cfg = await getConfig()
      const gross = Number(withdrawal.amount) || 0
      const r = withdrawFee(
        String(withdrawal.channel ?? "ALIPAY").toUpperCase(),
        gross,
        cfg.fees.channelRates?.alipay ?? 0,
        cfg.fees.withdrawBankFlat ?? 2,
      )
      if (r.fee > 0) {
        const { error: feeError } = await svc.from("transactions").insert({
          user_id: withdrawal.provider_id,
          type: "WITHDRAW_FEE",
          amount: -r.fee,
          balance_before: 0,
          balance_after: 0,
          description: `提现通道费: 单 ${requestId} 提现¥${gross}，${r.desc}，实付¥${r.net}`,
        })
        if (feeError) throw feeError
        feeDesc = `，通道费¥${r.fee}（${r.desc}），实付¥${r.net}`
      }
    } catch (e) {
      console.warn("[withdraw/review] fee posting skipped:", e instanceof Error ? e.message : e)
    }

    await svc.from("wallet_logs").insert({
      provider_id: withdrawal.provider_id,
      amount: 0,
      type: "withdrawal_payout",
      description: `Withdrawal request ${requestId} cleared and successfully paid out via ${withdrawal.channel}${feeDesc}`,
    })

    return NextResponse.json({ success: true, message: "Cleared successfully." })
  }

  if (action === "reject") {
    const { error: rejErr } = await svc
      .from("withdrawal_requests")
      .update({ status: "rejected", updated_at: new Date().toISOString() })
      .eq("id", requestId)

    if (rejErr) {
      return NextResponse.json({ error: rejErr.message }, { status: 500 })
    }

    const { data: wallet, error: walletFetchErr } = await svc
      .from("provider_wallets")
      .select("balance")
      .eq("provider_id", withdrawal.provider_id)
      .single()

    if (walletFetchErr || !wallet) {
      await svc
        .from("withdrawal_requests")
        .update({ status: "pending" })
        .eq("id", requestId)
      return NextResponse.json(
        { error: "Rollback transaction failed, state conserved." },
        { status: 500 },
      )
    }

    const rolledBackBalance =
      Math.round((Number(wallet.balance) + Number(withdrawal.amount)) * 100) / 100

    const { error: rollErr } = await svc
      .from("provider_wallets")
      .update({ balance: rolledBackBalance, updated_at: new Date().toISOString() })
      .eq("provider_id", withdrawal.provider_id)

    if (rollErr) {
      await svc
        .from("withdrawal_requests")
        .update({ status: "pending" })
        .eq("id", requestId)
      return NextResponse.json(
        { error: "Rollback transaction failed, state conserved." },
        { status: 500 },
      )
    }

    await svc.from("wallet_logs").insert({
      provider_id: withdrawal.provider_id,
      amount: withdrawal.amount,
      type: "withdrawal_refund",
      description: `Withdrawal request ${requestId} rejected. Frozen funds refunded back to balance.`,
    })

    return NextResponse.json({ success: true, message: "Rejected and funds safely returned." })
  }

  return NextResponse.json({ error: "Unhandled action" }, { status: 400 })
})
