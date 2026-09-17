import { NextResponse } from "next/server";
import { withAuth } from "@/lib/api-auth";
import { getServiceClient } from "@/lib/supabase-client";
// P0-2 收编：可用余额估算不再内联 `totalEarned * 0.95` 硬编码比例，
// 统一经 escrow 确定性净得口径（DEFAULT_PLATFORM_RATE 10% 平台费）。
import { calculateProviderSettlement } from "@/base/money/escrow";

export const GET = withAuth(async (request: Request, user) => {
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

    // R11 双账本统一：可用余额以 provider_wallets 为准（profiles.balance 已冻结停写）。
    // 缺钱包行按 0＋托管估算回落（#10，语义沿用旧回落）。
    const { data: wallet } = await supabase
      .from("provider_wallets")
      .select("balance")
      .eq("provider_id", user.id)
      .single();

    const availableBalance = wallet != null
      ? Number((wallet as { balance?: number }).balance ?? 0)
      : calculateProviderSettlement(totalEarned).providerNet;

    // 在途冻结＝pending 提现单合计（rpc 提交即扣减余额，pending 单即冻结额）。
    const { data: pendingReqs } = await supabase
      .from("withdrawal_requests")
      .select("amount")
      .eq("provider_id", user.id)
      .eq("status", "pending");
    const pendingWithdrawal = (pendingReqs ?? [])
      .reduce((sum, r) => sum + (Number((r as { amount?: number }).amount) || 0), 0);

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
  } catch (err) {
    return NextResponse.json({ error: (err instanceof Error ? err.message : String(err)) || "获取资金概览失败" }, { status: 500 });
  }
});
