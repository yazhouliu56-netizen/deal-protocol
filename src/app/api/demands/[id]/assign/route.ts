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
      { reason: "�����ˣ������ѱ�����ʦ���ӵ�" },
      { status: 400 },
    )
  }

  // P6 ETA 快照锁定（平台预估，不可操纵；失败不阻断接单，取消时回落档默认）。
  try {
    const { getConfig } = await import("@/lib/platform/config")
    const cfg = await getConfig()
    const row = (updated[0] ?? {}) as { city_tier?: number }
    const tier = row.city_tier === 1 ? "tier1" : row.city_tier === 3 ? "tier3" : "tier2"
    const etaMin = cfg.fees.cancelBenchmark?.[tier]?.etaMin ?? 25
    await supabase
      .from("demands")
      .update({ estimated_arrival_min: etaMin, assigned_at: new Date().toISOString(), city_tier: row.city_tier ?? 2 })
      .eq("id", demandId)
  } catch {
    /* ETA 快照失败不阻断接单 */
  }

  return NextResponse.json({ success: true }, { status: 200 })
})
