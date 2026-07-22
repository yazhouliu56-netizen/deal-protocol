import { NextResponse } from "next/server";
import { getServiceClient } from "@/lib/supabase-client";
import { getPaymentManager } from "@/lib/payment";
import { addContractEvent } from "@/lib/contract-machine";
import { emitEvent } from "@/lib/event-bus";

export async function POST(request: Request) {
  const rawBody = await request.text();
  const channel = request.headers.get("x-payment-channel") || "alipay";

  const svc = getServiceClient();

  const manager = getPaymentManager();

  if (!manager.isConfigured(channel as "alipay" | "wechat")) {
    return NextResponse.json({ error: "Payment channel not configured" }, { status: 400 });
  }

  let result;
  try {
    const headers: Record<string, string> = {};
    request.headers.forEach((value, key) => {
      headers[key.toLowerCase()] = value;
    });

    result = await manager.handleNotify(channel, rawBody, headers);
  } catch (e) {
    console.warn("Payment notify handling failed:", e);
    return NextResponse.json({ error: "Notify processing failed" }, { status: 400 });
  }

  if (!result.success) {
    return NextResponse.json({ error: "Payment verification failed" }, { status: 400 });
  }

  const { data: contract, error: contractError } = await svc
    .from("contracts")
    .select("id, fund_status")
    .eq("id", result.orderId)
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
    .eq("id", result.orderId);

  if (updateError) {
    console.warn("Failed to update contract fund_status:", updateError);
    return NextResponse.json({ error: "Update failed" }, { status: 500 });
  }

  const { data: contractData } = await svc
    .from("contracts")
    .select("customer_id, provider_id")
    .eq("id", result.orderId)
    .single();

  if (contractData) {
    await addContractEvent({
      contractId: result.orderId,
      actorId: contractData.customer_id,
      fromStatus: contract.fund_status,
      toStatus: "HELD",
      action: "pay",
      reason: `Payment completed via ${channel}, trade no: ${result.tradeNo}`,
      metadata: JSON.stringify({
        paymentChannel: channel,
        tradeNo: result.tradeNo,
      }),
    });

    await svc.from("notifications").insert([
      {
        user_id: contractData.customer_id,
        title: "支付成功",
        body: `订单 ${result.orderId.slice(0, 8)}... 支付已完成，资金已托管`,
        type: "pay",
      },
      {
        user_id: contractData.provider_id,
        title: "支付成功",
        body: `订单 ${result.orderId.slice(0, 8)}... 客户已付款，请开始服务`,
        type: "pay",
      },
    ]);
  }

  await emitEvent({ type: 'order', id: result.orderId, action: 'pay', userId: 'system', metadata: { fundStatus: 'HELD', paymentChannel: channel, tradeNo: result.tradeNo } });

  if (channel === "alipay") {
    return new NextResponse("success", { status: 200 });
  }

  return NextResponse.json({ code: "SUCCESS", message: "成功" });
}
