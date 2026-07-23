import { NextResponse } from "next/server";
import { withAuth } from "@/lib/api-auth";
import { getRouteClient } from "@/lib/supabase-route-client";
import { getPaymentManager, createPayment } from "@/lib/payment";
import Stripe from "stripe";

function getStripeClient(): Stripe {
  const key = process.env.STRIPE_SECRET_KEY
  if (!key) throw new Error("STRIPE_SECRET_KEY is not set")
  return new Stripe(key, { apiVersion: "2026-06-24.dahlia" })
}

export const POST = withAuth(async (req, user) => {
  const supabase = await getRouteClient();
  const body = await req.json();
  const { contractId: rawContractId, orderId, channel, demandId, amount } = body as {
    contractId?: string;
    orderId?: string;
    channel?: string;
    demandId?: string;
    amount?: number;
  };

  const contractId = rawContractId ?? orderId;

  if (channel === "stripe") {
    if (!contractId) {
      return NextResponse.json({ error: "缺少 contractId 参数" }, { status: 400 });
    }
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
      clientSecret: paymentIntent.client_secret,
      contractId,
    });
  }

  if (!orderId || !channel) {
    return NextResponse.json({ error: "缺少必要参数 orderId 或 channel" }, { status: 400 });
  }

  if (channel !== "alipay" && channel !== "wechat") {
    return NextResponse.json({ error: "不支持的支付方式" }, { status: 400 });
  }

  const { data: contract, error: contractError } = await supabase
    .from("contracts")
    .select("*")
    .eq("id", orderId)
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

  const notifyUrl = process.env.PAYMENT_NOTIFY_URL
    ? `${process.env.PAYMENT_NOTIFY_URL}/api/payment/notify`
    : `${req.headers.get("origin") || ""}/api/payment/notify`;

  const manager = getPaymentManager();

  if (manager.isConfigured(channel)) {
    const result = await manager.createPayment({
      orderId: contract.id,
      amount: contract.amount,
      description: `订单支付: ${contract.id.slice(0, 8)}...`,
      channel,
      notifyUrl,
      payerId: user.id,
    });

    if (!result.success) {
      return NextResponse.json({ error: result.error || "支付创建失败" }, { status: 500 });
    }

    return NextResponse.json({
      orderId: result.orderId,
      payUrl: result.payUrl || null,
      qrCode: result.qrCode || null,
      channel,
    });
  }

  const paymentResult = await createPayment({
    amount: contract.amount,
    description: `订单支付: ${contract.id}`,
    contractId: contract.id,
    payerId: user.id,
    provider: channel === "wechat" ? "alipay" : "stripe",
  });

  if (!paymentResult.success) {
    return NextResponse.json({ error: paymentResult.error || "支付失败" }, { status: 400 });
  }

  const { error: updateError } = await supabase
    .from("payments")
    .update({
      status: "SUCCEEDED",
      provider: paymentResult.provider,
      provider_payment_id: paymentResult.providerPaymentId,
    })
    .eq("contract_id", contract.id);

  if (updateError) {
    console.warn("Failed to update payment record:", updateError);
  }

  const { error: contractUpdateError } = await supabase
    .from("contracts")
    .update({ fund_status: "HELD" })
    .eq("id", contract.id);

  if (contractUpdateError) {
    return NextResponse.json({ error: "更新订单状态失败" }, { status: 500 });
  }

  return NextResponse.json({
    orderId: contract.id,
    payUrl: null,
    qrCode: null,
    channel,
    mock: true,
  });
});
