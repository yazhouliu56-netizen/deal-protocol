import { NextResponse } from "next/server";
import { withAuth } from "@/lib/api-auth";
import { getServiceClient } from "@/lib/supabase-client";

export const POST = withAuth(async (request: Request, user: any) => {
  try {
    const supabase = getServiceClient();
    const { disputeId, resolution, approvedRefundAmount, resolutionNotes } = await request.json();

    if (!disputeId || !resolution || approvedRefundAmount === undefined) {
      return NextResponse.json({ error: "缺少必要裁决参数" }, { status: 400 });
    }

    const { data: dispute, error: disputeErr } = await supabase
      .from("order_disputes")
      .select("id, order_id, status")
      .eq("id", disputeId)
      .single();

    if (disputeErr || !dispute) {
      return NextResponse.json({ error: "未找到仲裁记录" }, { status: 404 });
    }

    if (dispute.status === "RESOLVED" || dispute.status === "REJECTED") {
      return NextResponse.json({ error: "该仲裁已裁决完毕" }, { status: 400 });
    }

    const { data: updatedDispute, error: updateDisputeErr } = await supabase
      .from("order_disputes")
      .update({
        status: resolution === "APPROVED" ? "RESOLVED" : "REJECTED",
        approved_refund_amount: approvedRefundAmount,
        resolution_notes: resolutionNotes || "",
        resolved_at: new Date().toISOString()
      })
      .eq("id", disputeId)
      .select()
      .single();

    if (updateDisputeErr) {
      return NextResponse.json({ error: updateDisputeErr.message }, { status: 400 });
    }

    const nextOrderStatus = approvedRefundAmount > 0 ? "REFUNDED" : "COMPLETED";
    await supabase
      .from("orders")
      .update({ status: nextOrderStatus })
      .eq("id", dispute.order_id);

    return NextResponse.json({ success: true, dispute: updatedDispute });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || "裁决处理失败" }, { status: 500 });
  }
});
