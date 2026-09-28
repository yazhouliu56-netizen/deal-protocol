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
    .select("id, demander_id, title, timeslot_start, timeslot_end")
    .eq("id", demandId)
    .single()
  const demand = demandRow as { demander_id?: string; title?: string; timeslot_start?: string | null; timeslot_end?: string | null } | null

  // R-0928-12 撞单保护（供给方重复占时段，判供给方担责）：新单带时段且与
  // 该服务者任一在途/预约单重叠 → 409（查询异常放行，见 R1 注释同惯例）。
  if (demand?.timeslot_start && demand?.timeslot_end) {
    try {
      const { hasSlotConflict, BOOKED_ACTIVE_STATUSES } = await import("@/lib/demand/booking")
      const { data: active } = await svc
        .from("demands")
        .select("timeslot_start, timeslot_end")
        .eq("matched_provider_id", providerId)
        .in("status", [...BOOKED_ACTIVE_STATUSES])
      const rows = ((active ?? []) as { timeslot_start: string | null; timeslot_end: string | null }[])
      if (
        hasSlotConflict(rows, {
          timeslot_start: demand.timeslot_start,
          timeslot_end: demand.timeslot_end,
        })
      ) {
        return NextResponse.json(
          { reason: "接单失败：该时段已有履约单（撞单保护），请先完成或取消已有订单", code: "SLOT_CONFLICT" },
          { status: 409 },
        )
      }
    } catch {
      /* 查询异常放行 */
    }
  }

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

  // 见面武装输入（首单＋入户；失败回落 standard，通知包兜底感知）。
  let firstOrder = false
  let cluster: string | undefined
  try {
    const { data: prior } = await svc
      .from("contracts")
      .select("id")
      .eq("provider_id", providerId)
      .limit(1)
    firstOrder = !prior || (prior as unknown[]).length === 0
  } catch {
    /* 回落 standard */
  }
  try {
    const { getAmmoById, resolveAmmoByFreeText } = await import("@/ammo/registry")
    const hit = resolveAmmoByFreeText(String(demand?.title ?? ""))
    if (hit) cluster = getAmmoById(hit.ammoId).supplyCluster
  } catch {
    /* 解析失败按非入户处理 */
  }
  const { evaluateMeetupArming } = await import("@/base/safe/meetup-guard")
  const arming = evaluateMeetupArming({
    isFirstOrder: firstOrder,
    hourOfDay: new Date().getHours(),
    homeAccess: cluster === "C2_IN_HOME",
  })

  // R-0928-12：预约单可提前接（锁定时段，撞单门已在上游执行）。
  const { data: updated, error } = await supabase
    .from("demands")
    .update({
      status: DEMAND_STATUSES.ASSIGNED,
      matched_provider_id: providerId,
    })
    .eq("id", demandId)
    .in("status", [DEMAND_STATUSES.OPEN, DEMAND_STATUSES.BOOKED])
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
  // 夜单只进响应武装位（本地横幅＋隐私会话），不推通知（防夜间高频打扰）。
  try {
    const { meetupSafetyPackage } = await import("@/lib/gang-rules")
    const pack = meetupSafetyPackage({ isFirstOrder: firstOrder, supplyCluster: cluster })
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

  return NextResponse.json(
    {
      success: true,
      demanderId: demand?.demander_id ?? null,
      meetupGuard: arming,
    },
    { status: 200 },
  )
})
