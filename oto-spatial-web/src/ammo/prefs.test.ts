import { test } from "node:test";
import assert from "node:assert/strict";
import {
  cyclePref,
  setPref,
  DEFAULT_PREFS,
  PREF_OPTIONS,
  PREF_KEYS,
} from "./prefs.ts";

test("prefs: 四维默认值与展示文案一致", () => {
  assert.deepEqual(DEFAULT_PREFS, {
    radius: "活动范围 5 公里内",
    budget: "预算 ¥50/局",
    level: "业余水平",
    when: "周末出行",
  });
});

test("prefs: 每维选项池非空且含默认值", () => {
  for (const k of PREF_KEYS) {
    assert.ok(PREF_OPTIONS[k].length >= 2);
    assert.ok(PREF_OPTIONS[k].includes(DEFAULT_PREFS[k]), k);
  }
});

test("cyclePref: 循环切换下一档", () => {
  const out = cyclePref(DEFAULT_PREFS, "radius");
  assert.equal(out.radius, "活动范围 10 公里内");
  assert.equal(out.budget, DEFAULT_PREFS.budget);
});

test("cyclePref: 末档回到首档（循环）", () => {
  let prefs = { ...DEFAULT_PREFS, when: "随时可约" };
  prefs = cyclePref(prefs, "when");
  assert.equal(prefs.when, "周末出行");
});

test("cyclePref: 不可变，不污染原对象", () => {
  const before = { ...DEFAULT_PREFS };
  cyclePref(before, "budget");
  assert.deepEqual(before, DEFAULT_PREFS);
});

test("setPref: 合法值生效", () => {
  const out = setPref(DEFAULT_PREFS, "level", "专业竞技");
  assert.equal(out.level, "专业竞技");
});

test("setPref: 非法值忽略（原对象不动）", () => {
  const out = setPref(DEFAULT_PREFS, "budget", "免费");
  assert.equal(out, DEFAULT_PREFS);
});