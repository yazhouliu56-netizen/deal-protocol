import { NextResponse } from "next/server";
import { withAuth } from "@/lib/api-auth";
import { getRouteClient } from "@/lib/supabase-route-client";
import { getServiceClient } from "@/lib/supabase-client";
import { DEMAND_STATUSES } from "@/lib/demand/state";
import { computeEvidenceHash } from "@/base/safe/evidence-chain";

/**
 * POST /api/demands/[id]/confirm-arrival（R-0928-08 A 档双确认）：
 * 需求方确认师傅已到。双方确认（服务者已推进 ARRIVED＋需求方本接口）即
 * 到达握手完成；ENHANCED 武装单落 RECORDING_AUTOSTART 锚（授权换不可逆，
 * 期间任一方关不掉；麦克风首次举起仍需用户手势，浏览器铁律）。
 * 幂等：已确认重复调回 {already:true}。
 */
export const POST = withAuth(async (req, user, ...args) => {
  const demandId = (await (args[0] as { params: Promise<{ id: string }> }).params).id;
  const supabase = await getRouteClient();
  const svc = getServiceClient();

  const { data: demandRow } = await supabase
    .from("demands")
    .select("id, demander_id, matched_provider_id, status, title, timeslot_start, timeslot_end, arrival_confirmed_at")
    .eq("id", demandId)
    .single();
  const demand = demandRow as {
    demander_id?: string;
    matched_provider_id?: string | null;
    status?: string;
    title?: string;
    arrival_confirmed_at?: string | null;
  } | null;

  if (!demand) {
    return NextResponse.json({ error: "订单不存在" }, { status: 404 });
  }
  if (demand.demander_id !== user.id) {
    return NextResponse.json({ error: "仅需求方可确认到达" }, { status: 403 });
  }
  if (demand.status !== DEMAND_STATUSES.ARRIVED) {
    return NextResponse.json(
      { error: "需服务者先推进到已到现场", code: "NOT_ARRIVED" },
      { status: 409 },
    );
  }
  if (demand.arrival_confirmed_at) {
    return NextResponse.json({ ok: true, already: true, autoRecord: false }, { status: 200 });
  }

  const nowIso = new Date().toISOString();
  const { error: upErr } = await supabase
    .from("demands")
    .update({ arrival_confirmed_at: nowIso })
    .eq("id", demandId)
    .eq("demander_id", user.id);
  if (upErr) {
    return NextResponse.json({ error: upErr.message }, { status: 500 });
  }

  // 武装重算（与接单同口径：首单＋小时＋入户集群）。
  let firstOrder = false;
  let cluster: string | undefined;
  try {
    const { data: prior } = await svc
      .from("contracts")
      .select("id")
      .eq("provider_id", demand.matched_provider_id ?? "")
      .limit(1);
    firstOrder = !prior || (prior as unknown[]).length === 0;
  } catch {
    /* 回落 standard */
  }
  try {
    const { getAmmoById, resolveAmmoByFreeText } = await import("@/ammo/registry");
    const hit = resolveAmmoByFreeText(String(demand.title ?? ""));
    if (hit) cluster = getAmmoById(hit.ammoId).supplyCluster;
  } catch {
    /* 非入户处理 */
  }
  const { evaluateMeetupArming } = await import("@/base/safe/meetup-guard");
  const arming = evaluateMeetupArming({
    isFirstOrder: firstOrder,
    hourOfDay: new Date().getHours(),
    homeAccess: cluster === "C2_IN_HOME",
  });

  // A 档（ENHANCED）：落 auto-start 锚（best-effort，不阻断确认）。
  let anchored = false;
  let autoRecord = false;
  if (arming.level === "ENHANCED") {
    autoRecord = true;
    try {
      const timestamp = new Date().toISOString();
      const payload = { demandId, tier: "A", by: "bilateral-arrival", providerId: demand.matched_provider_id ?? null };
      const hash = computeEvidenceHash(demandId, "RECORDING_AUTOSTART", payload, "GENESIS", timestamp);
      const { error } = await (svc.from("evidence_log") as unknown as {
        insert: (row: Record<string, unknown>) => Promise<{ error: { message: string } | null }>;
      }).insert({
        order_id: null,
        event_type: "RECORDING_AUTOSTART",
        payload,
        payload_ref: null,
        captured_by: user.id,
        hash,
        prev_hash: "GENESIS",
      });
      anchored = !error;
    } catch {
      anchored = false;
    }
  }

  return NextResponse.json({ ok: true, autoRecord, anchored, guard: arming }, { status: 200 });
});
