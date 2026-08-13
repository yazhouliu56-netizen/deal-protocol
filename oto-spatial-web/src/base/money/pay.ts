/**
 * 随单支付（Pay-at-order）— simulated immediate payment.
 *
 * Money follows the ORDER, not a top-up balance. A single is published only
 * after its full amount is paid (scene 1) or the initiator's own share is
 * paid (scene 2). The wallet is purely a retention vehicle — refunds /
 * compensation land there by the user's choice (original channel OR wallet).
 *
 * All rules are pure functions over a `PayOrder` ledger so the exact shape
 * the real-money pipeline (P5 escrow / 微信支付) will keep is locked in.
 */

export type PayRefundTarget = "original" | "wallet";

export type PayStatus =
  /** Logged but awaiting the "user paid" confirmation. */
  | "unpaid"
  /** Full amount captured — the single is live. */
  | "paid"
  /** Money moved to the counterparty (fulfilment release). */
  | "released"
  /** Money returned to the payer (cancel / group-fail / partial refund). */
  | "refunded";

/**
 * 随单里钱的用途：单子金额（定金/全款） vs 平台发布费。
 * 两者独立存在：发布费一经支付不退（发布动作已发生），退款/取消只作用于 seat。
 */
export type PayKind = "seat" | "publish-fee";

/** 每日免费发布次数（超出后每次收 PUBLISH_FEE）。 */
export const FREE_PUBLISH_PER_DAY = 3;
/** 超量发布费（独立于单子金额，一经支付不退）。 */
export const PUBLISH_FEE = 1;

export interface PayOrder {
  id: string;
  /** What this money pays for: the wave it funds (always present). */
  waveId: string;
  /** Who paid. */
  payerId: string;
  /** Amount captured. */
  amount: number;
  status: PayStatus;
  /** seat = 单子金额（可退）；publish-fee = 平台发布费（不退）。 */
  kind: PayKind;
  createdAt: number;
  paidAt?: number;
  /** Copy left by release/refund for the audit trail. */
  note?: string;
}

export interface RefundDecision {
  order: PayOrder;
  /** Fraction of `amount` returned (0..1). Defaults to full on cancel. */
  ratio: number;
  target: PayRefundTarget;
  note: string;
  at: number;
}

/** A simulated payment captures ticks; money is "in" once the user pays. */
export function createPayOrder(input: {
  id: string;
  waveId: string;
  payerId: string;
  amount: number;
  kind?: PayKind;
  createdAt?: number;
}): PayOrder {
  return {
    id: input.id,
    waveId: input.waveId,
    payerId: input.payerId,
    amount: Math.round(input.amount),
    status: "unpaid",
    kind: input.kind ?? "seat",
    createdAt: input.createdAt ?? Date.now(),
  };
}

/** Mark a simulated payment as captured. Pure; the store persists it. */
export function capturePayOrder(
  order: PayOrder,
  at = Date.now()
): PayOrder {
  return { ...order, status: "paid", paidAt: at };
}

/**
 * Release money to the counterparty (fulfilment done). Keeps the trail.
 * Returns the order with status "released".
 */
export function releasePayOrder(
  order: PayOrder,
  note = "服务完成放款"
): PayOrder {
  if (order.status !== "paid") {
    throw new Error("pay.not-paid");
  }
  return { ...order, status: "released", note };
}

/**
 * Refund decision: how much of a paid order comes back and where it lands.
 * `ratio` < 1 is a partial refund (service penalty, tiered cancellation).
 * Pure — the caller applies the wallet credit / original-channel return.
 */
export function decideRefund(
  order: PayOrder,
  input: {
    ratio?: number;
    target: PayRefundTarget;
    note: string;
    at?: number;
  }
): RefundDecision {
  if (order.status !== "paid") {
    throw new Error("pay.not-paid");
  }
  const ratio = Math.min(1, Math.max(0, input.ratio ?? 1));
  return {
    order: { ...order, status: "refunded", note: input.note },
    ratio,
    target: input.target,
    note: input.note,
    at: input.at ?? Date.now(),
  };
}

/** Amount that actually returns under a refund decision. */
export function refundAmount(
  order: PayOrder,
  decision: RefundDecision
): number {
  return Math.round(order.amount * decision.ratio);
}

/**
 * Group no-show compensation: a paid seat that never shows up is NOT
 * refunded. Its money shares out to the other attendees, or the initiator
 * earns a "next match easier to fill" buff (needed joiners −1).
 */
export function splitNoShow(
  order: PayOrder,
  beneficiaryCount: number
): number {
  if (order.status !== "paid") {
    throw new Error("pay.not-paid");
  }
  const recipients = Math.max(1, beneficiaryCount);
  return Math.floor(order.amount / recipients);
}