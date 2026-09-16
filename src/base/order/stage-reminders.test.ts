/**
 * 阶段提醒槽位考卷（P4 · 用户裁决 2026-09-16）。
 * 锁：六态索引跨锁＋双侧槽位＋缺文案显式 missing（不断头）。
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { CONTRACT_SERVICE_STAGES } from "./contract-engine.ts";
import { STAGE_REMINDER_SLOTS, remindersFor } from "./stage-reminders.ts";

test("槽位与六态索引跨锁（NOT_ACCEPTED 0 … DONE 5）", () => {
  assert.deepEqual(CONTRACT_SERVICE_STAGES, {
    NOT_ACCEPTED: 0,
    ACCEPTED: 1,
    DEPARTED: 2,
    ARRIVED: 3,
    IN_PROGRESS: 4,
    DONE: 5,
  });
  assert.equal(STAGE_REMINDER_SLOTS.length, 10);
});

test("每推进阶段双侧各一槽；未接单零打扰", () => {
  for (const stage of ["ACCEPTED", "DEPARTED", "ARRIVED", "IN_PROGRESS", "DONE"] as const) {
    const sides = remindersFor(stage, {}).map((r) => r.side).sort();
    assert.deepEqual(sides, ["customer", "provider"]);
  }
  assert.deepEqual(remindersFor("NOT_ACCEPTED", {}), []);
});

test("缺文案标 missing 不抛（UI 隐藏＋覆盖率考卷兜底）", () => {
  const rs = remindersFor("ARRIVED", { "provider.arrived.checkin": "打卡" });
  const provider = rs.find((r) => r.side === "provider")!;
  const customer = rs.find((r) => r.side === "customer")!;
  assert.equal(provider.copyMissing, false);
  assert.equal(provider.copy, "打卡");
  assert.equal(customer.copyMissing, true);
  assert.equal(customer.copy, null);
});

test("强制项只落在服务者三处（接单/到场/开工），用户侧无 forced", () => {
  const forced = STAGE_REMINDER_SLOTS.filter((s) => s.level === "forced");
  assert.deepEqual(
    forced.map((s) => `${s.side}.${s.stage}`).sort(),
    ["provider.ACCEPTED", "provider.ARRIVED", "provider.IN_PROGRESS"],
  );
});
