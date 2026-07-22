import { NextResponse } from "next/server";
import { withAuth } from "@/lib/api-auth";
import { getServiceClient } from "@/lib/supabase-client";

export const POST = withAuth(async (request: Request, user: any) => {
  try {
    const supabase = getServiceClient();
    const { amount, payoutMethod, accountInfo } = await request.json();

    if (!amount || amount <= 0) {
      return NextResponse.json({ error: "提现金额必须大于 0" }, { status: 400 });
    }

    if (!payoutMethod || !accountInfo) {
      return NextResponse.json({ error: "缺少提现渠道或账号信息" }, { status: 400 });
    }

    const { data: profile, error: profileErr } = await supabase
      .from("profiles")
      .select("balance, pending_withdrawal")
      .eq("id", user.id)
      .single();

    if (profileErr) {
      return NextResponse.json({ error: "无法调取用户资产账户" }, { status: 400 });
    }

    const currentBalance = Number(profile?.balance) || 0;
    if (amount > currentBalance) {
      return NextResponse.json({ error: `申请金额 ¥${amount} 超过当前可用余额 ¥${currentBalance}` }, { status: 400 });
    }

    const { data: withdrawal, error: withdrawErr } = await supabase
      .from("withdrawals")
      .insert({
        user_id: user.id,
        amount,
        payout_method: payoutMethod,
        account_info: accountInfo,
        status: "PROCESSING"
      })
      .select()
      .single();

    if (withdrawErr) {
      return NextResponse.json({ error: withdrawErr.message }, { status: 400 });
    }

    await supabase
      .from("profiles")
      .update({
        balance: currentBalance - amount,
        pending_withdrawal: (Number(profile?.pending_withdrawal) || 0) + amount
      })
      .eq("id", user.id);

    return NextResponse.json({ success: true, withdrawal });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || "提现请求提交失败" }, { status: 500 });
  }
});
