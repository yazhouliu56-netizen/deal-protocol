import { NextResponse } from "next/server";
import { getServiceClient } from "@/lib/supabase-client";
import { getPaymentRegistry } from "@/adapters/payment/registry";
import { addContractEvent } from "@/lib/contract/events";
import { emitEvent } from "@/lib/event-bus";

export async function POST(request: Request) {
  const rawBody = await request.text();
  const channel = request.headers.get("x-payment-channel") || "alipay";

  const svc = getServiceClient();

  // P1-5 改道：生产双通道经 PaymentRegistry（handleNotify→verifyWebhook 一对一
  // 等价映射，验签算法本体 payment-core 零触碰）。
  const provider = getPaymentRegistry().get(channel);

  if (!provider.isConfigured()) {
    return NextResponse.json({ error: "Payment channel not configured" }, { status: 400 });
  }

  let result;
  try {
    const headers: Record<string, string> = {};
    request.headers.forEach((value, key) => {
      headers[key.toLowerCase()] = value;
    });

    result = await provider.verifyWebhook({ payload: rawBody, headers });
  } catch (e) {
    console.warn("Payment notify handling failed:", e);
    return NextResponse.json({ error: "Notify processing failed" }, { status: 400 });
  }

  if (!result.success) {
    return NextResponse.json({ error: "Payment verification failed" }, { status: 400 });
  }

  // WebhookVerifyResult 可选字段 → NotifyResult 必填语义的守恒投影
  // （生产通道 handleNotify 恒返回两字段，空串兜底仅为类型收窄）。
  const notifyOrderId = result.orderId ?? "";
  const notifyTradeNo = result.tradeNo ?? "";

  const { data: contract, error: contractError } = await svc
    .from("contracts")
    .select("id, fund_status")
    .eq("id", notifyOrderId)
    .single();

  if (contractError || !contract) {
    console.warn(`Payment notify: contract ${result.orderId} not found`);
    return NextResponse.json({ error: "Contract not found" }, { status: 404 });
  }

  if (contract.fund_status === "HELD") {
    return NextResponse.json({ success: true, message: "Already settled" });
  }

  const { error: updateError } = await svc
    .from("contracts")
    .update({ fund_status: "HELD" })
    .eq("id", notifyOrderId);

  if (updateError) {
    console.warn("Failed to update contract fund_status:", updateError);
    return NextResponse.json({ error: "Update failed" }, { status: 500 });
  }

  const { data: contractData } = await svc
    .from("contracts")
    .select("customer_id, provider_id")
    .eq("id", notifyOrderId)
    .single();

  if (contractData) {
    await addContractEvent({
      contractId: notifyOrderId,
      actorId: contractData.customer_id,
      fromStatus: contract.fund_status,
      toStatus: "HELD",
      action: "pay",
      reason: `Payment completed via ${channel}, trade no: ${result.tradeNo}`,
      metadata: JSON.stringify({
        paymentChannel: channel,
        tradeNo: notifyTradeNo,
      }),
    });

    await svc.from("notifications").insert([
      {
        user_id: contractData.customer_id,
        title: "支付成功",
        body: `订单 ${notifyOrderId.slice(0, 8)}... 支付已完成，资金已托管`,
        type: "pay",
      },
      {
        user_id: contractData.provider_id,
        title: "支付成功",
        body: `订单 ${notifyOrderId.slice(0, 8)}... 客户已付款，请开始服务`,
        type: "pay",
      },
    ]);
  }

  await emitEvent({ type: 'order', id: notifyOrderId, action: 'pay', userId: 'system', metadata: { fundStatus: 'HELD', paymentChannel: channel, tradeNo: notifyTradeNo } });

  if (channel === "alipay") {
    return new NextResponse("success", { status: 200 });
  }

  return NextResponse.json({ code: "SUCCESS", message: "成功" });
}
