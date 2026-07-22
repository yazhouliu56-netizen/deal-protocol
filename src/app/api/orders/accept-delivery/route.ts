import { NextResponse } from "next/server";
import { withAuth } from "@/lib/api-auth";
import { getServiceClient } from "@/lib/supabase-client";

export const POST = withAuth(async (request: Request, user: any) => {
  try {
    const supabase = getServiceClient();
    const { orderId } = await request.json();

    if (!orderId) {
      return NextResponse.json({ error: "Missing required orderId." }, { status: 400 });
    }

    const { data: order, error: queryErr } = await supabase
      .from("orders")
      .select("id, client_id, status")
      .eq("id", orderId)
      .single();

    if (queryErr || !order) {
      return NextResponse.json({ error: "Order not found." }, { status: 404 });
    }

    if (order.client_id !== user.id) {
      return NextResponse.json({ error: "Unauthorized operation." }, { status: 403 });
    }

    const { data: updatedOrder, error: updateErr } = await supabase
      .from("orders")
      .update({
        status: "COMPLETED",
        completed_at: new Date().toISOString()
      })
      .eq("id", orderId)
      .select()
      .single();

    if (updateErr) {
      return NextResponse.json({ error: updateErr.message }, { status: 400 });
    }

    return NextResponse.json({ success: true, order: updatedOrder });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || "Internal Server Error" }, { status: 500 });
  }
});
