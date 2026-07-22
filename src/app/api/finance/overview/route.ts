import { NextResponse } from "next/server";
import { withAuth } from "@/lib/api-auth";
import { getServiceClient } from "@/lib/supabase-client";

export const GET = withAuth(async (request: Request, user: any) => {
  try {
    const supabase = getServiceClient();

    const { data: completedOrders, error: completedErr } = await supabase
      .from("orders")
      .select("amount")
      .eq("developer_id", user.id)
      .eq("status", "COMPLETED");

    if (completedErr) {
      return NextResponse.json({ error: completedErr.message }, { status: 400 });
    }

    const totalEarned = (completedOrders || []).reduce((sum, item) => sum + (Number(item.amount) || 0), 0);

    const { data: escrowOrders, error: escrowErr } = await supabase
      .from("orders")
      .select("amount")
      .or(`client_id.eq.${user.id},developer_id.eq.${user.id}`)
      .in("status", ["IN_PROGRESS", "DELIVERED", "DISPUTED"]);

    if (escrowErr) {
      return NextResponse.json({ error: escrowErr.message }, { status: 400 });
    }

    const totalInEscrow = (escrowOrders || []).reduce((sum, item) => sum + (Number(item.amount) || 0), 0);

    const { data: profile } = await supabase
      .from("profiles")
      .select("balance, pending_withdrawal")
      .eq("id", user.id)
      .single();

    const availableBalance = Number(profile?.balance) || (totalEarned * 0.95);
    const pendingWithdrawal = Number(profile?.pending_withdrawal) || 0;

    return NextResponse.json({
      success: true,
      data: {
        totalEarned,
        totalInEscrow,
        availableBalance,
        pendingWithdrawal,
        completedOrderCount: completedOrders?.length || 0,
        activeEscrowOrderCount: escrowOrders?.length || 0
      }
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || "获取资金概览失败" }, { status: 500 });
  }
});
