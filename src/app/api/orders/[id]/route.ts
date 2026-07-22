import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { getServiceClient } from "@/lib/supabase-client";
import { createPayment, getAvailablePaymentChannels } from "@/lib/payment";
import {
  validateTransition,
  getNextFundStatus,
  getNextServiceStage,
  calcRefund,
  addContractEvent,
  handleSatisfactionBatch,
  createRefundTransactions,
} from "@/lib/contract-machine";
import { getEngine } from "@/lib/protocol/engine";
import { emitEvent } from "@/lib/event-bus";
import { appendEvidence } from "@/modules/m11-evidence-log/evidence-chain";

async function insertNotification({
  userId, title, body, type,
}: {
  userId: string;
  title: string;
  body: string;
  type: string;
}) {
  const svc = getServiceClient();
  await svc.from('notifications').insert({
    user_id: userId,
    title,
    body,
    type,
  });
}

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "未登录" }, { status: 401 });
  }

  const { supabase } = session;

  const { data: contract, error } = await supabase
    .from('contracts')
    .select('*')
    .eq('id', id)
    .single();

  if (error || !contract) {
    return NextResponse.json({ error: "订单不存在" }, { status: 404 });
  }

  if (contract.customer_id !== session.user.id && contract.provider_id !== session.user.id) {
    return NextResponse.json({ error: "无权访问" }, { status: 403 });
  }

  // Fetch related data — safe queries
  const [demandRes, providerRes, customerRes, paymentsRes, eventsRes] = await Promise.all([
    supabase.from('demands').select('*').eq('id', contract.demand_id).single(),
    supabase.from('profiles').select('id, name, phone, credit_score').eq('id', contract.provider_id).single(),
    supabase.from('profiles').select('id, name, phone').eq('id', contract.customer_id).single(),
    supabase.from('payments').select('*').eq('contract_id', id),
    supabase.from('contract_events').select('*').eq('contract_id', id).order('created_at', { ascending: false }),
  ]);

  // Risky queries — tables that may not exist yet
  let reviewsRes: any = { data: [] };
  try {
    reviewsRes = await supabase.from('evidence_chain').select('*, reviewer:reviewer_id(name)').eq('contract_id', id);
  } catch (e) {
    console.warn("evidence_chain table not found, skipping reviews:", e);
  }
  let disputesRes: any = { data: [] };
  try {
    disputesRes = await supabase.from('disputes').select('id, channel, reason, created_at').eq('contract_id', id).eq('status', 'OPEN').limit(1);
  } catch (e) {
    console.warn("disputes query failed:", e);
  }
  let protocolVersionRes: any = { data: null };
  if (contract.protocol_version_id) {
    try {
      protocolVersionRes = await supabase.from('protocol_versions').select('*').eq('id', contract.protocol_version_id).single();
    } catch (e) {
      console.warn("protocol_versions query failed:", e);
    }
  }

  const roleParam = new URL(request.url).searchParams.get('role')?.toUpperCase();
  const actorRole = roleParam === "CUSTOMER" || roleParam === "PROVIDER"
    ? roleParam
    : contract.customer_id === session.user.id
      ? "CUSTOMER"
      : "PROVIDER";

  // Auto-complete check
  if (
    contract.fund_status === "HELD" &&
    contract.auto_complete_at &&
    new Date() >= new Date(contract.auto_complete_at) &&
    (!contract.dispute_status || contract.dispute_status === "RESOLVED")
  ) {
    const engine = getEngine(contract.protocol_id);
    if (engine) {
      const guard = engine.validateTransition("auto_complete", {
        contract: {
          id: contract.id,
          fundStatus: contract.fund_status,
          disputeStatus: contract.dispute_status,
          serviceStage: contract.service_stage,
          providerId: contract.provider_id,
          customerId: contract.customer_id,
          amount: contract.amount,
          completedAt: contract.completed_at,
          autoCompleteAt: contract.auto_complete_at,
        },
        actor: { id: "system", role: "SYSTEM" },
      });
      if (!guard) {
        const { error: updateError } = await supabase
          .from('contracts')
          .update({
            fund_status: "COMPLETED",
            completed_at: new Date().toISOString(),
            auto_complete_at: null,
          })
          .eq('id', id);

        if (!updateError) {
          await addContractEvent({
            contractId: id,
            actorId: "system",
            fromStatus: "HELD",
            toStatus: "COMPLETED",
            action: "auto_complete",
            reason: "72h 无争议，系统自动确认完成",
          });
          try {
            await handleSatisfactionBatch(id);
          } catch (e) {
            console.warn("Satisfaction batch after auto-complete failed:", e);
          }
        }
      }
    }
  }

  const protocolVersion = protocolVersionRes.data;
  const protocolInfo = protocolVersion
    ? (() => {
        const cfg = typeof protocolVersion.config === 'string'
          ? JSON.parse(protocolVersion.config)
          : protocolVersion.config;
        return {
          protocolId: contract.protocol_id,
          protocolName: cfg.name,
          protocolVersion: protocolVersion.version,
          fundingMode: cfg.funding?.mode,
          serviceStages: cfg.serviceStages ?? [],
          disputeChannels: cfg.dispute?.channels ?? null,
          reviewDimensions: cfg.review?.dimensions ?? [],
        };
      })()
    : null;

  const activeDispute = disputesRes.data && disputesRes.data.length > 0 ? disputesRes.data[0] : null;

  const engine = getEngine(contract.protocol_id);
  const availableActions = engine
    ? engine.deriveNextActions(
        contract.fund_status,
        contract.dispute_status,
        contract.service_stage,
        actorRole,
      )
    : [];

  return NextResponse.json({
    contract: {
      ...contract,
      demand: demandRes.data ?? null,
      provider: providerRes.data
        ? { id: providerRes.data.id, name: providerRes.data.name, phone: providerRes.data.phone, creditScore: providerRes.data.credit_score }
        : null,
      customer: customerRes.data
        ? { id: customerRes.data.id, name: customerRes.data.name, phone: customerRes.data.phone }
        : null,
      payments: paymentsRes.data ?? [],
      events: eventsRes.data ?? [],
      reviews: reviewsRes.data ?? [],
      protocolVersion,
      disputes: disputesRes.data ?? [],
      protocolInfo,
      activeDispute,
      availableActions,
      paymentChannels: getAvailablePaymentChannels(),
    },
  });
}

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "未登录" }, { status: 401 });
  }

  const { supabase } = session;
  const body = await request.json();
  const { action, reason, metadata, evidence } = body;

  const { data: contract, error: contractError } = await supabase
    .from('contracts')
    .select('*')
    .eq('id', id)
    .single();

  if (contractError || !contract) {
    return NextResponse.json({ error: "订单不存在" }, { status: 404 });
  }

  const { data: user } = await supabase
    .from('profiles')
    .select('id, role, roles')
    .eq('id', session.user.id)
    .single();

  if (!user) {
    return NextResponse.json({ error: "用户不存在" }, { status: 404 });
  }

  const userRoles = user.roles ? JSON.parse(user.roles) as string[] : [user.role];

  // Prefer explicit role from request body, fall back to automatic derivation
  let actorRole: string;
  if (body.role) {
    const requestedRole = (body.role as string).toUpperCase();
    if (requestedRole === "CUSTOMER" && user.id !== contract.customer_id) {
      return NextResponse.json({ error: "你不是该订单的客户" }, { status: 403 });
    }
    if (requestedRole === "PROVIDER" && user.id !== contract.provider_id) {
      return NextResponse.json({ error: "你不是该订单的服务商" }, { status: 403 });
    }
    if (requestedRole === "ADMIN" && !userRoles.includes("ADMIN")) {
      return NextResponse.json({ error: "仅管理员可执行此操作" }, { status: 403 });
    }
    actorRole = requestedRole;
  } else {
    actorRole = user.id === contract.customer_id && userRoles.includes("CUSTOMER")
      ? "CUSTOMER"
      : user.id === contract.provider_id && userRoles.includes("PROVIDER")
        ? "PROVIDER"
        : userRoles.includes("ADMIN")
          ? "ADMIN"
          : user.role;
  }

  const guardError = validateTransition(contract.protocol_id, action, {
    contract: {
      id: contract.id,
      fundStatus: contract.fund_status as any,
      disputeStatus: contract.dispute_status,
      serviceStage: contract.service_stage as any,
      providerId: contract.provider_id,
      customerId: contract.customer_id,
      amount: contract.amount,
      completedAt: contract.completed_at,
      autoCompleteAt: contract.auto_complete_at,
    },
    actor: { id: user.id, role: actorRole },
    payload: body,
  });

  if (guardError) {
    return NextResponse.json({ error: guardError }, { status: 400 });
  }

  const nextFundStatus = getNextFundStatus(contract.protocol_id, action);
  const nextStage = getNextServiceStage(contract.protocol_id, action);

  const updates: Record<string, unknown> = {};

  if (nextFundStatus) {
    updates.fund_status = nextFundStatus;
  }
  if (nextStage !== null) {
    updates.service_stage = nextStage;
  }

  // Payment: any action that transitions to HELD
  const engine = getEngine(contract.protocol_id);
  const payActions = engine
    ?.getDefinition()
    .transitions.filter((t) => t.from !== t.to && t.to === "HELD")
    .map((t) => t.action) ?? [];
  if (payActions.includes(action)) {
    const paymentProvider = (body.paymentProvider as string) ?? "stripe";

    const paymentResult = await createPayment({
      amount: contract.amount,
      description: `订单支付: ${id}`,
      contractId: id,
      payerId: session.user.id,
      provider: paymentProvider as any,
    });

    if (!paymentResult.success) {
      return NextResponse.json(
        { error: paymentResult.error || "支付失败" },
        { status: 400 },
      );
    }

    await supabase
      .from('payments')
      .update({
        status: "SUCCEEDED",
        provider: paymentResult.provider,
        provider_payment_id: paymentResult.providerPaymentId,
      })
      .eq('contract_id', id);

    updates.fund_status = "HELD";

    await Promise.all([
      insertNotification({ userId: contract.customer_id, title: "支付成功", body: `订单 ${id.slice(0, 8)}... 支付已完成，资金已托管`, type: "pay" }),
      insertNotification({ userId: contract.provider_id, title: "支付成功", body: `订单 ${id.slice(0, 8)}... 客户已付款，请开始服务`, type: "pay" }),
    ]);
  }

  // Auto-complete timer: transitioning to final service stage
  const stageNames = engine?.getServiceStages();
  if (stageNames && nextStage !== null && nextStage >= stageNames.length - 1) {
    const timeoutSeconds = engine?.getDefinition().funding.autoReleaseTimeout ?? (72 * 3600);
    updates.auto_complete_at = new Date(Date.now() + (timeoutSeconds * 1000)).toISOString();
  }

  if (action === "confirm_complete" || action === "auto_complete") {
    const now = new Date();
    updates.completed_at = now.toISOString();
    updates.auto_complete_at = null;
  }

  let refundSettled = false;
  if (action === "cancel_before_pay" || action === "cancel_during_service") {
    const refund = calcRefund(contract.protocol_id, contract.service_stage, contract.amount);
    updates.fund_status = "CANCELLED";
    if (action === "cancel_during_service") {
      try {
        await createRefundTransactions(id, contract.customer_id, contract.provider_id, refund);
        refundSettled = true;
      } catch (e) {
        console.warn("Cancel refund failed:", e);
      }
    } else {
      refundSettled = true;
    }
  }

  // Dual state machine: disputeStatus independent from fundStatus
  const DISPUTE_OPS = ["open_dispute", "open_dispute_after_complete", "report_no_show"]
  if (DISPUTE_OPS.includes(action)) {
    const disputeEngine = getEngine(contract.protocol_id);
    const channels = disputeEngine?.getDefinition().dispute.channels;
    let channel = "red";
    if (channels) {
      if (contract.amount <= channels.green.maxAmount) {
        channel = "green";
      } else if (channels.yellow && contract.amount <= channels.yellow.maxAmount) {
        channel = "yellow";
      }
    }

    const svc = getServiceClient();
    const { error: disputeCreateError } = await svc
      .from('disputes')
      .insert({
        contract_id: id,
        initiator_id: session.user.id,
        protocol_id: contract.protocol_id,
        channel,
        reason: reason || (action === "open_dispute_after_complete" ? "质保争议" : action === "report_no_show" ? "对方未到" : "服务争议"),
        evidence: evidence || null,
      });

    if (disputeCreateError) {
      console.warn("Failed to create dispute:", JSON.stringify(disputeCreateError));
      return NextResponse.json({ error: "创建争议失败", detail: JSON.stringify(disputeCreateError) }, { status: 500 });
    }

    updates.dispute_status = "OPEN";
    updates.auto_complete_at = null;

    const otherPartyId = contract.customer_id === session.user.id ? contract.provider_id : contract.customer_id;
    await insertNotification({ userId: otherPartyId, title: "纠纷已开启", body: `订单 ${id.slice(0, 8)}... 发起了纠纷，请及时处理`, type: "dispute" });
  }

  if (action === "resolve_dispute") {
    const resolution = reason || "仲裁结案";

    const { data: dispute } = await supabase
      .from('disputes')
      .select('llm_verdict')
      .eq('contract_id', id)
      .eq('status', 'OPEN')
      .single();

    const providerAmount = (body.providerAmount as number) ?? contract.amount * 0.5;
    const customerAmount = (body.customerAmount as number) ?? contract.amount * 0.5;
    const verdict = { providerAmount, customerAmount };

    await supabase
      .from('disputes')
      .update({
        status: "RESOLVED",
        resolution,
        loser_id: (body.loserId as string) || null,
        llm_verdict: JSON.stringify(verdict),
        llm_confidence: body.llmConfidence as number | undefined,
      })
      .eq('contract_id', id)
      .eq('status', 'OPEN');

    if (body.loserId) {
      try {
        const { data: loser } = await supabase
          .from('profiles')
          .select('dispute_losses')
          .eq('id', body.loserId)
          .single();

        await supabase
          .from('profiles')
          .update({ dispute_losses: (loser?.dispute_losses ?? 0) + 1 })
          .eq('id', body.loserId);
      } catch (e) {
        console.warn("Failed to update dispute_losses on profiles:", e);
      }

      const { updateCredit } = await import("@/modules/m07-credit/credit-engine");
      const ev = await appendEvidence({
        eventType: 'dispute_resolved',
        payload: {
          contract_id: id,
          loser_id: body.loserId,
          action: 'auto_settlement',
        },
      });
      if (!ev) throw new Error('Failed to append evidence for dispute resolution');
      await updateCredit({ userId: body.loserId, eventType: 'violation', evidenceId: ev.id, description: 'Dispute lost - auto settlement' }).catch(() => {});
    }

    await Promise.all([
      insertNotification({ userId: contract.customer_id, title: "纠纷已解决", body: `订单 ${id.slice(0, 8)}... 纠纷已解决，请查看结果`, type: "dispute" }),
      insertNotification({ userId: contract.provider_id, title: "纠纷已解决", body: `订单 ${id.slice(0, 8)}... 纠纷已解决，请查看结果`, type: "dispute" }),
    ]);

    updates.dispute_status = "RESOLVED";
  }

  if (action === "settle_after_dispute") {
    const { data: dispute } = await supabase
      .from('disputes')
      .select('llm_verdict')
      .eq('contract_id', id)
      .eq('status', 'RESOLVED')
      .order('updated_at', { ascending: false })
      .limit(1);

    let providerAmount = contract.amount * 0.5;
    let customerAmount = contract.amount * 0.5;
    const lastDispute = dispute?.[0];
    if (lastDispute?.llm_verdict) {
      try {
        const v = JSON.parse(lastDispute.llm_verdict);
        providerAmount = v.providerAmount ?? providerAmount;
        customerAmount = v.customerAmount ?? customerAmount;
      } catch { /* use defaults */ }
    }

    const refund = { provider: providerAmount, customer: customerAmount };
    try {
      await createRefundTransactions(id, contract.customer_id, contract.provider_id, refund, "DISPUTE_REFUND");
    } catch (e) {
      console.warn("Dispute settlement failed:", e);
    }

    updates.fund_status = "SETTLED";
  }

  const { error: updateError } = await supabase
    .from('contracts')
    .update(updates)
    .eq('id', id);

  if (updateError) {
    console.warn("Failed to update contract:", updateError.message);
    return NextResponse.json({ error: "更新订单失败" }, { status: 500 });
  }

  // Re-fetch the updated contract
  const { data: updated } = await supabase
    .from('contracts')
    .select('*')
    .eq('id', id)
    .single();

  let eventMetadata: string | undefined
  if (metadata) {
    eventMetadata = JSON.stringify(metadata)
  } else if (action === "cancel_before_pay" || action === "cancel_during_service") {
    const refund = calcRefund(contract.protocol_id, contract.service_stage, contract.amount);
    eventMetadata = JSON.stringify({ refund });
  }

  await addContractEvent({
    contractId: id,
    actorId: session.user.id,
    fromStatus: contract.fund_status,
    toStatus: nextFundStatus || contract.fund_status,
    action,
    reason: reason || undefined,
    metadata: eventMetadata,
  });

  // Auto settle after cancel
  if (refundSettled) {
    try {
      await supabase
        .from('contracts')
        .update({ fund_status: "SETTLED" })
        .eq('id', id);

      await addContractEvent({
        contractId: id,
        actorId: session.user.id,
        fromStatus: "CANCELLED",
        toStatus: "SETTLED",
        action: "settle_cancelled",
        reason: "退款完成，订单归档",
      });
    } catch (e) {
      console.warn("Auto settle after cancel failed:", e);
    }
  }

  if (action === "confirm_complete" || action === "auto_complete") {
    try {
      await handleSatisfactionBatch(id);
    } catch (e) {
      console.warn("Satisfaction batch update failed:", e);
    }

    await Promise.all([
      insertNotification({ userId: contract.customer_id, title: "订单完成", body: `订单 ${id.slice(0, 8)}... 已完成，请确认评价`, type: "complete" }),
      insertNotification({ userId: contract.provider_id, title: "订单完成", body: `订单 ${id.slice(0, 8)}... 已完成，客户将在72小时内自动确认`, type: "complete" }),
    ]);
  }

  await emitEvent({ type: 'order', id, action, userId: session.user.id, metadata: { fundStatus: nextFundStatus || contract.fund_status } })

  return NextResponse.json({ contract: updated });
}
