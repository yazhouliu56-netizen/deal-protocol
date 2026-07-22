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
    .select("id, price, status, client_id")
    .eq("id", orderId)
    .single()

  if (demandError || !demand) {
    return NextResponse.json({ error: "订单不存在" }, { status: 404 })
  }

  if (demand.client_id !== user.id) {
    return NextResponse.json({ error: "无权操作此订单" }, { status: 403 })
  }

  if (demand.status !== "ASSIGNED") {
    return NextResponse.json({ error: "当前订单状态不可支付" }, { status: 400 })
  }

  const { error: updateError } = await supabase
    .from("demands")
    .update({ status: "paid_escrow" })
    .eq("id", orderId)
    .eq("status", "ASSIGNED")

  if (updateError) {
    return NextResponse.json({ error: "支付失败，请稍后重试" }, { status: 500 })
  }

  return NextResponse.json({ success: true })
})
