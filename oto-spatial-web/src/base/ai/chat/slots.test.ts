import { test } from "node:test";
import assert from "node:assert/strict";
import { decorateWeekendLabels, thisWeekend } from "./slots.ts";

test("thisWeekend returns sat strictly after today", () => {
  const { sat, sun } = thisWeekend();
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  assert.ok(sat.getTime() > today.getTime(), "周六必须晚于今天");
  assert.equal(sat.getDay(), 6);
  assert.equal(sun.getDay(), 0);
  assert.equal(sun.getTime() - sat.getTime(), 24 * 3600 * 1000);
});

test("decorateWeekendLabels prepends real dates, keeps id/order", () => {
  const slots = [
    { id: "t1", label: "周六 14:00", sub: "2 小时", density: 45 },
    { id: "t2", label: "周日 10:00", sub: "2 小时", density: 25 },
  ];
  const out = decorateWeekendLabels(slots);
  assert.equal(out.length, 2);
  assert.equal(out[0].id, "t1");
  assert.match(out[0].label, /^\d{1,2}月\d{1,2}日 周六 14:00$/);
  assert.match(out[1].label, /^\d{1,2}月\d{1,2}日 周日 10:00$/);
  assert.equal(out[0].density, 45); // other fields untouched
});
