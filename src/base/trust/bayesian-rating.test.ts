/**
 * 贝叶斯定档考卷（R1 · 用户裁决 2026-09-16）。
 * 锁：m=5＋类目先验＋4 档线性＋双率＋窗内后验定档。
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  BAYES_PRIOR_STRENGTH_M,
  bayesianMean,
  objectiveGoodRate,
  objectiveMultiplier,
  subjectiveGoodRate,
  subjectiveTierScore,
  tierFromBayesianWindow,
  toPunctualFlags,
} from "./bayesian-rating.ts";
import type { CreditSample } from "./credit-window.ts";

const NOW = 10_000_000_000;
const DAY = 24 * 3600_000;
const mk = (daysAgo: number, objective01 = 1, subjective01 = 1): CreditSample => ({
  atMs: NOW - daysAgo * DAY,
  objective01,
  subjective01,
});

test("4 档线性映射：3→1 / 2→2/3 / 1→1/3 / 0→0，越界抛", () => {
  assert.equal(subjectiveTierScore(3), 1);
  assert.equal(subjectiveTierScore(2), 2 / 3);
  assert.equal(subjectiveTierScore(1), 1 / 3);
  assert.equal(subjectiveTierScore(0), 0);
  assert.throws(() => subjectiveTierScore(4), /INVALID_SAMPLES/);
  assert.equal(BAYES_PRIOR_STRENGTH_M, 5);
});

test("后验：0 样本回先验；多样本趋向样本均值（无悬崖）", () => {
  assert.equal(bayesianMean(0, 0, 0.8), 0.8);
  assert.equal(bayesianMean(10, 10, 0.8), (5 * 0.8 + 10) / 15);
  // 100 单全满：后验 ≈0.99，几乎只信自己
  const veteran = bayesianMean(100, 100, 0.8);
  assert.ok(veteran > 0.98 && veteran <= 1);
  // 1 单差评不判死刑：后验仍被先验托住
  assert.ok(bayesianMean(0, 1, 0.8) > 0.6);
  assert.throws(() => bayesianMean(1, 1, 1.5), /INVALID_PRIOR/);
});

test("双率：客观=准时率，主观=≥2 勾占比；空窗回 null", () => {
  assert.deepEqual(objectiveGoodRate([true, true, false]), { rate: 2 / 3, n: 3 });
  assert.deepEqual(subjectiveGoodRate([3, 2, 1, 0]), { rate: 0.5, n: 4 });
  assert.deepEqual(objectiveGoodRate([]), { rate: null, n: 0 });
});

test("准时 flag：仅完工计入，违约记 false，非完工丢弃（R6）", () => {
  assert.deepEqual(
    toPunctualFlags([
      { completed: true, breached: false },
      { completed: true, breached: true },
      { completed: false, breached: false },
      { completed: false, breached: true },
    ]),
    [true, false],
  );
  assert.deepEqual(toPunctualFlags([]), []);
});

test("客观乘子：1→1.0 / 0→0.9 / null→1.0，越界抛（R7·A 温和口径）", () => {
  assert.equal(objectiveMultiplier(1), 1.0);
  assert.equal(objectiveMultiplier(0), 0.9);
  assert.equal(objectiveMultiplier(0.5), 0.95);
  assert.equal(objectiveMultiplier(null), 1.0);
  assert.throws(() => objectiveMultiplier(1.5), /INVALID_SAMPLES/);
  assert.throws(() => objectiveMultiplier(NaN), /INVALID_SAMPLES/);
});

test("窗内定档：新人保护沿用旧 tier；全满冲 Lv5", () => {
  const fresh: CreditSample[] = [mk(1), mk(2)];
  assert.equal(tierFromBayesianWindow(fresh, NOW, 0.8, 3), 3);
  const good = Array.from({ length: 5 }, (_, i) => mk(i + 1));
  assert.equal(tierFromBayesianWindow(good, NOW, 0.8, 3), 5);
});
