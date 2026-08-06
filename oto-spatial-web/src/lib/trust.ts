/**
 * 开放局信任闭环 (Trust loop) — the three uncapped gaps that close the money
 * flow around open match (Playtomic / BlaBlaCar 对标):
 *
 *   ① 成团失败退款 (group-fail refund): an open match expires without filling —
 *      every paid seat (joiners + initiator) is refunded in full, original channel.
 *   ② 24h 分级取消 (24h tiered cancellation): cancelling an open match before it
 *      starts refunds by lead time — ≥24h full, <24h partial, queue-time none.
 *   ③ no-show 欠款锁定 (no-show lockout): a breached (no-show) seat stays
 *      unsettled → its owner can't publish or join until settled.
 *
 * 注意：本模块只读 `type` 导入（避免运行时依赖 waver.ts 的无后缀 ESM 解析问题），
 * 所以 isOpenMatch / 退款 = 独立内联实现，语义与 wave.ts:isOpenMatch、
 * pay.ts:decideRefund 一致（调用方 store 负责持久化/联动）。
 */

import type { Wave, Claim } from "./wave";
import type { PayOrder } from "./pay";

/** 24h 免费取消窗口（standards: ≥24h lead 全额退）。 */
export const FREE_CANCEL_MS = 24 * 3600_000;
/** 分级扣留比例（<24h 取消：只退 80%，20% 当鸽子险/场地押金）。 */
export const PARTIAL_RATIO = 0.8;

const isOpenMatch = (wave: Pick<Wave, "capacity">): boolean =>
  wave.capacity >= 2;
const isWaveExpired = (wave: Wave, now: number): boolean =>
  wave.expiresAt < now;

/**
 * 退款订单构造（等效 pay.decideRefund + refundAmount）：
 * 只允许从 paid 退，返回 { status:"refunded", note } 的订单副本与退款金额。
 * 对齐 pay ledger 语义。
 */
function refundOrder(
  order: PayOrder,
  ratio: number,
  note: string
): { order: PayOrder; amount: number } {
  if (order.status !== "paid") return { order, amount: 0 };
  const ratioNorm = Math.min(1, Math.max(0, ratio));
  return {
    order: { ...order, status: "refunded", note },
    amount: Math.round(order.amount * ratioNorm),
  };
}

/* ---------------------------------------------------------------------------
 * ① 成团失败退款
 * ------------------------------------------------------------------------- */

export interface GroupFailSettlement {
  /** Pay orders that moved paid → refunded (same wave, full ratio). */
  refunded: PayOrder[];
  /** Amount back per order id (order.id → refund). */
  refunds: Record<string, number>;
  /** Whether the expired open match actually settled (idempotency gate). */
  settled: boolean;
}

/**
 * 成团失败结算：open match active 且过期 → 该局所有已付订单原路全退。
 * 幂等：已非 active / 非开放局 / 未过期 → settled=false，调用方不动 state。
 */
export function settleGroupFail(input: {
  wave: Wave;
  orders: PayOrder[];
  now?: number;
}): GroupFailSettlement {
  const now = input.now ?? Date.now();
  const canSettle =
    isOpenMatch(input.wave) &&
    input.wave.status === "active" &&
    isWaveExpired(input.wave, now);
  if (!canSettle) {
    return { refunded: [], refunds: {}, settled: false };
  }
  const refunded: PayOrder[] = [];
  const refunds: Record<string, number> = {};
  for (const order of input.orders) {
    if (order.waveId !== input.wave.id || order.status !== "paid") continue;
    const out = refundOrder(order, 1, "成团失败：自动全额退回");
    refunded.push(out.order);
    refunds[order.id] = out.amount;
  }
  return { refunded, refunds, settled: true };
}

/* ---------------------------------------------------------------------------
 * ② 24h 分级取消
 * ------------------------------------------------------------------------- */

export type CancelTier = "free" | "partial" | "none";

export interface TierRatio {
  tier: CancelTier;
  /** Fraction of the seat paid that is returned (0..1). */
  ratio: number;
  /** Human label representative for UI copy. */
  label: string;
}

/**
 * Cancellation tier by lead time to `startsAt`:
 *   ≥24h         → free    (1.0)
 *   [0, 24h)     → partial (0.8 — 20% 鸽子险/场地押金)
 *   already past / missing startsAt → none (0)
 */
export function tierRatio(
  startsAt: number | undefined,
  now: number
): TierRatio {
  if (startsAt === undefined || !Number.isFinite(startsAt)) {
    return { tier: "none", ratio: 0, label: "无开始时间：取消不退（老数据退化）" };
  }
  const lead = startsAt - now;
  if (lead >= FREE_CANCEL_MS) {
    return { tier: "free", ratio: 1, label: "提前 24h 以上：全额退" };
  }
  if (lead >= 0) {
    return {
      tier: "partial",
      ratio: PARTIAL_RATIO,
      label: "24h 内取消：退 80%（20% 鸽子险/场地押金）",
    };
  }
  return { tier: "none", ratio: 0, label: "已开始（临场取消）：不退钱" };
}

/**
 * 按档位批量退一个局的已付订单（发起人取消用）。
 * 返回订单副本列表（paid → refunded）+ 退金额映射，全部原路退回。
 */
export function refundByTier(input: {
  waveId: string;
  orders: PayOrder[];
  startsAt: number | undefined;
  now?: number;
}): { refunded: PayOrder[]; refunds: Record<string, number> } {
  const now = input.now ?? Date.now();
  const t = tierRatio(input.startsAt, now);
  const refunded: PayOrder[] = [];
  const refunds: Record<string, number> = {};
  for (const order of input.orders) {
    if (order.waveId !== input.waveId || order.status !== "paid") continue;
    const out = refundOrder(order, t.ratio, `发起人取消：${t.label}`);
    refunded.push(out.order);
    refunds[order.id] = out.amount;
  }
  return { refunded, refunds };
}

/* ---------------------------------------------------------------------------
 * ③ no-show 欠款锁定
 * ------------------------------------------------------------------------- */

/**
 * 欠款锁定判定：该用户存在未结清的 no-show 违约（breached 且未 settle）→
 * 不能发布新局 / 不能拼位。settle 标记由 store 的 settleBreach 置位。
 */
export function hasUnsettledBreach(
  claims: Claim[],
  userId: string
): boolean {
  return claims.some(
    (c) =>
      c.responderId === userId &&
      c.status === "breached" &&
      !c.settled
  );
}