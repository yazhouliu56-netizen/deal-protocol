/**
 * 评价体系 (reviews) — structured, anonymous, time-decayed.
 *
 * Agreed rules (2026-08):
 *   - After both sides confirm fulfilment, EITHER side may review the other
 *     within 72h; after that the system auto-fills a default positive review
 *     (默认好评), keeping the coverage high without friction.
 *   - Reviews are shown MASKED (no reviewer identity), with a time-decay
 *     hint (3 个月前 / 1 个月前 / 1 周前) so long-term history can't be
 *     used to reverse-engineer who reviewed whom.
 *   - Structured 3-dimension score (准时/态度/专业度) + overall stars —
 *     feeds the credit tier and future match weights.
 *
 * Pure + unit-testable; no runtime imports.
 */

export interface ReviewDimensions {
  /** 准时 punctuality 1-5 */
  punctual: number;
  /** 态度 attitude 1-5 */
  attitude: number;
  /** 专业度 professionalism 1-5 */
  professional: number;
}

export interface Review {
  id: string;
  claimId: string;
  /** Reviewer (masked in UI). */
  fromId: string;
  /** Reviewee. */
  toId: string;
  /** Overall stars 1-5 (default = mean of dimensions). */
  score: number;
  dimensions: ReviewDimensions;
  comment?: string;
  at: number;
}

export const REVIEW_WINDOW_MS = 72 * 60 * 60 * 1000;
export const DEFAULT_REVIEW_SCORE = 4.5;

export function meanScore(d: ReviewDimensions): number {
  return (d.punctual + d.attitude + d.professional) / 3;
}

export function createReview(input: {
  id: string;
  claimId: string;
  fromId: string;
  toId: string;
  dimensions: ReviewDimensions;
  comment?: string;
  at: number;
}): Review {
  return {
    id: input.id,
    claimId: input.claimId,
    fromId: input.fromId,
    toId: input.toId,
    dimensions: input.dimensions,
    score: Math.round(meanScore(input.dimensions) * 10) / 10,
    comment: input.comment,
    at: input.at,
  };
}

/** 72h window after fulfilment confirmation; beyond → auto default good review. */
export function reviewDeadline(confirmedAt: number): number {
  return confirmedAt + REVIEW_WINDOW_MS;
}

export function reviewDue(reviewedAt: number, confirmedAt: number, now: number): boolean {
  return confirmedAt <= now && now < reviewDeadline(confirmedAt) && reviewedAt < confirmedAt;
}

/** Time-decay hint for masked display. */
export function decayLabel(reviewedAt: number, now: number): string {
  const ms = now - reviewedAt;
  if (ms < 7 * 24 * 3600_000) return "1 周前";
  if (ms < 30 * 24 * 3600_000) return "1 个月前";
  return "3 个月前";
}

/**
 * Credit tier driven by received reviews:
 *   avg ≥ 4.5 → Lv 5; ≥ 4.0 → 4; ≥ 3.0 → 3; ≥ 2.0 → 2; else 1.
 * Empty history keeps the previous tier (neutral).
 */
export function creditFromReviews(
  reviews: Review[],
  prevTier: number,
  minTier = 1,
  maxTier = 5
): number {
  if (reviews.length === 0) return prevTier;
  const avg =
    reviews.reduce((sum, r) => sum + r.score, 0) / reviews.length;
  if (avg >= 4.5) return maxTier;
  if (avg >= 4.0) return 4;
  if (avg >= 3.0) return 3;
  if (avg >= 2.0) return 2;
  return minTier;
}

/** 响应额度扩容: higher credit earns more daily claims (响应者权益·额度扩容). */
export function dailyQuotaForTier(tier: number): number {
  return tier >= 4 ? 8 : 5;
}
