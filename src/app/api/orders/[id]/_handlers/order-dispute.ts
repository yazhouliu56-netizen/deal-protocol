/**
 * 订单争议子处理器（P2-7 巨石控制器瘦身 · 自 route.ts PATCH 争议域原位平移）。
 * 覆盖三动作：开争议（DISPUTE_OPS）/ 仲裁结案（resolve_dispute）/
 * 争议后结算（settle_after_dispute）。HTTP 行为与状态码逐字守恒。
 */
import { getServiceClient } from "@/lib/supabase-client";
import { calculateMultiPartySplit } from "@/base/money/escrow";
import { appendEvidence } from "@/modules/m11-evidence-log/evidence-chain";
import { getProtocol } from "@/base/order/protocol-definitions";

/** 通知写入回调（由 PATCH 主链注入，保持单一实现）。 */
export type NotifyFn = (n: { userId: string; title: string; body: string; type: string }) => Promise<void>;

/** auth() 会话的 supabase 客户端（与原 route.ts 同源）。 */
type SupabaseClient = NonNullable<
  Awaited<ReturnType<typeof import("@/lib/auth")["auth"]>>
> extends infer S
  ? S extends { supabase: infer C }
    ? C
    : never
  : never;

/** 争议子处理器共享上下文。 */
export interface DisputeContext {
  id: string;
  contract: {
    amount: number;
    customer_id: string;
    provider_id: string;
    protocol_id: string;
    fund_status: string;
    service_stage: number;
  };
  userId: string;
  body: Record<string, unknown>;
  reason?: string;
  evidence?: unknown;
}

type Updates = Record<string, unknown>;

/**
 * 开争议（open_dispute / open_dispute_after_complete / report_no_show）：
 * 三级仲裁通道分派 + disputes 建单 + 对方通知。
 * 返回 null 表示建单失败（调用方直接透传既有 500 响应）。
 */
export async function applyDisputeOpen(
  ctx: DisputeContext,
  action: string,
  insertNotification: NotifyFn,
): Promise<Updates | null> {
  const protocolDef = getProtocol(ctx.contract.protocol_id);
  const channels = protocolDef?.dispute.channels;
  let channel = "red";
  if (channels) {
    if (ctx.contract.amount <= channels.green.maxAmount) {
      channel = "green";
    } else if (channels.yellow && ctx.contract.amount <= channels.yellow.maxAmount) {
      channel = "yellow";
    }
  }

  const svc = getServiceClient();
  const { error: disputeCreateError } = await svc
    .from('disputes')
    .insert({
      contract_id: ctx.id,
      initiator_id: ctx.userId,
      protocol_id: ctx.contract.protocol_id,
      channel,
      reason: ctx.reason || (action === "open_dispute_after_complete" ? "质保争议" : action === "report_no_show" ? "对方未到" : "服务争议"),
      evidence: ctx.evidence || null,
    });

  if (disputeCreateError) {
    console.warn("Failed to create dispute:", JSON.stringify(disputeCreateError));
    return null;
  }

  const otherPartyId = ctx.contract.customer_id === ctx.userId ? ctx.contract.provider_id : ctx.contract.customer_id;
  await insertNotification({ userId: otherPartyId, title: "纠纷已开启", body: `订单 ${ctx.id.slice(0, 8)}... 发起了纠纷，请及时处理`, type: "dispute" });

  return { dispute_status: "OPEN", auto_complete_at: null };
}

/**
 * 仲裁结案（resolve_dispute）：五五开默认裁决经 escrow 确定性分账原语
 * （P0-2 收编口径守恒），败方信用联动 + 存证链落账。
 */
export async function applyResolveDispute(
  ctx: DisputeContext,
  protocolDef: ReturnType<typeof getProtocol>,
  supabase: SupabaseClient,
  insertNotification: NotifyFn,
): Promise<Updates> {
  void protocolDef;
  const { id, contract, body } = ctx;
  const resolution = ctx.reason || "仲裁结案";

  const { data: dispute } = await supabase
    .from('disputes')
    .select('llm_verdict')
    .eq('contract_id', id)
    .eq('status', 'OPEN')
    .single();
  void dispute;

  // P0-2 收编：默认五五开裁决不再内联 `amount * 0.5`，改由 escrow 确定性
  // 分账原语承载（1 人群组 · 50% 口径 = 双方各半，金额守恒由 base 保证）。
  const split = calculateMultiPartySplit(contract.amount, 0.5, 1);
  const providerAmount = (body.providerAmount as number) ?? split.providerIncome;
  const customerAmount = (body.customerAmount as number) ?? split.platformIncome;
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
    await updateCredit({ userId: body.loserId as string, eventType: 'violation', evidenceId: ev.id, description: 'Dispute lost - auto settlement' }).catch(() => {});
  }

  await Promise.all([
    insertNotification({ userId: contract.customer_id, title: "纠纷已解决", body: `订单 ${id.slice(0, 8)}... 纠纷已解决，请查看结果`, type: "dispute" }),
    insertNotification({ userId: contract.provider_id, title: "纠纷已解决", body: `订单 ${id.slice(0, 8)}... 纠纷已解决，请查看结果`, type: "dispute" }),
  ]);

  return { dispute_status: "RESOLVED" };
}

/**
 * 争议后结算（settle_after_dispute）：以最近一次 RESOLVED 争议的裁决金额
 * 为准（缺省回落五五开 escrow 口径），经 createRefundTransactions 结算。
 */
export async function buildSettleAfterDisputeUpdates(
  ctx: DisputeContext,
  supabase: SupabaseClient,
  createRefundTransactions: typeof import("@/lib/contract/refund")["createRefundTransactions"],
): Promise<Updates> {
  const { id, contract, body } = ctx;
  const { data: dispute } = await supabase
    .from('disputes')
    .select('llm_verdict')
    .eq('contract_id', id)
    .eq('status', 'RESOLVED')
    .order('updated_at', { ascending: false })
    .limit(1);

  // P0-2 收编：默认分账经 escrow 原语（与 resolve_dispute 同一口径，杜绝
  // 路由内两处 0.5 各自实现的分叉风险）。
  const settleSplit = calculateMultiPartySplit(contract.amount, 0.5, 1);
  let providerAmount = settleSplit.providerIncome;
  let customerAmount = settleSplit.platformIncome;
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
  void body;

  return { fund_status: "SETTLED" };
}
