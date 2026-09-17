import { NextResponse } from "next/server";
import { withAuth } from "@/lib/api-auth";
import { getServiceClient } from "@/lib/supabase-client";

// R9（用户裁决 2026-09-18）：view_admin_stats 表与视图皆不存在，驾驶舱数字改由
// 本服务端路由聚合（ADMIN 门禁＋service 直读），口径与客户端原 anomaly 逻辑对齐：
// active=在途 demands(OPEN/STARTED)，completed=终局 contracts(SETTLED)，
// anomaly=滞留超 2h 的 STARTED demands（与客户端 anomaly 列表同口径）。
export const GET = withAuth(async (_req: Request, user) => {
  const svc = getServiceClient();
  const { data: profile } = await svc
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .maybeSingle();
  if ((profile as { role?: string } | null)?.role !== "ADMIN") {
    return NextResponse.json({ error: "无权访问" }, { status: 403 });
  }

  const [{ count: active }, { count: completed }, { data: stale }] = await Promise.all([
    svc.from("demands").select("id", { count: "exact", head: true }).in("status", ["OPEN", "STARTED"]),
    svc.from("contracts").select("id", { count: "exact", head: true }).eq("fund_status", "SETTLED"),
    svc.from("demands").select("id").eq("status", "STARTED")
      .lt("updated_at", new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString()),
  ]);

  return NextResponse.json({
    active_count: active ?? 0,
    completed_count: completed ?? 0,
    anomaly_count: (stale ?? []).length,
  });
});
