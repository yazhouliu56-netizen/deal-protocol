/**
 * 阶段划分考卷（P7 · 用户裁决 2026-09-18）。
 * 锁：≤5 段 / 权重整数和≡100 / 标题验收非空 / 金额守恒 / 单阶段兜底。
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  validateStagePlan,
  defaultSingleStage,
  stageAmounts,
} from "./plan.ts";

test("合法三段（30/40/30）通过", () => {
  assert.deepEqual(
    validateStagePlan([
      { title: "水电", weightPct: 30, acceptance: "通水通电测试通过" },
      { title: "泥木", weightPct: 40, acceptance: "墙面平整度达标" },
      { title: "油漆", weightPct: 30, acceptance: "色差无肉眼可见" },
    ]),
    [],
  );
});

test("超 5 段拒绝", () => {
  const plan = Array.from({ length: 6 }, (_, i) => ({
    title: `阶段${i + 1}`, weightPct: 10, acceptance: "验收",
  }));
  plan[0]!.weightPct = 50;
  assert.match(validateStagePlan(plan).join(";"), /超上限 5/);
});

test("权重和≠100 拒绝（含小数权重）", () => {
  assert.match(
    validateStagePlan([
      { title: "A", weightPct: 30, acceptance: "x" },
      { title: "B", weightPct: 60, acceptance: "x" },
    ]).join(";"),
    /≠100/,
  );
  assert.match(
    validateStagePlan([{ title: "A", weightPct: 33.3, acceptance: "x" }]).join(";"),
    /正整数/,
  );
});

test("标题/验收缺失拒绝", () => {
  assert.equal(
    validateStagePlan([{ title: "", weightPct: 100, acceptance: "" }]).length, 2,
  );
});

test("阶段金额守恒（300 元 30/40/30 = 90/120/90）", () => {
  assert.deepEqual(stageAmounts(300, [
    { title: "水电", weightPct: 30, acceptance: "x" },
    { title: "泥木", weightPct: 40, acceptance: "x" },
    { title: "油漆", weightPct: 30, acceptance: "x" },
  ]), [90, 120, 90]);
});

test("非整除守恒（100 元三三开余数进最大余数段）", () => {
  const out = stageAmounts(100, [
    { title: "A", weightPct: 33, acceptance: "x" },
    { title: "B", weightPct: 33, acceptance: "x" },
    { title: "C", weightPct: 34, acceptance: "x" },
  ]);
  assert.equal(out.reduce((s, x) => s + x, 0), 100);
});

test("单阶段兜底合法", () => {
  assert.deepEqual(validateStagePlan(defaultSingleStage()), []);
});
