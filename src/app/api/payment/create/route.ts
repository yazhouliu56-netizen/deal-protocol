import crypto from "crypto";
import { NextResponse } from "next/server";
import { withAuth } from "@/lib/api-auth";
import { getRouteClient } from "@/lib/supabase-route-client";
import { getServiceClient } from "@/lib/supabase-client";
import {
  getPaymentRegistry,
} from "@/adapters/payment/registry";
import { checkRateLimit, rateLimitResponse, RULE_DEFAULT } from "@/lib/rate-limit";
import Stripe from "stripe";

function getStripeClient(): Stripe {
  const key = process.env.STRIPE_SECRET_KEY
  if (!key) throw new Error("STRIPE_SECRET_KEY is not set")
  return new Stripe(key, { apiVersion: "2026-06-24.dahlia" })
}

export const POST = withAuth(async (req, user) => {
  const userResult = checkRateLimit(`payment:create:user:${user.id}`, RULE_DEFAULT)
  if (!userResult.allowed) return rateLimitResponse(userResult.resetAt)
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
    return NextResponse.json({ error: "ȱ�� contractId ����" }, { status: 400 });
  }

  // P5b 应收并入：有 demandId → 读 dues（发布费＋定制平台费）＋校验金额覆盖基础＋溢价。
  let feeDues = 0;
  if (demandId) {
    const feeSvc = getServiceClient();
    const { data: feeDemand } = await feeSvc
      .from("demands")
      .select("id, price, publish_fee_due, custom_platform_due, comp_due")
      .eq("id", demandId)
      .single();
    if (feeDemand) {
      const d = feeDemand as { price?: number; publish_fee_due?: number; custom_platform_due?: number; comp_due?: number };
      // P6：取消补偿应收一并并入（平台零垫付，实收时师傅才拿钱）。
      feeDues = (Number(d.publish_fee_due) || 0) + (Number(d.custom_platform_due) || 0) + (Number(d.comp_due) || 0);
      const { data: customRows } = await feeSvc
        .from("demand_customizations")
        .select("amount")
        .eq("demand_id", demandId)
        .eq("status", "active");
      const premium = ((customRows ?? []) as { amount: number }[])
        .reduce((s, r) => s + (Number(r.amount) || 0), 0);
      if (amount != null && amount < (Number(d.price) || 0) + premium) {
        return NextResponse.json(
          { error: "ORDER_AMOUNT_BELOW_TOTAL", message: "支付金额低于基础价＋定制溢价总额" },
          { status: 400 },
        );
      }
    }
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
        // P5b：孪生 demand 链接（notify 落账查应收用）。
        ...(demandId ? { demand_id: demandId } : {}),
      });
      if (createError) {
        return NextResponse.json({ error: "创建合约记录失败" }, { status: 500 });
      }
    } else if (existingContract.fund_status !== "PENDING" && existingContract.fund_status !== "PENDING_HELD") {
      return NextResponse.json({ error: "当前订单状态不可支付" }, { status: 400 });
    }

    const stripeClient = getStripeClient();
    const paymentIntent = await stripeClient.paymentIntents.create({
      // P5b：应收并入实收（基础＋溢价＋发布费＋定制平台费一次收）。
      amount: Math.round((amount + feeDues) * 100),
      currency: "cny",
      metadata: {
        contract_id: contractId,
        customer_id: user.id,
        demand_id: demandId || "",
        fee_dues: String(feeDues),
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
    // P1-5 改道：沙盒演示链路经 PaymentRegistry 沙盒变体通道（无签名 URL +
    // Mock 降级语义逐字守恒）。
    const result = await getPaymentRegistry().get("alipay", "sandbox").createPayment({
      orderId: contract.id,
      amount: contract.amount,
      description: `订单支付: ${contract.id.slice(0, 8)}...`,
    });

    return NextResponse.json({
      success: true,
      channel: "alipay",
      payUrl: result.payUrl,
      contractId: contract.id,
    });
  }

  if (channel === "wechat") {
    const prepayId = `mock_${crypto.randomUUID()}`;
    const created = await getPaymentRegistry().get("wechat", "sandbox").createPayment({
      orderId: contract.id,
      amount: contract.amount,
      description: `订单支付: ${contract.id.slice(0, 8)}...`,
      metadata: { prepayId },
    });
    const jsapiParams = created.extra?.jsapiParams;

    await supabase
      .from("contracts")
      .update({ fund_status: "HELD" })
      .eq("id", contract.id)
      .in("fund_status", ["PENDING", "PENDING_HELD"]);

    return NextResponse.json({
      success: true,
      channel: "wechat",
      jsapiParams,
      contractId: contract.id,
    });
  }

  if (channel === "mock") {
    await supabase
      .from("contracts")
      .update({ fund_status: "HELD" })
      .eq("id", contract.id)
      .in("fund_status", ["PENDING", "PENDING_HELD"]);

    return NextResponse.json({
      success: true,
      channel: "mock",
      contractId: contract.id,
    });
  }

  return NextResponse.json({ error: "不支持的支付方式" }, { status: 400 });
});
