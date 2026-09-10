import { test } from "node:test";
import assert from "node:assert/strict";
import {
  canAddItem,
  canFreeCancel,
  canReschedule,
  FREE_CANCEL_MS,
  needsAcceptReminder,
  sanitizeNewCustom,
  sanitizeNewTime,
} from "./intervene.ts";
test("B1: 无责窗边界 299/300/301s", () => {
  assert.equal(canFreeCancel(0, 299_000), true);
  assert.equal(canFreeCancel(0, FREE_CANCEL_MS), true);
  assert.equal(canFreeCancel(0, FREE_CANCEL_MS + 1000), false);
  assert.equal(canFreeCancel(0, -1), false);
});

test("改期/加项：仅未开工", () => {
  for (const s of ["PUBLISHED", "MATCHED"] as const) {
    assert.equal(canReschedule(s), true);
    assert.equal(canAddItem(s), true);
  }
  for (const s of ["IN_SERVICE", "INSPECTED", "SETTLED"] as const) {
    assert.equal(canReschedule(s), false);
    assert.equal(canAddItem(s), false);
  }
});

test("输入清洗：空/超长/重复拦截", () => {
  assert.equal(sanitizeNewTime("  明晚 7 点 "), "明晚 7 点");
  assert.equal(sanitizeNewTime("   "), null);
  assert.equal(sanitizeNewTime(123), null);
  assert.equal(sanitizeNewCustom("洗油烟机", ["洗油烟机"]), null);
  assert.equal(sanitizeNewCustom("洗油烟机", []), "洗油烟机");
});

test("T3a: 师傅报完工＋未验收才提醒", () => {
  assert.equal(needsAcceptReminder(123456, false), true);
  assert.equal(needsAcceptReminder(123456, true), false);
  assert.equal(needsAcceptReminder(undefined, false), false);
  assert.equal(needsAcceptReminder(0, false), false);
});
