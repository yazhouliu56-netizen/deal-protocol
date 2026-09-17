import { NextResponse } from "next/server";
import { withAuth } from "@/lib/api-auth";
import { getRouteClient } from "@/lib/supabase-route-client";

// R9 码随表（用户裁决 2026-09-18）：旧 withdrawals 表不存在且 profiles 余额模型
// 已被 M14 provider_wallets 取代；本路由改调 SECURITY DEFINER 函数
// submit_withdrawal_request（余额校验＋冻结＋pending 单＋wallet_logs 一体，原子），
// 成功即进入管理员审核流（admin/withdraw/review）。Modal 只读 ok/error，零改动。
// 必须走 getRouteClient（用户 JWT）：函数内 auth.uid() 落 provider_id，service
// 上下文 uid 为空必回 Unauthorized。
export const POST = withAuth(async (request: Request, user) => {
  void user;
  try {
    const { amount, payoutMethod, accountInfo } = await request.json();

    if (!amount || amount <= 0) {
      return NextResponse.json({ error: "提现金额必须大于 0" }, { status: 400 });
    }

    if (!payoutMethod || !accountInfo) {
      return NextResponse.json({ error: "缺少提现渠道或账号信息" }, { status: 400 });
    }

    const supabase = await getRouteClient();
    const { data, error } = await supabase.rpc("submit_withdrawal_request", {
      p_amount: amount,
      p_channel: payoutMethod,
      p_account_info: accountInfo,
    });

    if (error) {
      return NextResponse.json({ error: error.message || "提现请求提交失败" }, { status: 400 });
    }

    const result = data as { success: boolean; error?: string; request_id?: string } | null;
    if (!result?.success) {
      const msg = result?.error === "Insufficient balance" ? "余额不足" : (result?.error || "提现请求提交失败");
      return NextResponse.json({ error: msg }, { status: 400 });
    }

    return NextResponse.json({ success: true, requestId: result.request_id });
  } catch (err) {
    return NextResponse.json({ error: (err instanceof Error ? err.message : String(err)) || "提现请求提交失败" }, { status: 500 });
  }
});
