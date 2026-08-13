/**
 * Reputation — a single credit tier per identity, fed by:
 *   - reviews (default 5★ when unrated past 72h)
 *   - breach penalty (Δ from settleBreach)
 *   - verified certification
 *   - on-time / completion events
 *
 * Also hosts the privacy rules: review timelines are shuffled for viewers,
 * only the platform keeps true timestamps.
 */

export const DEFAULT_REVIEW_TTL_MS = 72 * 60 * 60 * 1000;

export type CreditTier = 1 | 2 | 3 | 4 | 5;

export interface ReviewSummaryInput {
  /** star rating for the completed meet. */
  rating: number;
  createdAt: number;
  /** true, un-masked timestamp — kept for the platform ledger. */
  reviewedAt: number;
}

export interface CreditProfile {
  tier: CreditTier;
  verified: boolean;
  /** Completed-and-confirmed service count (basis for rating weight). */
  completions: number;
}

/** Check if a review slot defaulted to 5★ (un-rated within 72h). */
export function defaultedToGoodReview(
  completedAt: number,
  reviewedAt: number,
  now = Date.now()
): boolean {
  return (
    reviewedAt - completedAt >= DEFAULT_REVIEW_TTL_MS ||
    now - completedAt >= DEFAULT_REVIEW_TTL_MS
  );
}

/**
 * Derive a new credit tier from evidence. Simple ladder:
 *   ≥20 completions & avg≥4.8         → 5
 *   ≥8  completions & avg≥4.5         → 4
 *   completions ≥ 3 or avg≥4.0        → 3
 *   avg≥3.0                           → 2
 *   otherwise                         → 1
 * Verified certification always floors the tier at 3.
 */
export function creditTierFrom(
  completions: number,
  avgRating: number,
  verified: boolean
): CreditTier {
  let tier: CreditTier = 1;
  if (completions >= 8 && avgRating >= 4.5) tier = 4;
  else if (completions >= 3 && avgRating >= 4) tier = 3;
  else if (avgRating >= 3) tier = 2;
  if (completions >= 20 && avgRating >= 4.8) tier = 5;
  return Math.max((verified ? 3 : 1) as CreditTier, tier) as CreditTier;
}

/** Apply a breach delta (-1, etc.) to the tier, clamped to [1,5]. */
export function applyCreditDelta(tier: number, delta: number): CreditTier {
  return Math.max(1, Math.min(5, tier + delta)) as CreditTier;
}

/**
 * Mask the review timeline before showing it to a user (time-jumble line).
 * Keeps true order in the tray (`orderKept` false → shuffled); the backing
 * store still holds real timestamps.
 */
export function maskTimeline<T extends { createdAt: number }>(
  items: T[],
  shuffleSeed: number
): T[] {
  const copy = [...items].sort((a, b) => b.createdAt - a.createdAt);
  if (!(shuffleSeed > 0)) return copy;
  // Deterministic Fisher–Yates from the seed (viewers can't infer chronology).
  let s = shuffleSeed >>> 0;
  const rand = () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 2 ** 32;
  };
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [copy[i], copy[j]] = [copy[j]!, copy[i]!];
  }
  return copy;
}

/** Anonymous display: first char of nickname + suffix. */
export function maskName(name: string): string {
  return `${name.slice(0, 1)}**`;
}