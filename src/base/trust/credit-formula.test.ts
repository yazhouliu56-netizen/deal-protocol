/**
 * credit-formula 上收 Base 域考卷（原 packages/credit-formula 无随包单测，本卷为净增）：
 * 六维加权合成 / 冷启动 / 年龄因子 / 活跃衰减 / 双方加权总分——字节级等价锚定。
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  COMPOSITE_WEIGHTS,
  ageFactor,
  coldStartProtection,
  computeCompositeScore,
  computeTotalScore,
  decayFactor,
} from "./credit-formula.ts";

const FULL_DIMS = {
  integrity: 100,
  capability: 100,
  reliability: 100,
  communication: 100,
  safety: 100,
  contribution: 100,
};

test("权重表守恒：六维权和为 1", () => {
  const sum = Object.values(COMPOSITE_WEIGHTS).reduce((a, b) => a + b, 0);
  assert.ok(Math.abs(sum - 1) < 1e-9);
});

test("computeCompositeScore：全满分 × 满龄满活跃 = 100 封顶", () => {
  assert.equal(computeCompositeScore(FULL_DIMS), 100);
});

test("computeCompositeScore：加权求和与四舍五入精确锚定", () => {
  const dims = { integrity: 80, capability: 60, reliability: 40, communication: 20, safety: 100, contribution: 0 };
  // 80*.25 + 60*.2 + 40*.2 + 20*.15 + 100*.15 + 0 = 58
  assert.equal(computeCompositeScore(dims), 58);
});

test("computeCompositeScore：age×decay 乘子链与下限钳位", () => {
  assert.equal(computeCompositeScore(FULL_DIMS, { age: 0.5, decay: 0.8 }), 40);
  assert.equal(computeCompositeScore({ ...FULL_DIMS, integrity: -999 }, { age: 1, decay: 1 }), 0);
});

test("ageFactor：新户趋零、30 天封顶为 1", () => {
  const now = Date.now();
  assert.equal(ageFactor(new Date(now)), 0);
  assert.equal(ageFactor(new Date(now - 15 * 24 * 3600 * 1000)), 0.5);
  assert.equal(ageFactor(new Date(now - 90 * 24 * 3600 * 1000)), 1);
});

test("decayFactor：null 视为满活跃，每闲置日线性衰减 1%，地板 0", () => {
  assert.equal(decayFactor(null), 1);
  const now = Date.now();
  assert.ok(Math.abs(decayFactor(new Date(now - 10 * 24 * 3600 * 1000)) - 0.9) < 1e-9);
  assert.equal(decayFactor(new Date(now - 365 * 24 * 3600 * 1000)), 0);
});

test("coldStartProtection：<3 笔有效订单触发保护", () => {
  assert.equal(coldStartProtection(0), true);
  assert.equal(coldStartProtection(2), true);
  assert.equal(coldStartProtection(3), false);
});

test("computeTotalScore：默认 0.6 服务方权重 + 自定义权重", () => {
  assert.equal(computeTotalScore(100, 50), 80);
  assert.equal(computeTotalScore(100, 50, 0.4), 70);
});
