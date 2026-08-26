/**
 * 订单状态跃迁子处理器（P2-7 巨石控制器瘦身 · 自 route.ts PATCH 主链原位平移）。
 * 职责：引擎前置校验 → 支付（HELD 跃迁，经 PaymentRegistry）/ 退款 /
 * 争议三动作分派 → fund_status CAS 乐观锁写回 → 存证/事件/通知。
 * HTTP 响应契约与状态码逐字守恒。
 */
import { createHash } from "crypto";
import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { auth } from "@/lib/auth";
import { getServiceClient } from "@/lib/supabase-client";
import { addContractEvent } from "@/lib/contract/events";
import { handleSatisfactionBatch } from "@/lib/contract/satisfaction";
import { createRefundTransactions } from "@/lib/contract/refund";
// D-5 Phase C：状态机校验权威收编 Base 纯函数核（门面 contract-machine 已退役）。
import {
  calcContractRefund,
  getNextFundStatus,
  getNextServiceStage,
  validateContractAction,
} from "@/base/order/contract-engine";
// D-5 Phase E：协议定义资产归位 Base（静态数据，DB 热配已退役）
import { getProtocol } from "@/base/order/protocol-definitions";
import { emitEvent } from "@/lib/event-bus";
import { appendEvidence } from "@/modules/m11-evidence-log/evidence-chain";
// P0-2 隔离墙收编：资金分割一律经 base 确定性引擎（src/base/money/escrow.ts），
// 路由不再内联任何分账比例硬编码（红线 1 精神）。
// P1-5 改道：支付统一走 PaymentRegistry（createPaymentVia 门面，provider
// 缺省 stripe 与 lib/payment.ts 时代一致）。
import { createPaymentVia } from "@/adapters/payment/registry";

import {
  applyDisputeOpen,
  applyResolveDispute,
  buildSettleAfterDisputeUpdates,
  type NotifyFn,
} from "./order-dispute";

/** 通知写入（原 route.ts insertNotification 原位平移）。 */
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

const notify: NotifyFn = insertNotification;

export async function handleOrderPatch(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "未登录" }, { status: 401 });
  }

  const { supabase } = session;
  const body = await request.json();
  const { action, reason, metadata, evidence, latitude, longitude, photoUrl, photoHash } = body;

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

  // D-5 Phase C：引擎解析前置（校验/推导/退款统一经 Base 纯函数核求值）
  const protocolDef = getProtocol(contract.protocol_id);

  const transitionCtx = {
    contract: {
      id: contract.id,
      fundStatus: contract.fund_status ?? "",
      disputeStatus: contract.dispute_status,
      serviceStage: contract.service_stage ?? 0,
      providerId: contract.provider_id,
      customerId: contract.customer_id,
      amount: contract.amount,
      completedAt: contract.completed_at,
      autoCompleteAt: contract.auto_complete_at,
    },
    actor: { id: user.id, role: actorRole },
    payload: body,
  };
  const guardError = protocolDef
    ? validateContractAction(
        protocolDef,
        action,
        {
          fundStatus: transitionCtx.contract.fundStatus,
          serviceStage: transitionCtx.contract.serviceStage,
          role: actorRole,
        },
        transitionCtx,
      )
    : `未知协议: ${contract.protocol_id}`;

  if (guardError) {
    return NextResponse.json({ error: guardError }, { status: 400 });
  }

  const nextFundStatus = protocolDef
    ? getNextFundStatus(protocolDef, action)
    : null;
  const nextStage = protocolDef
    ? getNextServiceStage(protocolDef, action)
    : null;

  const updates: Record<string, unknown> = {};

  if (nextFundStatus) {
    updates.fund_status = nextFundStatus;
  }
  if (nextStage !== null) {
    updates.service_stage = nextStage;
  }

  // Payment: any action that transitions to HELD（P1-5 改道 PaymentRegistry）
  const payActions = protocolDef
    ?.transitions.filter((t) => t.from !== t.to && t.to === "HELD")
    .map((t) => t.action) ?? [];
  if (payActions.includes(action)) {
    const paymentProvider = (body.paymentProvider as string) ?? "stripe";

    const paymentResult = await createPaymentVia({
      orderId: id,
      amount: contract.amount,
      description: `订单支付: ${id}`,
      payerId: session.user.id,
      provider: paymentProvider,
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
        provider: paymentProvider,
        provider_payment_id: paymentResult.providerPaymentId,
      })
      .eq('contract_id', id);

    updates.fund_status = "HELD";

    await Promise.all([
      notify({ userId: contract.customer_id, title: "支付成功", body: `订单 ${id.slice(0, 8)}... 支付已完成，资金已托管`, type: "pay" }),
      notify({ userId: contract.provider_id, title: "支付成功", body: `订单 ${id.slice(0, 8)}... 客户已付款，请开始服务`, type: "pay" }),
    ]);
  }

  // Auto-complete timer: transitioning to final service stage
  const stageNames = protocolDef?.serviceStages ?? null;
  if (stageNames && nextStage !== null && nextStage >= stageNames.length - 1) {
    const timeoutSeconds = protocolDef?.funding.autoReleaseTimeout ?? (72 * 3600);
    updates.auto_complete_at = new Date(Date.now() + (timeoutSeconds * 1000)).toISOString();
  }

  if (action === "confirm_complete" || action === "auto_complete") {
    const now = new Date();
    updates.completed_at = now.toISOString();
    updates.auto_complete_at = null;
  }

  let refundSettled = false;
  if (action === "cancel_before_pay" || action === "cancel_during_service") {
    // 引擎缺席时与旧门面语义一致：无规则默认全退
    const refund = protocolDef
      ? calcContractRefund(protocolDef, contract.service_stage, contract.amount)
      : { provider: 0, customer: contract.amount };
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
  const DISPUTE_OPS = ["open_dispute", "open_dispute_after_complete", "report_no_show"];
  const disputeCtx = {
    id,
    contract,
    userId: session.user.id,
    body,
    reason,
    evidence,
  };
  if (DISPUTE_OPS.includes(action)) {
    const disputeUpdates = await applyDisputeOpen(disputeCtx, action, notify);
    if (!disputeUpdates) {
      return NextResponse.json({ error: "创建争议失败" }, { status: 500 });
    }
    Object.assign(updates, disputeUpdates);
  }

  if (action === "resolve_dispute") {
    const resolveUpdates = await applyResolveDispute(disputeCtx, protocolDef, supabase, notify);
    Object.assign(updates, resolveUpdates);
  }

  if (action === "settle_after_dispute") {
    const settleUpdates = await buildSettleAfterDisputeUpdates(disputeCtx, supabase, createRefundTransactions);
    Object.assign(updates, settleUpdates);
  }

  // P0-2 收编：资金/状态跃迁主写回带 fund_status CAS 乐观锁（等价于既有
  // mvp 表 orders.version 语义；contracts 无 version 列时以状态为并发锚点），
  // 并发/重复请求返回确定性 409，杜绝双写覆盖。
  const { data: lockedRow, error: updateError } = await supabase
    .from('contracts')
    .update(updates)
    .eq('id', id)
    .eq('fund_status', contract.fund_status)
    .select("id")
    .maybeSingle();

  if (updateError) {
    console.warn("Failed to update contract:", updateError.message);
    return NextResponse.json({ error: "更新订单失败" }, { status: 500 });
  }

  if (!lockedRow) {
    return NextResponse.json(
      { error: "订单状态已被其他操作变更，请刷新后重试", code: "OPTIMISTIC_LOCK_CONFLICT" },
      { status: 409 },
    );
  }

  const STAGE_NAMES = ['NOT_ACCEPTED', 'ACCEPTED', 'DEPARTED', 'ARRIVED', 'IN_PROGRESS', 'DONE'] as const;
  if (nextStage !== null && nextStage !== contract.service_stage) {
    const stageName = STAGE_NAMES[nextStage];
    if (stageName) {
      // 批次 3b 改道：阶段存证统一走 m11 appendEvidence（哈希委托 Base 权威 SSOT），
      // payload 以结构化对象入库（修复旧 tracker 字符串 payload 的 schema 破坏）。
      appendEvidence({
        orderId: id,
        eventType: `STAGE_${stageName}`,
        payload: {
          stage: stageName,
          userId: session.user.id,
          userIp:
            request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
            request.headers.get('x-real-ip') ||
            null,
          coords: latitude && longitude ? [longitude, latitude] : null,
          photoHash: photoHash ?? (photoUrl ? createHash('sha256').update(photoUrl).digest('hex') : null),
        },
        capturedBy: session.user.id,
      }).catch((e) => console.warn('Stage evidence tracking failed:', e));
    }
  }

  // Re-fetch the updated contract
  const { data: updated } = await supabase
    .from('contracts')
    .select('*')
    .eq('id', id)
    .single();

  let eventMetadata: string | undefined;
  if (metadata) {
    eventMetadata = JSON.stringify(metadata);
  } else if (action === "cancel_before_pay" || action === "cancel_during_service") {
    const refund = protocolDef
      ? calcContractRefund(protocolDef, contract.service_stage, contract.amount)
      : { provider: 0, customer: contract.amount };
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
      notify({ userId: contract.customer_id, title: "订单完成", body: `订单 ${id.slice(0, 8)}... 已完成，请确认评价`, type: "complete" }),
      notify({ userId: contract.provider_id, title: "订单完成", body: `订单 ${id.slice(0, 8)}... 已完成，客户将在72小时内自动确认`, type: "complete" }),
    ]);
  }

  await emitEvent({ type: 'order', id, action, userId: session.user.id, metadata: { fundStatus: nextFundStatus || contract.fund_status } });

  revalidatePath(`/demands/${id}`);
  revalidatePath('/profile');

  return NextResponse.json({ contract: updated });
}
