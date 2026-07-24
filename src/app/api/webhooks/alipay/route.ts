import { NextResponse } from "next/server";
import { alipayService } from "@/lib/alipay-service";
import { getServiceClient } from "@/lib/supabase-client";
import { addContractEvent } from "@/lib/contract-machine";
import { emitEvent } from "@/lib/event-bus";

export async function POST(request: Request) {
  const rawBody = await request.text();
  const params: Record<string, string> = {};
  for (const part of rawBody.split('&')) {
    const [k, v] = part.split('=');
    params[decodeURIComponent(k)] = decodeURIComponent(v || '');
  }

  if (!alipayService.verifySignature(params)) {
    return NextResponse.json({ error: "signature verification failed" }, { status: 400 });
  }

  const tradeStatus = params.trade_status;
  if (tradeStatus !== 'TRADE_SUCCESS' && tradeStatus !== 'TRADE_FINISHED') {
    return NextResponse.json({ error: "invalid trade status" }, { status: 400 });
  }

  const tradeNo = params.trade_no;
  const outTradeNo = params.out_trade_no;

  if (!tradeNo || !outTradeNo) {
    return NextResponse.json({ error: "missing trade_no or out_trade_no" }, { status: 400 });
  }

  const svc = getServiceClient();

  const { data: existingPayment } = await svc
    .from("payments")
    .select("id, status")
    .eq("provider_payment_id", tradeNo)
    .maybeSingle();

  if (existingPayment) {
    return new Response("success", { status: 200 });
  }

  const totalAmount = parseFloat(params.total_amount || '0');

  await svc
    .from("contracts")
    .update({ fund_status: "HELD", updated_at: new Date().toISOString() })
    .eq("id", outTradeNo);

  await svc.from("payments").insert({
    contract_id: outTradeNo,
    status: "SUCCEEDED",
    provider: "alipay",
    provider_payment_id: tradeNo,
    channel: "alipay",
    amount: totalAmount,
  });

  const { data: contract } = await svc
    .from("contracts")
    .select("customer_id, provider_id")
    .eq("id", outTradeNo)
    .single();

  if (contract) {
    await svc.from("notifications").insert([
      {
        user_id: contract.customer_id,
        title: "支付成功",
        body: `订单 ${outTradeNo.slice(0, 8)}... 支付宝支付已完成，资金已托管`,
        type: "pay",
      },
      {
        user_id: contract.provider_id,
        title: "支付成功",
        body: `订单 ${outTradeNo.slice(0, 8)}... 客户已通过支付宝付款，请开始服务`,
        type: "pay",
      },
    ]);
  }

  await addContractEvent({
    contractId: outTradeNo,
    actorId: contract?.customer_id || "system",
    fromStatus: "PENDING_HELD",
    toStatus: "HELD",
    action: "pay",
    reason: `Alipay payment succeeded: ${tradeNo}`,
    metadata: JSON.stringify({ providerPaymentId: tradeNo, channel: "alipay" }),
  });

  await emitEvent({
    type: "order",
    id: outTradeNo,
    action: "pay",
    userId: "system",
    metadata: { fundStatus: "HELD", provider: "alipay" },
  });

  return new Response("success", { status: 200 });
}
