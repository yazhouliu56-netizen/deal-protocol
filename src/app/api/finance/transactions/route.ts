import { NextResponse } from "next/server";
import { withAuth } from "@/lib/api-auth";
import { getServiceClient } from "@/lib/supabase-client";

export const GET = withAuth(async (request: Request, user: any) => {
  try {
    const supabase = getServiceClient();

    const { data: transactions, error } = await supabase
      .from("finance_transactions")
      .select("*")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(50);

    if (error) {
      const { data: orders } = await supabase
        .from("orders")
        .select("id, title, amount, status, created_at, updated_at")
        .or(`client_id.eq.${user.id},developer_id.eq.${user.id}`)
        .order("updated_at", { ascending: false })
        .limit(30);

      const fallbackList = (orders || []).map((o) => ({
        id: o.id,
        type: o.status === "COMPLETED" ? "INCOME" : "ESCROW_LOCK",
        amount: o.amount,
        title: o.title,
        status: o.status,
        created_at: o.updated_at || o.created_at
      }));

      return NextResponse.json({ success: true, data: fallbackList });
    }

    return NextResponse.json({ success: true, data: transactions || [] });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || "拉取交易流水失败" }, { status: 500 });
  }
});
