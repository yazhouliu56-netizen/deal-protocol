import { NextResponse } from "next/server";
import { withAuth } from "@/lib/api-auth";
import { getServiceClient } from "@/lib/supabase-client";

export const POST = withAuth(async (request: Request, user: any) => {
  try {
    const supabase = getServiceClient();
    const { orderId, reason, evidenceUrls, requestedRefundAmount } = await request.json();

    if (!orderId || !reason || requestedRefundAmount === undefined) {
      return NextResponse.json({ error: "缺少必要参数 (orderId, reason, requestedRefundAmount)" }, { status: 400 });
    }

    const { data: order, error: orderErr } = await supabase
      .from("orders")
      .select("id, client_id, developer_id, status, amount")
      .eq("id", orderId)
      .single();

    if (orderErr || !order) {
      return NextResponse.json({ error: "未找到相关订单" }, { status: 404 });
    }

    if (order.client_id !== user.id && order.developer_id !== user.id) {
      return NextResponse.json({ error: "无权对非本人参与的订单发起仲裁" }, { status: 403 });
    }

    if (order.status === "COMPLETED" || order.status === "CANCELLED") {
      return NextResponse.json({ error: "已结案或已取消的订单无法发起维权" }, { status: 400 });
    }

    const { data: dispute, error: disputeErr } = await supabase
      .from("order_disputes")
      .insert({
        order_id: orderId,
        initiator_id: user.id,
        reason,
        evidence_urls: evidenceUrls || [],
        requested_refund_amount: requestedRefundAmount,
        status: "PENDING_REVIEW"
      })
      .select()
      .single();

    if (disputeErr) {
      return NextResponse.json({ error: disputeErr.message }, { status: 400 });
    }

    await supabase
      .from("orders")
      .update({ status: "DISPUTED" })
      .eq("id", orderId);

    return NextResponse.json({ success: true, dispute });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || "服务器内部错误" }, { status: 500 });
  }
});
