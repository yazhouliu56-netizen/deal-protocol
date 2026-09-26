/**
 * 见面武装判定考卷（node:test）：三触发独立＋边界＋非法时钟。
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  evaluateMeetupArming,
  isNightHour,
  MEETUP_NIGHT_END_HOUR,
  MEETUP_NIGHT_START_HOUR,
} from "./meetup-guard.ts";

test("夜间窗：22:00 含、06:00 不含、非法值非夜", () => {
  assert.equal(MEETUP_NIGHT_START_HOUR, 22);
  assert.equal(MEETUP_NIGHT_END_HOUR, 6);
  assert.equal(isNightHour(22), true);
  assert.equal(isNightHour(2), true);
  assert.equal(isNightHour(5.99), true);
  assert.equal(isNightHour(6), false);
  assert.equal(isNightHour(12), false);
  assert.equal(isNightHour(21.99), false);
  assert.equal(isNightHour(NaN), false);
});

test("三触发各独立升级（reasons 可叠加）", () => {
  assert.deepEqual(evaluateMeetupArming({ isFirstOrder: true, hourOfDay: 12, homeAccess: false }), {
    level: "ENHANCED",
    reasons: ["first-order"],
  });
  assert.deepEqual(evaluateMeetupArming({ isFirstOrder: false, hourOfDay: 23, homeAccess: false }), {
    level: "ENHANCED",
    reasons: ["night"],
  });
  assert.deepEqual(evaluateMeetupArming({ isFirstOrder: false, hourOfDay: 12, homeAccess: true }), {
    level: "ENHANCED",
    reasons: ["home-access"],
  });
  assert.deepEqual(evaluateMeetupArming({ isFirstOrder: true, hourOfDay: 23, homeAccess: true }).reasons, [
    "first-order",
    "night",
    "home-access",
  ]);
});

test("全无 → STANDARD（零打扰）", () => {
  assert.deepEqual(evaluateMeetupArming({ isFirstOrder: false, hourOfDay: 12, homeAccess: false }), {
    level: "STANDARD",
    reasons: [],
  });
});
