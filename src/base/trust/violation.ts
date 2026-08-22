/**
 * Breach handling — the demander is the judge, the platform is the ledger.
 *
 * MVP uses a virtual balance (initial ¥100) — the real-money pipeline
 * (爽约保障险 / 微信支付) lands in P5; the state machine stays identical.
 *
 *   responder breaches → must explain, ask for forgiveness
 *   demander forgives  → ¥5 light penalty
 *   demander doesn't   → ¥30 + credit −1 level + 3 days of half response quota
 */

export const INITIAL_BALANCE = 100;
export const FORGIVE_PENALTY = 5;
export const UNFORGIVEN_PENALTY = 30;
export const QUOTA_HALF_MS = 3 * 24 * 60 * 60 * 1000;

export interface VirtualAccount {
  balance: number;
  /** Unix ms until response quota returns to normal (half while active). */
  quotaHalfUntil?: number;
}

export interface BreachReport {
  claimId: string;
  responderId: string;
  /** Required — the breach reason presented to the demander. */
  explanation: string;
  createdAt: number;
}

export type BreachVerdict = "forgive" | "unforgiven";

export interface BreachOutcome {
  account: VirtualAccount;
  creditDelta: number;
  penalty: number;
  message: string;
}

/**
 * Apply the demander's verdict after a breach explanation.
 * Pure: returns the new account + credit delta (applied by the caller store).
 */
export function settleBreach(
  account: VirtualAccount,
  verdict: BreachVerdict,
  now = Date.now()
): BreachOutcome {
  if (verdict === "forgive") {
    return {
      account: {
        ...account,
        balance: Math.max(0, account.balance - FORGIVE_PENALTY),
      },
      creditDelta: 0,
      penalty: FORGIVE_PENALTY,
      message: "已获谅解，扣除轻微保证金（爽约保障险象征）¥5",
    };
  }
  return {
    account: {
      balance: Math.max(0, account.balance - UNFORGIVEN_PENALTY),
      quotaHalfUntil: now + QUOTA_HALF_MS,
    },
    creditDelta: -1,
    penalty: UNFORGIVEN_PENALTY,
    message: "未获谅解：扣除 ¥30 + 信用降 1 级 + 3 天响应额度减半",
  };
}

/** Is the responder's daily claim quota halved right now? */
export function quotaHalved(account: VirtualAccount, now = Date.now()): boolean {
  return !!account.quotaHalfUntil && account.quotaHalfUntil > now;
}