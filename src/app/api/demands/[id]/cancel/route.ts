import { NextResponse } from "next/server";
import { withAuth } from "@/lib/api-auth";
import { getServiceClient } from "@/lib/supabase-client";
import { voidUnmatchedDemand } from "@/lib/demand/unmatched";

/**
 * P5b 未匹配取消（用户裁决 2026-09-18）。
 * 仅 OPEN 且无人接单可取消 → CANCELLED＋定制作废（发布费不退／未收作废）。
 * 已接单（ASSIGNED 起）→ 409，按 P6 取消补偿规则走。
 */
export const POST = withAuth(async (req, user, ...args) => {
  const { id } = await (args[0] as { params: Promise<{ id: string }> }).params;
  const svc = getServiceClient();

  const { data: demand } = await svc
    .from("demands")
    .select("id, status, demander_id, client_id, customer_id, matched_provider_id, fee_status")
    .eq("id", id)
    .single();
  const d = demand as {
    id: string; status: string; demander_id: string; client_id: string;
    customer_id: string; matched_provider_id: string | null; fee_status?: string;
  } | null;
  if (!d) return NextResponse.json({ error: "需求不存在" }, { status: 404 });
  const isOwner = d.demander_id === user.id || d.client_id === user.id || d.customer_id === user.id;
  if (!isOwner) return NextResponse.json({ error: "仅发单方可取消" }, { status: 403 });
  if (d.matched_provider_id || (d.status !== "OPEN" && d.status !== "MATCHED")) {
    return NextResponse.json(
      { error: "ORDER_MATCHED_CANCEL_WITH_COMPENSATION", message: "已接单取消按补偿规则执行（P6）" },
      { status: 409 },
    );
  }

  const { error } = await svc
    .from("demands")
    .update({ status: "CANCELLED" })
    .eq("id", id)
    .in("status", ["OPEN", "MATCHED"]);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const r = await voidUnmatchedDemand(svc, { id, fee_status: d.fee_status });
  return NextResponse.json({ success: true, customRefunded: r.customRefunded });
});
