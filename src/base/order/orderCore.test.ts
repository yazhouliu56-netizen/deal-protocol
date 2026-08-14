import { test } from "node:test";
import assert from "node:assert/strict";
import { orderStatusOf, toOrderCore, type OrderCore } from "./orderCore.ts";
import { createWave, type Wave } from "./wave.ts";
import type { DepositPhase } from "../money/deposit.ts";

const baseWave = (over: Partial<Parameters<typeof createWave>[0]>): Wave =>
  createWave({
    id: "w1",
    authorId: "u1",
    basics: { category: "羽毛球", time: "明天 11:00", area: "幸福家园", radiusKm: 3 },
    budget: 200,
    capacity: 4,
    expiresAt: Date.now() + 3600_000,
    createdAt: Date.now(),
    ...over,
  } as Parameters<typeof createWave>[0]);

test("OrderCore 契约形状 — 必需字段齐全且类型正确", () => {
  const core: OrderCore = {
    id: "o1",
    ownerId: "u1",
    status: "matched",
    amountYuan: 200,
    capacity: 4,
    expiresAt: 1000,
    createdAt: 0,
  };
  assert.equal(core.status, "matched");
  assert.equal(core.amountYuan, 200);
});

test("orderStatusOf 全状态映射", () => {
  assert.equal(orderStatusOf("pending"), "pending");
  assert.equal(orderStatusOf("active"), "matched");
  assert.equal(orderStatusOf("claimed"), "matched");
  assert.equal(orderStatusOf("locked"), "locked");
  assert.equal(orderStatusOf("assembled"), "assembled");
  assert.equal(orderStatusOf("closed"), "cancelled");
  assert.equal(orderStatusOf("expired"), "expired");
  assert.equal(orderStatusOf("未知"), "pending");
});

test("toOrderCore 投影 — Wave → OrderCore 视图", () => {
  const wave = baseWave({ capacity: 4, hotness: 7 });
  const core = toOrderCore(wave);
  assert.deepEqual(core, {
    id: "w1",
    ownerId: "u1",
    status: "matched",
    amountYuan: 200,
    capacity: 4,
    startsAt: undefined,
    expiresAt: wave.expiresAt,
    createdAt: wave.createdAt,
    slotIds: undefined,
    ext: { hotness: 7 },
  });
});

test("toOrderCore 投影 — claimed 波 slotIds 含认领人", () => {
  const claim: DepositPhase = "held";
  void claim;
  const wave = baseWave({});
  const claimed = { ...wave, status: "claimed" as const, claimedById: "r1" };
  const core = toOrderCore(claimed);
  assert.equal(core.status, "matched");
  assert.deepEqual(core.slotIds, ["r1"]);
});

/** 投影桥自洽：任意合法 Wave 都能投影且不抛错（弹药 ↔ 底座契约约束）。 */
test("投影桥自洽 — 全 WaveStatus 枚举遍历", () => {
  const statuses = [
    "pending",
    "active",
    "claimed",
    "locked",
    "assembled",
    "closed",
    "expired",
  ] as const;
  for (const s of statuses) {
    const wave = baseWave({});
    const core = toOrderCore({ ...wave, status: s });
    assert.ok(core.status.length > 0);
    assert.equal(typeof core.amountYuan, "number");
  }
});