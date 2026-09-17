import { NextResponse } from "next/server";
import { withAuth } from "@/lib/api-auth";
import { getServiceClient } from "@/lib/supabase-client";
import { appendEvidence } from "@/modules/m11-evidence-log/evidence-chain";
import { updateCredit } from "@/modules/m07-credit/credit-engine";

/**
 * P6 师傅退单（对称：用户取消赔钱，师傅退单赔分）。
 * 仅 ASSIGNED（未出发）可退 → demand 回 OPEN＋matched 清空＋信用 violation 一次。
 * DEPARTED+ 不可退（必须履约或走纠纷）。
 */
export const POST = withAuth(async (req, user, ...args) => {
  const { id } = await (args[0] as { params: Promise<{ id: string }> }).params;
  const svc = getServiceClient();

  const { data: demand } = await svc
    .from("demands")
    .select("id, status, matched_provider_id")
    .eq("id", id)
    .single();
  const d = demand as { id: string; status: string; matched_provider_id: string | null } | null;
  if (!d) return NextResponse.json({ error: "需求不存在" }, { status: 404 });
  if (d.matched_provider_id !== user.id) {
    return NextResponse.json({ error: "仅接单师傅可退单" }, { status: 403 });
  }
  if (d.status !== "ASSIGNED") {
    return NextResponse.json(
      { error: "ORDER_UNASSIGN_NOT_ALLOWED", message: "已出发不可退单（请履约或走纠纷）" },
      { status: 409 },
    );
  }

  const { error } = await svc
    .from("demands")
    .update({ status: "OPEN", matched_provider_id: null, estimated_arrival_min: null, assigned_at: null })
    .eq("id", id)
    .eq("status", "ASSIGNED")
    .eq("matched_provider_id", user.id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // 信用代价：violation 一次（月度累计进 checkCancelPenalty 限单）。
  try {
    const ev = await appendEvidence({
      protocolId: "",
      eventType: "provider_unassign",
      payload: { demand_id: id, provider_id: user.id },
      capturedBy: user.id,
    });
    if (ev) {
      await updateCredit({ userId: user.id, eventType: "violation", evidenceId: ev.id, description: `接单后退单: 需求 ${id}` });
    }
  } catch (e) {
    console.warn("[demands/unassign] credit penalty skipped:", e instanceof Error ? e.message : e);
  }

  return NextResponse.json({ success: true });
});
