import { NextResponse } from "next/server"
import { withAuth } from "@/lib/api-auth"
import { getRouteClient } from "@/lib/supabase-route-client"
import { DEMAND_STATUSES } from "@/lib/demand/state"

const STATE_TRANSITIONS: Record<string, string> = {
  [DEMAND_STATUSES.DEPARTED]: DEMAND_STATUSES.ASSIGNED,
  [DEMAND_STATUSES.ARRIVED]: DEMAND_STATUSES.DEPARTED,
  [DEMAND_STATUSES.STARTED]: DEMAND_STATUSES.ARRIVED,
  [DEMAND_STATUSES.COMPLETED]: DEMAND_STATUSES.STARTED,
}

export const PATCH = withAuth(async (req, user, ...args) => {
  const demandId = (await (args[0] as { params: Promise<{ id: string }> }).params).id
  const body = await req.json()
  const { nextStatus, imageUrls } = body
  const providerId = user.id

  if (!nextStatus) {
    return NextResponse.json({ error: "参数不完整" }, { status: 400 })
  }

  const expectedCurrentStatus = STATE_TRANSITIONS[nextStatus]
  if (!expectedCurrentStatus) {
    return NextResponse.json({ error: "非法的目标流转状态" }, { status: 400 })
  }

  if (nextStatus === DEMAND_STATUSES.COMPLETED && (!imageUrls || imageUrls.length < 2)) {
    return NextResponse.json({ error: "未能通过合规校验：必须提供至少2张完工凭证" }, { status: 400 })
  }

  const supabase = await getRouteClient()
  const updatePayload: Record<string, unknown> = { status: nextStatus }
  if (nextStatus === DEMAND_STATUSES.COMPLETED) {
    updatePayload.certificate_images = imageUrls
  }

  const { data: updated, error } = await supabase
    .from("demands")
    .update(updatePayload)
    .eq("id", demandId)
    .eq("status", expectedCurrentStatus)
    .eq("matched_provider_id", providerId)
    .select()

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  if (!updated || updated.length === 0) {
    return NextResponse.json(
      { error: "状态流转冲突：订单可能已被取消或状态已发生变更" },
      { status: 409 },
    )
  }

  return NextResponse.json({ success: true, updatedStatus: nextStatus })
})
