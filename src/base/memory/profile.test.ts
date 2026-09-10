import { test } from "node:test";
import assert from "node:assert/strict";
import {
  applyRememberEdit,
  rememberEdit,
  resolveDefaults,
} from "./profile.ts";

test("C1: 改一次即记（白名单三键）", () => {
  assert.deepEqual(rememberEdit("time", "  明晚 7 点 "), { timePref: "明晚 7 点" });
  assert.deepEqual(rememberEdit("budget", "120", { prevBudgetYuan: 150 }), { priceSense: "save" });
  assert.deepEqual(rememberEdit("budget", "180", { prevBudgetYuan: 150 }), { priceSense: "loose" });
  assert.deepEqual(rememberEdit("note", "带自家猫粮上门，到了轻点敲门别吵猫"), { noteHabit: "detailed" });
  assert.deepEqual(rememberEdit("note", "轻点"), { noteHabit: "brief" });
});

test("C1: 红线——位置/品类/金额明细不进记忆", () => {
  assert.equal(rememberEdit("area", "幸福家园小区"), null);
  assert.equal(rememberEdit("category", "保洁"), null);
  assert.equal(rememberEdit("budget", "150", { prevBudgetYuan: 150 }), null);
  assert.equal(rememberEdit("budget", "150"), null);
  assert.equal(rememberEdit("time", "   "), null);
});

test("C1: 下次同场景默认命中＋合并", () => {
  const p = applyRememberEdit(null, { timePref: "明晚 7 点" }, 1000);
  assert.equal(p.timePref, "明晚 7 点");
  const hit = resolveDefaults({ time: "" }, p);
  assert.equal(hit.time, "明晚 7 点");
  assert.deepEqual(hit.defaulted, ["time"]);
  const keep = resolveDefaults({ time: "今晚" }, p);
  assert.equal(keep.time, "今晚");
  assert.deepEqual(keep.defaulted, []);
});
