/**
 * 统一时间解析引擎单测（node:test · P0 战役第 2 步 SSOT 收敛）。
 * 覆盖：钟点型全形态（阿拉伯/中文数字/半点/时段偏移）、星期型、粗时间型、
 * 空输入回落、baseDate 注入确定性。
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { parseNaturalTime } from "./timeParser.ts";

test("钟点型：裸「10点」→ 10:00（不推断日期，值域兼容 voiceIntent）", () => {
  const p = parseNaturalTime("10点");
  assert.ok(p);
  assert.equal(p.normalizedTime, "10:00");
  assert.equal(p.displayLabel, "10:00");
  assert.equal(p.relativeDay, undefined);
});

test("钟点型：口语整句「我需要10点来人打扫房间」命中 10:00", () => {
  const p = parseNaturalTime("我需要10点来人打扫房间");
  assert.ok(p);
  assert.equal(p.normalizedTime, "10:00");
});

test("钟点型：「明天下午2点半」→ 14:30 + 明天标签 + AFTERNOON", () => {
  const p = parseNaturalTime("明天下午2点半");
  assert.ok(p);
  assert.equal(p.normalizedTime, "14:30");
  assert.equal(p.relativeDay, "TOMORROW");
  assert.equal(p.periodOfDay, "AFTERNOON");
  assert.equal(p.displayLabel, "明天 14:30");
});

test("钟点型：「晚上8点」→ 20:00 EVENING；「上午9点」→ 09:00 MORNING", () => {
  const evening = parseNaturalTime("晚上8点上门");
  assert.ok(evening);
  assert.equal(evening.normalizedTime, "20:00");
  assert.equal(evening.periodOfDay, "EVENING");
  const morning = parseNaturalTime("上午9点保洁");
  assert.ok(morning);
  assert.equal(morning.normalizedTime, "09:00");
  assert.equal(morning.periodOfDay, "MORNING");
});

test("钟点型：24h 制「14:30」原样归一化", () => {
  const p = parseNaturalTime("14:30开始");
  assert.ok(p);
  assert.equal(p.normalizedTime, "14:30");
  assert.equal(p.displayLabel, "14:30");
});

test("钟点型：中文数字「下午三点半」→ 15:30；「三点半」→ 03:30", () => {
  const withPart = parseNaturalTime("下午三点半来");
  assert.ok(withPart);
  assert.equal(withPart.normalizedTime, "15:30");
  const bare = parseNaturalTime("三点半打球");
  assert.ok(bare);
  assert.equal(bare.normalizedTime, "03:30");
});

test("钟点型：「14点30分」带分字后缀", () => {
  const p = parseNaturalTime("14点30分到");
  assert.ok(p);
  assert.equal(p.normalizedTime, "14:30");
});

test("星期型：「周六 14:00」→ SPECIFIC_WEEKDAY weekday=6", () => {
  const p = parseNaturalTime("周六 14:00 羽毛球");
  assert.ok(p);
  assert.equal(p.normalizedTime, "14:00");
  assert.equal(p.relativeDay, "SPECIFIC_WEEKDAY");
  assert.equal(p.weekday, 6);
  assert.equal(p.displayLabel, "周六 14:00");
});

test("粗时间型：无钟点的「周日下午」「明天上午」「周末」", () => {
  const sat = parseNaturalTime("周日下午想找人打羽毛球");
  assert.ok(sat);
  assert.equal(sat.normalizedTime, null);
  assert.equal(sat.relativeDay, "SPECIFIC_WEEKDAY");
  assert.equal(sat.weekday, 7);
  assert.equal(sat.periodOfDay, "AFTERNOON");
  assert.equal(sat.displayLabel, "周日下午");
  const tmr = parseNaturalTime("明天上午找个保洁");
  assert.ok(tmr);
  assert.equal(tmr.normalizedTime, null);
  assert.equal(tmr.relativeDay, "TOMORROW");
  assert.equal(tmr.displayLabel, "明天上午");
  const wk = parseNaturalTextWeekend();
  assert.ok(wk);
  assert.equal(wk.relativeDay, "WEEKEND");
  assert.equal(wk.displayLabel, "周末");
});

function parseNaturalTextWeekend() {
  return parseNaturalTime("周末双休想组局");
}

test("钟点边界：「中午12点」→ 12:00；「晚上12点」→ 00:00；「后天晚上10点」→ 22:00", () => {
  const noon = parseNaturalTime("中午12点吃饭局");
  assert.ok(noon);
  assert.equal(noon.normalizedTime, "12:00");
  const midnight = parseNaturalTime("晚上12点收工");
  assert.ok(midnight);
  assert.equal(midnight.normalizedTime, "00:00");
  const d2 = parseNaturalTime("后天晚上10点到");
  assert.ok(d2);
  assert.equal(d2.normalizedTime, "22:00");
  assert.equal(d2.relativeDay, "DAY_AFTER_TOMORROW");
});

test("时段偏移显式语义：「下午10点半」→ 22:30（SSOT 归一化，旧引擎忽略时段词）", () => {
  const p = parseNaturalTime("下午 10点半来打扫");
  assert.ok(p);
  assert.equal(p.normalizedTime, "22:30");
  assert.equal(p.periodOfDay, "AFTERNOON");
});

test("无时间要素 → null；空串 → null", () => {
  assert.equal(parseNaturalTime("帮我找个靠谱的师傅"), null);
  assert.equal(parseNaturalTime(""), null);
});

test("baseDate 注入式：同一输入解析结果确定不变（红线 1）", () => {
  const fixed = new Date("2026-08-22T08:00:00+08:00");
  const a = parseNaturalTime("明天下午2点", fixed);
  const b = parseNaturalTime("明天下午2点", fixed);
  assert.deepEqual(a, b);
});
