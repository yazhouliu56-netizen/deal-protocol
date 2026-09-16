/**
 * 信用滑动窗考卷（P4 · 用户裁决 2026-09-16）。
 * 锁：20 单滑动＋90 天剔除＋前 3 单保护＋阈值复用。
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  CREDIT_NEWCOMER_PROTECT,
  CREDIT_WINDOW_LAST_N,
  CREDIT_WINDOW_MS,
  combineCreditSample,
  selectCreditWindow,
  tierFromCreditWindow,
  type CreditSample,
} from "./credit-window.ts";

const NOW = 10_000_000_000;
const DAY = 24 * 3600_000;
const mk = (daysAgo: number, objective01 = 1, subjective01 = 1): CreditSample => ({
  atMs: NOW - daysAgo * DAY,
  objective01,
  subjective01,
});
const range = (n: number, daysAgo = 1): CreditSample[] =>
  Array.from({ length: n }, (_, i) => mk(daysAgo + i));

test("新人保护：终身 < 3 单沿用旧 tier", () => {
  assert.equal(CREDIT_NEWCOMER_PROTECT, 3);
  assert.equal(tierFromCreditWindow(range(2), NOW, 3), 3);
  assert.equal(tierFromCreditWindow([], NOW, 4), 4);
});

test("90 天外剔除：91 天前单不算", () => {
  assert.equal(CREDIT_WINDOW_MS, 90 * DAY);
  const samples = [...range(3, 1), mk(91), mk(200)];
  const w = selectCreditWindow(samples, NOW);
  assert.equal(w.protected, false);
  assert.equal(w.used, 3);
  assert.equal(w.mean01, 1);
});

test("近 20 单滑动：21 单时最老一单出局", () => {
  assert.equal(CREDIT_WINDOW_LAST_N, 20);
  const samples = [...range(20, 1), { ...mk(21), objective01: 0, subjective01: 0 }];
  const w = selectCreditWindow(samples, NOW);
  assert.equal(w.used, 20);
  assert.equal(w.mean01, 1);
});

test("合成权重：客观 70 / 主观 30", () => {
  assert.equal(combineCreditSample({ objective01: 1, subjective01: 1 }), 1);
  assert.equal(combineCreditSample({ objective01: 1, subjective01: 0 }), 0.7);
  assert.equal(combineCreditSample({ objective01: 0, subjective01: 1 }), 0.3);
});

test("定档复用旧阈值：全满 → Lv5，全零 → Lv1", () => {
  assert.equal(tierFromCreditWindow(range(5), NOW, 3), 5);
  const bad = range(5).map((s) => ({ ...s, objective01: 0, subjective01: 0 }));
  assert.equal(tierFromCreditWindow(bad, NOW, 5), 1);
});
