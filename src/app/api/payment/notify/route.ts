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
    .select("customer_id, provider_id, demand_id, amount")
    .eq("id", notifyOrderId)
    .single();

  // P7 阶段物化：demand 计划（用户确认版）→ milestone_schedules 行（检查点释放沿用既有 rpc）。
  // 无计划/单阶段默认 → 不建行（整单走既有 Type1 路，不扰动）。
  try {
    const demandId = (contractData as { demand_id?: string | null } | null)?.demand_id
    const total = Number((contractData as { amount?: number } | null)?.amount) || 0
    if (demandId && total > 0) {
      const { data: dem } = await svc.from("demands").select("protocol_id").eq("id", demandId).single()
      const protocolId = (dem as { protocol_id?: string } | null)?.protocol_id
      if (protocolId) {
        const { data: proto } = await svc.from("protocols").select("category_fields").eq("id", protocolId).single()
        const stages = ((proto as { category_fields?: Record<string, unknown> } | null)?.category_fields?.stages ?? []) as {
          title: string; weightPct: number; acceptance: string
        }[]
        const multi = stages.filter((s) => s && Number.isInteger(s.weightPct) && s.weightPct > 0 && s.weightPct < 100)
        if (multi.length > 0) {
          const { stageAmounts } = await import("@/base/stages/plan")
          const amounts = stageAmounts(total, multi)
          const { error: msError } = await svc.from("milestone_schedules").insert(
            multi.map((s, i) => ({
              contract_id: notifyOrderId,
              title: s.title,
              amount: amounts[i],
              step_number: i + 1,
              status: "PENDING",
            })),
          )
          if (msError) throw msError
        }
      }
    }
  } catch (e) {
    console.warn("[payment/notify] milestone materialize skipped:", e instanceof Error ? e.message : e)
  }

  // P5b 应收费落账（幂等：fee_status CAS uncollected→paid；失败不阻断托管主流程）。
  try {
    const demandId = (contractData as { demand_id?: string | null } | null)?.demand_id
    if (demandId && contractData) {
      const { data: due } = await svc
        .from("demands")
        .select("id, publish_fee_due, custom_platform_due, comp_due, fee_status, matched_provider_id")
        .eq("id", demandId)
        .single()
      const d = due as { publish_fee_due?: number; custom_platform_due?: number; comp_due?: number; fee_status?: string; matched_provider_id?: string | null } | null
      if (d && d.fee_status === "uncollected") {
        const pub = Number(d.publish_fee_due) || 0
        const plat = Number(d.custom_platform_due) || 0
        const comp = Number(d.comp_due) || 0
        const rows = []
        if (pub > 0) {
          rows.push({
            user_id: contractData.customer_id,
            type: "PUBLISH_FEE",
            amount: pub,
            balance_before: 0,
            balance_after: 0,
            description: `发布费: 需求单 ${demandId}（ channel ${channel} 实收，永不退）`,
          })
        }
        if (plat > 0) {
          rows.push({
            user_id: contractData.customer_id,
            type: "CUSTOM_PLATFORM_FEE",
            amount: plat,
            balance_before: 0,
            balance_after: 0,
            description: `定制平台费: 需求单 ${demandId}（ channel ${channel} 实收）`,
          })
        }
        if (rows.length > 0) {
          const { error: feeError } = await svc.from("transactions").insert(rows)
          if (feeError) throw feeError
        }
        // P6：补偿应收实收 → 师傅钱包即时到账（钱已在托管，无垫付）。
        if (comp > 0 && d.matched_provider_id) {
          const { data: w } = await svc
            .from("provider_wallets")
            .select("balance")
            .eq("provider_id", d.matched_provider_id)
            .single()
          if (!w) {
            await svc.from("provider_wallets").insert({ provider_id: d.matched_provider_id, balance: 0 })
          }
          const before = Number((w as { balance?: number } | null)?.balance ?? 0)
          const after = Math.round((before + comp) * 100) / 100
          const { error: compError } = await svc
            .from("provider_wallets")
            .update({ balance: after, updated_at: new Date().toISOString() })
            .eq("provider_id", d.matched_provider_id)
          if (compError) throw compError
          const { error: compLogError } = await svc.from("transactions").insert({
            user_id: d.matched_provider_id,
            type: "CANCEL_COMPENSATION",
            amount: comp,
            balance_before: before,
            balance_after: after,
            description: `取消补偿: 需求单 ${demandId}（ channel ${channel} 实收）`,
          })
          if (compLogError) throw compLogError
        }
        await svc.from("demands").update({ fee_status: "paid", comp_due: 0 }).eq("id", demandId).eq("fee_status", "uncollected")
      }
    }
  } catch (e) {
    console.warn("[payment/notify] fee posting skipped:", e instanceof Error ? e.message : e)
  }

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
