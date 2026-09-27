import { NextResponse } from "next/server";
import { withAuth } from "@/lib/api-auth";
import { getRouteClient } from "@/lib/supabase-route-client";
import { getServiceClient } from "@/lib/supabase-client";
import {
  checkGuardMembership,
  evaluateSide,
  isValidCoord,
  latestRows,
  truncateCoord,
} from "@/lib/guard-watch";

/**
 * POST /api/guard/breadcrumb（ADR-0022）：
 * 履约双方 60s 节拍上传位置面包屑 / 手动报平安。服务端权威截断坐标 4 位，
 * service client 落 append-only 表；落盘失败 200 降级（persisted:false，
 * 客户端照常重试，宪法 #10）。
 */
export const POST = withAuth(async (req, user) => {
  let body: {
    demandId?: unknown;
    lat?: unknown;
    lng?: unknown;
    accuracyM?: unknown;
    batteryLow?: unknown;
    gpsEnabled?: unknown;
    checkin?: unknown;
  };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "非法请求体" }, { status: 400 });
  }

  const demandId = typeof body.demandId === "string" ? body.demandId.trim() : "";
  if (!demandId) {
    return NextResponse.json({ error: "缺少 demandId" }, { status: 400 });
  }

  const manual = body.checkin === true;
  let lat: number | null = null;
  let lng: number | null = null;
  if (!manual) {
    if (!isValidCoord(body.lat, body.lng)) {
      return NextResponse.json(
        { error: "缺少合法坐标（或传 checkin:true 报平安）" },
        { status: 400 },
      );
    }
    lat = truncateCoord(body.lat);
    lng = truncateCoord(body.lng);
  }

  const accuracyM =
    typeof body.accuracyM === "number" && Number.isFinite(body.accuracyM) && body.accuracyM >= 0
      ? Math.round(body.accuracyM * 10) / 10
      : null;
  const batteryLow = body.batteryLow === true;
  const gpsEnabled =
    body.gpsEnabled === true ? true : body.gpsEnabled === false ? false : null;

  const route = await getRouteClient();
  const { ok } = await checkGuardMembership(route, demandId, user.id);
  if (!ok) {
    return NextResponse.json({ error: "仅履约双方可上报守护信号" }, { status: 403 });
  }

  const svc = getServiceClient();
  const nowMs = Date.now();
  const row = {
    demand_id: demandId,
    reporter_id: user.id,
    lat,
    lng,
    accuracy_m: accuracyM,
    battery_low: batteryLow,
    gps_enabled: gpsEnabled,
    checkin: manual,
  };

  let persisted = true;
  try {
    const { error } = await (svc.from("guard_breadcrumbs") as unknown as {
      insert: (r: typeof row) => Promise<{ error: unknown }>;
    }).insert(row);
    if (error) persisted = false;
  } catch {
    persisted = false;
  }

  // 双边评估：自己以本次上报为准（落盘失败则回退既有最新），对方取既有最新。
  const rows = await latestRows(svc, demandId);
  const peerRow = rows.find((r) => r.reporter_id !== user.id) ?? null;
  const selfRow = persisted
    ? {
        reporter_id: user.id,
        lat,
        lng,
        accuracy_m: accuracyM,
        battery_low: batteryLow,
        gps_enabled: gpsEnabled,
        checkin: manual,
        created_at: new Date(nowMs).toISOString(),
      }
    : (rows.find((r) => r.reporter_id === user.id) ?? null);

  return NextResponse.json(
    {
      ok: true,
      persisted,
      self: evaluateSide(selfRow, nowMs),
      peer: evaluateSide(peerRow, nowMs),
      serverNow: nowMs,
    },
    { status: 200 },
  );
});
