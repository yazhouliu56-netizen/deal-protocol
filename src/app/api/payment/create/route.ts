import { NextResponse } from "next/server";
import { withAuth } from "@/lib/api-auth";
import { getRouteClient } from "@/lib/supabase-route-client";
import { alipayService } from "@/lib/alipay-service";
import Stripe from "stripe";

function getStripeClient(): Stripe {
  const key = process.env.STRIPE_SECRET_KEY
  if (!key) throw new Error("STRIPE_SECRET_KEY is not set")
  return new Stripe(key, { apiVersion: "2026-06-24.dahlia" })
}

export const POST = withAuth(async (req, user) => {
  const supabase = await getRouteClient();
  const body = await req.json();
  const { contractId: rawContractId, orderId, channel: rawChannel, demandId, amount } = body as {
    contractId?: string;
    orderId?: string;
    channel?: string;
    demandId?: string;
    amount?: number;
  };

  const contractId = rawContractId ?? orderId;
  const channel = rawChannel || process.env.PAYMENT_CHANNEL || 'mock';

  if (!contractId) {
    return NextResponse.json({ error: "缺少 contractId 参数" }, { status: 400 });
  }

  if (channel === "stripe") {
    if (!amount || amount <= 0) {
      return NextResponse.json({ error: "amount 必须为正数" }, { status: 400 });
    }

    const { data: existingContract } = await supabase
      .from("contracts")
      .select("id, fund_status, amount")
      .eq("id", contractId)
      .maybeSingle();

    if (!existingContract) {
      const { error: createError } = await supabase.from("contracts").insert({
        id: contractId,
        customer_id: user.id,
        fund_status: "PENDING_HELD",
        amount,
      });
      if (createError) {
        return NextResponse.json({ error: "创建合约记录失败" }, { status: 500 });
      }
    } else if (existingContract.fund_status !== "PENDING" && existingContract.fund_status !== "PENDING_HELD") {
      return NextResponse.json({ error: "当前订单状态不可支付" }, { status: 400 });
    }

    const stripeClient = getStripeClient();
    const paymentIntent = await stripeClient.paymentIntents.create({
      amount: Math.round(amount * 100),
      currency: "cny",
      metadata: {
        contract_id: contractId,
        customer_id: user.id,
        demand_id: demandId || "",
      },
    });

    return NextResponse.json({
      success: true,
      channel: "stripe",
      clientSecret: paymentIntent.client_secret,
      contractId,
    });
  }

  const { data: contract, error: contractError } = await supabase
    .from("contracts")
    .select("*")
    .eq("id", contractId)
    .single();

  if (contractError || !contract) {
    return NextResponse.json({ error: "订单不存在" }, { status: 404 });
  }

  if (contract.customer_id !== user.id) {
    return NextResponse.json({ error: "无权操作" }, { status: 403 });
  }

  if (contract.fund_status !== "PENDING" && contract.fund_status !== "PENDING_HELD") {
    return NextResponse.json({ error: "当前订单状态不可支付" }, { status: 400 });
  }

  if (channel === "alipay") {
    const payUrl = alipayService.generatePaymentUrl({
      outTradeNo: contract.id,
      amount: contract.amount,
      subject: `订单支付: ${contract.id.slice(0, 8)}...`,
    });

    return NextResponse.json({
      success: true,
      channel: "alipay",
      payUrl,
      contractId: contract.id,
    });
  }

  if (channel === "mock") {
    await supabase
      .from("contracts")
      .update({ fund_status: "HELD" })
      .eq("id", contract.id);

    return NextResponse.json({
      success: true,
      channel: "mock",
      contractId: contract.id,
    });
  }

  return NextResponse.json({ error: "不支持的支付方式" }, { status: 400 });
});
