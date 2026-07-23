import { NextResponse } from "next/server"
import { withAuth } from "@/lib/api-auth"
import { getRouteClient } from "@/lib/supabase-route-client"
import { DEMAND_STATUSES } from "@/lib/demand/state"

export const POST = withAuth(async (req, user, ...args) => {
  const demandId = (await (args[0] as { params: Promise<{ id: string }> }).params).id
  const providerId = user.id
  const supabase = await getRouteClient()

  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("verification_status")
    .eq("id", providerId)
    .single()

  if (profileError) {
    return NextResponse.json({ error: "查询用户信息失败" }, { status: 500 })
  }

  if (profile.verification_status !== "approved") {
    return NextResponse.json(
      { reason: "抢单失败：请先完成实名身份验证！" },
      { status: 403 },
    )
  }

  const { data: updated, error } = await supabase
    .from("demands")
    .update({
      status: DEMAND_STATUSES.ASSIGNED,
      matched_provider_id: providerId,
    })
    .eq("id", demandId)
    .eq("status", DEMAND_STATUSES.OPEN)
    .select()

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  if (!updated || updated.length === 0) {
    return NextResponse.json(
      { reason: "手慢了，订单已被其他师傅接到" },
      { status: 400 },
    )
  }

  return NextResponse.json({ success: true }, { status: 200 })
})
