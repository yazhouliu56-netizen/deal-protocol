/**
 * 组局者订阅（纯本地 demo）—— 商业化前哨的本地状态机。
 * 价值钩子：开通后「组局加速」，自己的需求在雷达区优先曝光 + 到期前提醒。
 * 支付走现有模拟收银台，这里只管理订阅生命周期（幂等、无副作用）。
 */

export const ORGANIZER_PLAN = {
  name: "组局加速",
  priceYuan: 9.9,
  durationDays: 30,
} as const;

export type OrganizerSubscription = {
  status: "none" | "active" | "expired";
  /** ISO date the current subscription period started (renew keeps the anchor). */
  startedAt?: string;
  /** ISO date it expires — the single source of truth for "active". */
  expiresAt?: string;
};

export type OrganizerStatus = "none" | "active" | "expired";

/** Derive status from stored period — never trust a stored status field. */
export function subStatus(
  sub: OrganizerSubscription,
  now: Date = new Date()
): OrganizerStatus {
  if (!sub.expiresAt) return "none";
  return new Date(sub.expiresAt) > now ? "active" : "expired";
}

/** Start a fresh period; renewing extends from now or the current expiry (whichever is later). */
export function renewSubscription(
  sub: OrganizerSubscription,
  now: Date = new Date()
): OrganizerSubscription {
  const anchor = sub.expiresAt
    ? new Date(Math.max(new Date(sub.expiresAt).getTime(), now.getTime()))
    : now;
  const expiresAt = new Date(
    anchor.getTime() + ORGANIZER_PLAN.durationDays * 24 * 60 * 60 * 1000
  );
  return {
    status: "active",
    startedAt: sub.startedAt ?? now.toISOString(),
    expiresAt: expiresAt.toISOString(),
  };
}

/** Whole days remaining until expiry (0 when already expired). */
export function subDaysLeft(
  sub: OrganizerSubscription,
  now: Date = new Date()
): number {
  if (!sub.expiresAt) return 0;
  const ms = new Date(sub.expiresAt).getTime() - now.getTime();
  return ms > 0 ? Math.ceil(ms / (24 * 60 * 60 * 1000)) : 0;
}