/**
 * 贝叶斯定档真相源（R1 · 用户裁决 2026-09-16）。
 *
 * 六圈定位：第 2 圈业务核心（信任资产，宪法 #6）。算法透明：
 * 全式公开、可审计；私密评分保留但仅平台侧调用（派单/仲裁/监测），不进分。
 *
 * 规则锁死：
 * - 先验强度 m=5（≈旧 3 单保护＋余量），先验值 = 同类目滚动均值
 *   （由调用方算好传入；水涨船高自动跟；无类目数据回落 0.8）。
 * - 后验 = (m·先验 ＋ Σ窗内合成样本) / (m ＋ n)，无悬崖。
 * - 主观 4 档线性映射（透明）：3 勾完美=1、2 勾好评=2/3、1 勾中=1/3、0 勾差=0。
 * - 双分呈现、独立计算：客观分 = 准时率；主观好评率 = ≥2 勾占比。
 * - 定档阈值复用 review.creditFromReviews（单一阈值真相源）。
 * - 窗选择复用 credit-window（20 单/90 天/前 3 保护）。
 *
 * Pure + unit-testable; 同域导入 review / credit-window。
 */

import { creditFromReviews, type Review } from "./review.ts";
import { selectCreditWindow, type CreditSample } from "./credit-window.ts";

/** 先验强度：5 单等效（用户裁决）。 */
export const BAYES_PRIOR_STRENGTH_M = 5;
/** 无类目数据时的回落先验（0.8 = 中上，不奖不罚）。 */
export const BAYES_FALLBACK_PRIOR = 0.8;

export type BayesianErrorCode = "INVALID_PRIOR" | "INVALID_SAMPLES";

export class BayesianError extends Error {
  readonly code: BayesianErrorCode;
  constructor(code: BayesianErrorCode, message?: string) {
    super(message ? `[${code}] ${message}` : `[${code}]`);
    this.name = "BayesianError";
    this.code = code;
  }
}

/** 主观 4 档 → 0–1（线性：勾数/3，完美 1 / 好评 2/3 / 中 1/3 / 差 0）。 */
export function subjectiveTierScore(passedCount: number): number {
  if (!Number.isInteger(passedCount) || passedCount < 0 || passedCount > 3) {
    throw new BayesianError("INVALID_SAMPLES", `勾数须为 0–3 整数，收到 ${passedCount}`);
  }
  return passedCount / 3;
}

/** 贝叶斯后验：(m·prior ＋ sum) / (m ＋ n)。n=0 时恒回先验。 */
export function bayesianMean(
  sumX: number,
  n: number,
  priorMean: number,
  m: number = BAYES_PRIOR_STRENGTH_M,
): number {
  if (!Number.isFinite(priorMean) || priorMean < 0 || priorMean > 1) {
    throw new BayesianError("INVALID_PRIOR", `先验须落在 [0,1]，收到 ${priorMean}`);
  }
  if (!Number.isInteger(n) || n < 0 || !Number.isFinite(sumX) || sumX < 0) {
    throw new BayesianError("INVALID_SAMPLES", `sum/n 非法：${sumX}/${n}`);
  }
  if (!(m >= 0) || !Number.isFinite(m)) {
    throw new BayesianError("INVALID_PRIOR", `先验强度须为非负有限数，收到 ${m}`);
  }
  return (m * priorMean + sumX) / (m + n);
}

export interface DualRate {
  /** 有效率 0–1（无数据为 null，UI 显示“—”）。 */
  rate: number | null;
  n: number;
}

/** 客观好评率 = 准时单占比（违约记迟到）。 */
export function objectiveGoodRate(punctualFlags: boolean[]): DualRate {
  const n = punctualFlags.length;
  if (n === 0) return { rate: null, n: 0 };
  return { rate: punctualFlags.filter(Boolean).length / n, n };
}

/** 主观好评率 = ≥2 勾（完美＋好评）占比。 */
export function subjectiveGoodRate(passedCounts: number[]): DualRate {
  const n = passedCounts.length;
  if (n === 0) return { rate: null, n: 0 };
  for (const c of passedCounts) subjectiveTierScore(c);
  return { rate: passedCounts.filter((c) => c >= 2).length / n, n };
}

/**
 * 窗内贝叶斯定档：窗选择（20/90天/前3保护）→ 合成样本求和 →
 * 后验 → 旧阈值定档。保护中沿用旧 tier。
 */
export function tierFromBayesianWindow(
  samples: CreditSample[],
  nowMs: number,
  priorMean: number,
  prevTier: number,
): number {
  const window = selectCreditWindow(samples, nowMs);
  if (window.protected) return prevTier;
  const posterior = bayesianMean(window.mean01 * window.used, window.used, priorMean);
  return creditFromReviews([{ score: posterior * 5 } as Review], prevTier);
}
