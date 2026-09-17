/**
 * 取消补偿考卷（P6 · 用户裁决 2026-09-18）。
 * 锁：3 分钟冷静免费 / 未到×1 / 已到×2 / 无封顶 / 非法输入抛错。
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { computeCompensation } from "./compensation.ts";

const T0 = 1_800_000_000_000;
const MIN = 60_000;

test("冷静期 3 分钟内免费（含边界）", () => {
  assert.deepEqual(
    computeCompensation({ assignedAtMs: T0, cancelAtMs: T0 + 3 * MIN, etaMin: 25, hourlyRate: 60, arrived: false }),
    { free: true, amount: 0 },
  );
  assert.deepEqual(
    computeCompensation({ assignedAtMs: T0, cancelAtMs: T0 + MIN, etaMin: 25, hourlyRate: 60, arrived: true }),
    { free: true, amount: 0 },
  );
});

test("未到达：预估×基准（北京 25 分钟×60 元/时 = 25 元）", () => {
  const r = computeCompensation({ assignedAtMs: T0, cancelAtMs: T0 + 10 * MIN, etaMin: 25, hourlyRate: 60, arrived: false });
  assert.equal(r.free, false);
  assert.equal(r.amount, 25);
});

test("已到达：×2（含往返）", () => {
  const r = computeCompensation({ assignedAtMs: T0, cancelAtMs: T0 + 10 * MIN, etaMin: 25, hourlyRate: 60, arrived: true });
  assert.equal(r.amount, 50);
});

test("非法输入抛错", () => {
  assert.throws(() => computeCompensation({ assignedAtMs: T0, cancelAtMs: T0 - 1, etaMin: 25, hourlyRate: 60, arrived: false }), /INVALID_TIME/);
  assert.throws(() => computeCompensation({ assignedAtMs: T0, cancelAtMs: T0 + 10 * MIN, etaMin: -5, hourlyRate: 60, arrived: false }), /INVALID_ETA/);
  assert.throws(() => computeCompensation({ assignedAtMs: T0, cancelAtMs: T0 + 10 * MIN, etaMin: 25, hourlyRate: -1, arrived: false }), /INVALID_RATE/);
});
