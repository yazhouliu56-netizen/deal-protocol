/**
 * 评价隐私四件真相源（R2 · 用户裁决 2026-09-16）。
 *
 * 六圈定位：第 4 圈安全风控＋第 2 圈信任。本地服务距离近＝报复成本低，
 * 服务者端只见双率（客观好评率＋主观好评率），永远见不到“谁说了什么”：
 * - 双盲 72h：双方都交或窗到，同时揭晓（Airbnb 14 天同构，防互评报复）。
 * - k-匿名（k=5）：明细攒够 5 条才露，在此之前只显示档位；
 *   72h 内 1 单数学上无法反推（档位是多单平均，单条 movement≈0）。
 * - 随机延迟：k 攒够后 3–7 天随机放（抖动由调用方抽好传入），防时间对号。
 * - 报复监测（v1 上）：差评后 30 天内拒接该用户记嫌疑；
 *   2 嫌疑 = 一次差评权重，3 嫌疑停派 7 天（与爽约对齐）。
 * - 私密 coaching：匿名＋k 门＋延迟后给本人，不进分；
 *   平台留全量真数为派单/仲裁/监测调用（边界：永不展示、永不外传）。
 *
 * Pure + unit-testable; no runtime imports.
 */

/** k-匿名：明细展示至少 5 条（用户裁决）。 */
export const REVIEW_K_ANONYMITY = 5;
/** 随机延迟窗：3–7 天（用户裁决；抖动值由调用方抽取传入）。 */
export const REVEAL_JITTER_MIN_DAYS = 3;
export const REVEAL_JITTER_MAX_DAYS = 7;
/** 报复监测窗：差评后 30 天。 */
export const RETALIATION_WINDOW_MS = 30 * 24 * 3600_000;
/** 罚则线：2 嫌疑 = 一次差评权重；3 嫌疑停派 7 天。 */
export const RETALIATION_WEIGHT_AT = 2;
export const RETALIATION_SUSPEND_AT = 3;
export const RETALIATION_SUSPEND_DAYS = 7;

export type PrivacyErrorCode = "INVALID_TIMESTAMP" | "INVALID_JITTER";

export class PrivacyError extends Error {
  readonly code: PrivacyErrorCode;
  constructor(code: PrivacyErrorCode, message?: string) {
    super(message ? `[${code}] ${message}` : `[${code}]`);
    this.name = "PrivacyError";
    this.code = code;
  }
}

/**
 * 双盲可见性（按查看者判定）：双方都交 → 互见；任一方未交 →
 * 窗到才见。未到揭晓条件，对方永远看不见“我交了什么”。
 */
export function blindRevealVisible(
  viewerSubmitted: boolean,
  peerSubmitted: boolean,
  deadlineMs: number,
  nowMs: number,
): boolean {
  if (!Number.isFinite(deadlineMs) || !Number.isFinite(nowMs)) {
    throw new PrivacyError("INVALID_TIMESTAMP", "deadline/now 非法");
  }
  if (viewerSubmitted && peerSubmitted) return true;
  return nowMs >= deadlineMs;
}

/** k 门：已揭晓明细数 ≥5 才可展示明细。 */
export function kGatePassed(revealedCount: number, k: number = REVIEW_K_ANONYMITY): boolean {
  if (!Number.isInteger(revealedCount) || revealedCount < 0) return false;
  return revealedCount >= k;
}

/** 释放时刻 = 提交时刻 ＋ 抖动天数（抖动须落在 [3,7] 天内）。 */
export function revealAt(submittedAtMs: number, jitterDays: number): number {
  if (!Number.isFinite(submittedAtMs)) throw new PrivacyError("INVALID_TIMESTAMP", "submittedAt 非法");
  if (!Number.isFinite(jitterDays) || jitterDays < REVEAL_JITTER_MIN_DAYS || jitterDays > REVEAL_JITTER_MAX_DAYS) {
    throw new PrivacyError("INVALID_JITTER", `抖动须落在 [${REVEAL_JITTER_MIN_DAYS},${REVEAL_JITTER_MAX_DAYS}] 天，收到 ${jitterDays}`);
  }
  return submittedAtMs + jitterDays * 24 * 3600_000;
}

export function isReleasable(releaseAtMs: number, nowMs: number): boolean {
  if (!Number.isFinite(releaseAtMs) || !Number.isFinite(nowMs)) return false;
  return nowMs >= releaseAtMs;
}

export interface RetaliationPenalty {
  /** 嫌疑数。 */
  suspicions: number;
  /** 折合差评权重数（2 嫌疑 = 1）。 */
  badReviewEquivalents: number;
  /** 停派天数（3 嫌疑 = 7）。 */
  suspendDays: number;
}

/**
 * 报复嫌疑计数：差评时刻后 30 天窗内，每拒接/取消该用户一次记 1 嫌疑。
 * declinesAtMs = 窗内拒接时刻数组（由调用方验真传入）。
 */
export function countRetaliationSuspicions(
  badReviewAtMs: number,
  declinesAtMs: number[],
  nowMs: number,
): number {
  if (!Number.isFinite(badReviewAtMs) || !Number.isFinite(nowMs)) return 0;
  const end = Math.min(badReviewAtMs + RETALIATION_WINDOW_MS, nowMs);
  return declinesAtMs.filter((t) => Number.isFinite(t) && t > badReviewAtMs && t <= end).length;
}

/** 报复罚则（与爽约停服对齐）。 */
export function retaliationPenalty(suspicions: number): RetaliationPenalty {
  const n = Number.isInteger(suspicions) && suspicions > 0 ? suspicions : 0;
  if (n >= RETALIATION_SUSPEND_AT) {
    return { suspicions: n, badReviewEquivalents: 1, suspendDays: RETALIATION_SUSPEND_DAYS };
  }
  if (n >= RETALIATION_WEIGHT_AT) {
    return { suspicions: n, badReviewEquivalents: 1, suspendDays: 0 };
  }
  return { suspicions: n, badReviewEquivalents: 0, suspendDays: 0 };
}
