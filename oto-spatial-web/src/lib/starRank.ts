/**
 * 服务商星级成长 — tasker star growth (Airtasker-style dual metrics).
 *
 *   Overall ★  : mean of the last `window` reviews' score (1-5).
 *   Completion : share of last `window` accepted claims that were fulfilled
 *                (vs breached) — the "reliability" axis Airtasker shows
 *                alongside the rating.
 *
 * `starWeight` plugs into broadcast scoring: ★≥4 with ≥90% completion gets a
 * small match-weight bonus (the demander sees better-ranked high performers).
 *
 * Pure + unit-testable; type-only imports.
 */

import type { Review } from "./review";
import type { Claim } from "./wave";

export interface StarStats {
  count: number;
  /** Mean overall score, 1 decimal. */
  avg: number;
  /** Visual star level 1-5 (0 = unrated). */
  star: number;
  /** 0-1 share of fulfilled vs breached claims; 1 when no history. */
  completion: number;
}

export const REVIEW_WINDOW = 20;

/** Mean of the last `window` reviews for a responder (by `toId`). */
export function reviewStats(
  reviews: Review[],
  responderId: string,
  window = REVIEW_WINDOW
): StarStats {
  const mine = reviews
    .filter((r) => r.toId === responderId)
    .sort((a, b) => b.at - a.at)
    .slice(0, window);
  if (mine.length === 0) {
    return { count: 0, avg: 0, star: 0, completion: 1 };
  }
  const avg = mine.reduce((s, r) => s + r.score, 0) / mine.length;
  return {
    count: mine.length,
    avg: Math.round(avg * 10) / 10,
    star: Math.min(5, Math.max(1, Math.round(avg))),
    completion: 1,
  };
}

/**
 * Completion rate from the last `window` accepted claims: fulfilled vs
 * breached. Claims still in flight are excluded (neither outcome yet).
 */
export function completionRate(
  claims: Claim[],
  responderId: string,
  window = REVIEW_WINDOW
): number {
  const mine = claims
    .filter((c) => c.responderId === responderId)
    .sort((a, b) => b.createdAt - a.createdAt)
    .slice(0, window);
  const settled = mine.filter(
    (c) => c.fulfilledAt || c.status === "breached"
  );
  if (settled.length === 0) return 1;
  const fulfilled = settled.filter((c) => c.fulfilledAt).length;
  return fulfilled / settled.length;
}

/** Match-weight bonus: ★≥4 + ≥90% completion → +5 (credit segment). */
export function starWeight(star: number, completion: number): number {
  return star >= 4 && completion >= 0.9 ? 5 : 0;
}

/** Airtasker-style one-liner for profile cards. */
export function rankLabel(stats: StarStats): string {
  if (stats.count === 0) return "新响应者 · 暂无评价";
  const pct = Math.round(stats.completion * 100);
  return `${"★".repeat(stats.star)}${"☆".repeat(5 - stats.star)} ${stats.avg} · 完成率 ${pct}%`;
}
