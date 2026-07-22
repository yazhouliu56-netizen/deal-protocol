import { NextResponse } from "next/server"
import { withAuth } from "@/lib/api-auth"
import { getServiceClient } from "@/lib/supabase-client"

export const POST = withAuth(async (req, user) => {
  const { amount, channel, accountInfo } = await req.json()

  if (!amount || typeof amount !== "number" || amount <= 0 || !channel || !accountInfo) {
    return NextResponse.json({ error: "Invalid parameters" }, { status: 400 })
  }

  const svc = getServiceClient()

  const { data, error } = await svc.rpc("submit_withdrawal_request", {
    p_amount: amount,
    p_channel: channel,
    p_account_info: accountInfo,
  })

  if (error || !data || !data.success) {
    return NextResponse.json(
      { error: data?.error || error?.message || "Transaction failed" },
      { status: 400 },
    )
  }

  return NextResponse.json({ success: true, requestId: data.request_id })
})
