import { NextResponse } from "next/server";
import { withAuth } from "@/lib/api-auth";
import { getRouteClient } from "@/lib/supabase-route-client";
import { getServiceClient } from "@/lib/supabase-client";
import { checkGuardMembership, evaluateSide, latestRows } from "@/lib/guard-watch";

/**
 * GET /api/guard/state?demandId=（ADR-0022）：双边守护状态读取。
 * 双方互相可见（self + peer），无行返回 null（UI 待启动态，不惊扰）。
 */
export const GET = withAuth(async (req, user) => {
  const demandId = new URL(req.url).searchParams.get("demandId")?.trim() ?? "";
  if (!demandId) {
    return NextResponse.json({ error: "缺少 demandId" }, { status: 400 });
  }

  const route = await getRouteClient();
  const { ok } = await checkGuardMembership(route, demandId, user.id);
  if (!ok) {
    return NextResponse.json({ error: "仅履约双方可查看守护状态" }, { status: 403 });
  }

  const svc = getServiceClient();
  const nowMs = Date.now();
  const rows = await latestRows(svc, demandId);
  const selfRow = rows.find((r) => r.reporter_id === user.id) ?? null;
  const peerRow = rows.find((r) => r.reporter_id !== user.id) ?? null;

  return NextResponse.json(
    {
      ok: true,
      self: evaluateSide(selfRow, nowMs),
      peer: evaluateSide(peerRow, nowMs),
      serverNow: nowMs,
    },
    { status: 200 },
  );
});
