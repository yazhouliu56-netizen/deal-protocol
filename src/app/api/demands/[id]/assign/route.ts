import { NextResponse } from "next/server"
import { withAuth } from "@/lib/api-auth"
import { getRouteClient } from "@/lib/supabase-route-client"
import { getServiceClient } from "@/lib/supabase-client"
import { DEMAND_STATUSES } from "@/lib/demand/state"

export const POST = withAuth(async (req, user, ...args) => {
  const demandId = (await (args[0] as { params: Promise<{ id: string }> }).params).id
  const providerId = user.id
  const supabase = await getRouteClient()
  const svc = getServiceClient()

  // P2-b 实名门禁（接单侧）：FULL 或存量宽限（与发单侧同一口径）。
  // 缺列降级：迁移未应用时回落旧 approved 口径（部署偏斜期不断流）。
  {
    const { checkVerificationGate } = await import("@/base/safe/verification")
    const FULL_COLS = "verification_status, phone_verified_at, verification_id_number, face_verified_at, created_at"
    const full = await supabase.from("profiles").select(FULL_COLS).eq("id", providerId).single()
    if (full.error && (full.error.code === "42703")) {
      const base = await supabase.from("profiles").select("verification_status").eq("id", providerId).single()
      if (base.error) {
        return NextResponse.json({ error: "查询用户信息失败" }, { status: 500 })
      }
      if ((base.data as { verification_status?: string } | null)?.verification_status !== "approved") {
        return NextResponse.json(
          { reason: "抢单失败：请先完成实名身份验证！" },
          { status: 403 },
        )
      }
    } else {
      if (full.error) {
        return NextResponse.json({ error: "查询用户信息失败" }, { status: 500 })
      }
      const gate = checkVerificationGate(
        (full.data ?? {}) as Parameters<typeof checkVerificationGate>[0],
        Date.now(),
      )
      if (!gate.allowed) {
        return NextResponse.json(
          { reason: `抢单失败：请先完成实名身份验证！（缺：${gate.missing.join("、")}）`, missing: gate.missing },
          { status: 403 },
        )
      }
    }
  }

  const { data: demandRow } = await supabase
    .from("demands")
    .select("id, demander_id, title")
    .eq("id", demandId)
    .single()
  const demand = demandRow as { demander_id?: string; title?: string } | null

  // R1 互刷环：同对 30 天已结算≥3 → 409（查询异常放行，见库注释）。
  if (demand?.demander_id) {
    const { checkMutualBrushPair } = await import("@/lib/gang-rules")
    const brush = await checkMutualBrushPair(svc, demand.demander_id, providerId, Date.now())
    if (brush.hit) {
      return NextResponse.json(
        { reason: "抢单失败：与该合作方近期交易频繁，请稍后再试", code: "MUTUAL_BRUSH_SUSPECT" },
        { status: 409 },
      )
    }
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

  // 见面安全包：首单或入户（C2）→ 双向安全须知＋metric（零 DDL/UI 改动；失败静默）。
  try {
    const { meetupSafetyPackage } = await import("@/lib/gang-rules")
    const { data: prior } = await svc
      .from("contracts")
      .select("id")
      .eq("provider_id", providerId)
      .limit(1)
    let cluster: string | undefined
    try {
      const { getAmmoById, resolveAmmoByFreeText } = await import("@/ammo/registry")
      const hit = resolveAmmoByFreeText(
        String((updated[0] as { title?: string } | undefined)?.title ?? ""),
      )
      if (hit) cluster = getAmmoById(hit.ammoId).supplyCluster
    } catch {
      /* 解析失败按非入户处理 */
    }
    const pack = meetupSafetyPackage({
      isFirstOrder: !prior || (prior as unknown[]).length === 0,
      supplyCluster: cluster,
    })
    if (pack.send && demand?.demander_id) {
      const tag = pack.reasons.join("＋")
      const tip = `首次合作安全包（${tag}）：①尽量选公共场所见面 ②保持电话畅通 ③先到安全中心完善紧急联系人 ④紧急情况用 SOS 一键报警`
      await svc.from("notifications").insert([
        { user_id: providerId, title: "接单成功 · 安全须知", body: tip, type: "safety" },
        { user_id: demand.demander_id, title: "已接单 · 安全须知", body: tip, type: "safety" },
      ])
      await svc.from("metric_events").insert({
        name: "risk.meetup_safety",
        value: 1,
        tags: { reasons: tag, provider: providerId },
      })
    }
  } catch {
    /* 安全包失败不阻断接单 */
  }

  return NextResponse.json({ success: true }, { status: 200 })
})
