import { NextResponse } from "next/server";
import { getServiceClient } from "@/lib/supabase-client";
import { wechatPayService } from "@/lib/wechat-pay-service";
import { addContractEvent } from "@/lib/contract/events";
import { emitEvent } from "@/lib/event-bus";

function parseWechatXml(xml: string): Record<string, string> {
  const result: Record<string, string> = {};
  const regex = /<(\w+)>.*?<!\[CDATA\[(.*?)\]\]>.*?<\/\1>|<(\w+)>([^<]+)<\/\3>/gs;
  let match;
  while ((match = regex.exec(xml)) !== null) {
    const key = match[1] || match[3];
    const value = match[2] || match[4];
    result[key] = value;
  }
  return result;
}

export async function POST(request: Request) {
  const rawBody = await request.text();
  const params = parseWechatXml(rawBody);

  if (!wechatPayService.verifySignature(params)) {
    return new NextResponse(
      `<xml><return_code><![CDATA[FAIL]]></return_code><return_msg><![CDATA[signature verification failed]]></return_msg></xml>`,
      { status: 200, headers: { "Content-Type": "application/xml" } },
    );
  }

  if (params.result_code !== "SUCCESS") {
    // 方向3：失败回调同步台账（幂等，不阻断主流程）
    try {
      const failSvc = getServiceClient();
      await failSvc.from("split_records").update({ status: "FAILED", channel_response: params, error_code: params.err_code, error_msg: params.err_code_des }).eq("out_order_no", params.out_trade_no ?? "");
    } catch {}
    return new NextResponse(
      `<xml><return_code><![CDATA[SUCCESS]]></return_code><return_msg><![CDATA[ok]]></return_msg></xml>`,
      { status: 200, headers: { "Content-Type": "application/xml" } },
    );
  }

  const contractId = params.out_trade_no;
  const transactionId = params.transaction_id;

  if (!contractId || !transactionId) {
    return new NextResponse(
      `<xml><return_code><![CDATA[FAIL]]></return_code><return_msg><![CDATA[missing out_trade_no or transaction_id]]></return_msg></xml>`,
      { status: 200, headers: { "Content-Type": "application/xml" } },
    );
  }

  const svc = getServiceClient();

  const { data: existingPayment } = await svc
    .from("payments")
    .select("id, status")
    .eq("provider_payment_id", transactionId)
    .maybeSingle();

  if (existingPayment) {
    return new NextResponse(
      `<xml><return_code><![CDATA[SUCCESS]]></return_code></xml>`,
      { status: 200, headers: { "Content-Type": "application/xml" } },
    );
  }

  const { data: contract } = await svc
    .from("contracts")
    .select("id, fund_status, customer_id, provider_id, amount")
    .eq("id", contractId)
    .single();

  if (!contract) {
    return new NextResponse(
      `<xml><return_code><![CDATA[FAIL]]></return_code><return_msg><![CDATA[contract not found]]></return_msg></xml>`,
      { status: 200, headers: { "Content-Type": "application/xml" } },
    );
  }

  await svc
    .from("contracts")
    .update({ fund_status: "HELD", updated_at: new Date().toISOString() })
    .eq("id", contractId);

  await svc.from("payments").insert({
    contract_id: contractId,
    status: "SUCCEEDED",
    provider: "wechat",
    provider_payment_id: transactionId,
    amount: Number(params.total_fee ?? 0) / 100,
  });

  // 方向3：回调落盘 split_records 台账（幂等更新，兼容 order_no/out_order_no 双键）
  try {
    await svc.from("split_records").update({ status: "SUCCESS", settled_at: new Date().toISOString(), channel_response: params }).eq("out_order_no", transactionId);
    await svc.from("split_records").update({ status: "SUCCESS", settled_at: new Date().toISOString(), channel_response: params }).eq("order_no", contractId).eq("status", "PENDING");
  } catch {}

  await svc.from("notifications").insert([
    {
      user_id: contract.customer_id,
      title: "支付成功",
      body: `订单 ${contractId.slice(0, 8)}... 微信支付已完成，资金已托管`,
      type: "pay",
    },
    {
      user_id: contract.provider_id,
      title: "支付成功",
      body: `订单 ${contractId.slice(0, 8)}... 客户已通过微信付款，请开始服务`,
      type: "pay",
    },
  ]);

  await addContractEvent({
    contractId,
    actorId: contract.customer_id,
    fromStatus: contract.fund_status,
    toStatus: "HELD",
    action: "pay",
    reason: `WeChat Pay succeeded: ${transactionId}`,
    metadata: JSON.stringify({ providerPaymentId: transactionId }),
  });

  await emitEvent({
    type: "order",
    id: contractId,
    action: "pay",
    userId: "system",
    metadata: { fundStatus: "HELD", provider: "wechat" },
  });

  return new NextResponse(
    `<xml><return_code><![CDATA[SUCCESS]]></return_code></xml>`,
    { status: 200, headers: { "Content-Type": "application/xml" } },
  );
}
