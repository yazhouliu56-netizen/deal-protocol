import { test } from "node:test";
import assert from "node:assert/strict";
import {
  MIN_MODULES,
  equalWeights,
  mockDecompose,
  moduleAmounts,
  normalizeModules,
} from "./decompose.ts";

test("normalizeModules: 通过合法模块（名称+验收+权重和=100）", () => {
  const out = normalizeModules([
    { name: "粉刷墙壁", acceptance: "墙面干透无流痕", weight: 60 },
    { name: "清理垃圾", acceptance: "无残留杂物", weight: 40 },
  ]);
  assert.equal(out.ok, true);
  if (out.ok) assert.equal(out.modules.length, 2);
});

test("normalizeModules: 少于 2 模块 → 拒绝", () => {
  const out = normalizeModules([{ name: "A", acceptance: "ok", weight: 100 }]);
  assert.equal(out.ok, false);
  if (!out.ok) assert.match(out.error, /至少/);
});

test("normalizeModules: 权重和不为 100 → 拒绝", () => {
  const out = normalizeModules([
    { name: "A", acceptance: "ok", weight: 50 },
    { name: "B", acceptance: "ok", weight: 30 },
  ]);
  assert.equal(out.ok, false);
  if (!out.ok) assert.match(out.error, /100%/);
});

test("normalizeModules: 重复模块名 → 拒绝", () => {
  const out = normalizeModules([
    { name: "A", acceptance: "x", weight: 50 },
    { name: "A", acceptance: "y", weight: 50 },
  ]);
  assert.equal(out.ok, false);
  if (!out.ok) assert.match(out.error, /重复/);
});

test("equalWeights: 兜底等分且权重和=100", () => {
  const mods = equalWeights(3);
  const sum = mods.reduce((s, m) => s + m.weight, 0);
  assert.equal(mods.length, 3);
  assert.equal(sum, 100);
});

test("moduleAmounts: 按权重分钱，末模块吃尾差", () => {
  const amounts = moduleAmounts(
    [
      { name: "A", acceptance: "", weight: 33 },
      { name: "B", acceptance: "", weight: 33 },
      { name: "C", acceptance: "", weight: 34 },
    ],
    100
  );
  assert.equal(amounts.reduce((s, a) => s + a.amount, 0), 100);
  assert.equal(amounts[0].amount, 33);
  assert.equal(amounts[2].amount, 34);
});

test("MIN_MODULES 暴露为 2", () => {
  assert.equal(MIN_MODULES, 2);
});

test("mockDecompose: 上门保洁 → 到场+交付 2 模块，权重和=100", () => {
  const mods = mockDecompose({ category: "保洁", note: "清理整个房间", budget: 200 });
  assert.ok(mods.length >= 2);
  assert.equal(mods.reduce((s, m) => s + m.weight, 0), 100);
  assert.ok(mods.every((m) => m.name && m.acceptance));
});

test("mockDecompose: 非上门类 → 3 模块兜底", () => {
  const mods = mockDecompose({ category: "设计", note: "做个海报", budget: 300 });
  assert.equal(mods.length, 3);
  assert.equal(mods.reduce((s, m) => s + m.weight, 0), 100);
});