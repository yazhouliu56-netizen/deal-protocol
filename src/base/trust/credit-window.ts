/**
 * 信用滑动窗真相源（P4 · 用户裁决 2026-09-16）。
 *
 * 六圈定位：第 2 圈业务核心（信任资产，宪法 #6 跨弹药累积）。
 * 规则锁死：近 20 单滑动 ＋ 90 天外剔除 ＋ 新人前 3 单保护
 *（终身单数 < 3 → 保护，沿用旧 tier，不进权重——冷启动 N=3 同逻辑）。
 * 客观 70 / 主观 30（A 轨事实是基础；权重为导出常量，待用户拍确认可调）。
 * 定档阈值不另起炉灶，复用 review.creditFromReviews（单一阈值真相源）。
 *
 * Pure + unit-testable; 同域导入 review。
 */

import { creditFromReviews, type Review } from "./review.ts";

/** 滑动窗：近 20 单。 */
export const CREDIT_WINDOW_LAST_N = 20;
/** 时间衰减：90 天外剔除（简单剔除，v1 不做指数衰减）。 */
export const CREDIT_WINDOW_MS = 90 * 24 * 3600_000;
/** 新人保护：终身 < 3 单不进权重。 */
export const CREDIT_NEWCOMER_PROTECT = 3;
/** 合成权重：客观 70（A 轨是基础）/ 主观 30。 */
export const CREDIT_OBJECTIVE_WEIGHT = 0.7;
export const CREDIT_SUBJECTIVE_WEIGHT = 0.3;

export interface CreditSample {
  atMs: number;
  /** 客观轨 0–1（旧 1–5 分 ÷ 5；准时等 SLA 客观项已在其内）。 */
  objective01: number;
  /** 主观轨 0–1（subjective-check.passRate）。 */
  subjective01: number;
}

const clamp01 = (n: number): number =>
  !Number.isFinite(n) ? 0 : Math.min(1, Math.max(0, n));

/** 双轨合成一分（0–1）。 */
export function combineCreditSample(sample: Pick<CreditSample, "objective01" | "subjective01">): number {
  return (
    clamp01(sample.objective01) * CREDIT_OBJECTIVE_WEIGHT +
    clamp01(sample.subjective01) * CREDIT_SUBJECTIVE_WEIGHT
  );
}

export interface CreditWindow {
  /** 保护中（终身 < 3 单）：调用方沿用旧 tier。 */
  protected: boolean;
  /** 窗内均值 0–1。 */
  mean01: number;
  /** 窗内实际采用单数。 */
  used: number;
}

/** 选窗：90 天内倒序取近 20 单；终身 < 3 单直接保护。 */
export function selectCreditWindow(samples: CreditSample[], nowMs: number): CreditWindow {
  const lifetime = samples.length;
  if (lifetime < CREDIT_NEWCOMER_PROTECT) return { protected: true, mean01: 0, used: 0 };
  const cutoff = nowMs - CREDIT_WINDOW_MS;
  const inWindow = samples
    .filter((s) => Number.isFinite(s.atMs) && s.atMs <= nowMs && s.atMs > cutoff)
    .sort((a, b) => b.atMs - a.atMs)
    .slice(0, CREDIT_WINDOW_LAST_N);
  if (inWindow.length === 0) return { protected: true, mean01: 0, used: 0 };
  const mean01 = inWindow.reduce((s, x) => s + combineCreditSample(x), 0) / inWindow.length;
  return { protected: false, mean01, used: inWindow.length };
}

/** 定档：保护 → 沿用旧 tier；否则窗均值映射（阈值复用 creditFromReviews）。 */
export function tierFromCreditWindow(
  samples: CreditSample[],
  nowMs: number,
  prevTier: number,
): number {
  const window = selectCreditWindow(samples, nowMs);
  if (window.protected) return prevTier;
  const pseudo = [{ score: window.mean01 * 5 } as Review];
  return creditFromReviews(pseudo, prevTier);
}
