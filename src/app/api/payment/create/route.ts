import { NextResponse } from "next/server";
import { withAuth } from "@/lib/api-auth";
import { getRouteClient } from "@/lib/supabase-route-client";
import { getPaymentManager, createPayment } from "@/lib/payment";

export const POST = withAuth(async (req, user) => {
  const supabase = await getRouteClient();
  const body = await req.json();
  const { orderId, channel } = body as {
    orderId: string;
    channel: "alipay" | "wechat";
  };

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
