/**
 * 语义驯化引擎单测（阶段3 · 纯函数，红线 1 确定性断言）。
 * 覆盖：着装/年龄/性别提取、中性化文案、违禁硬阻断分流、零定制回归。
 */
import { test } from "node:test";
import assert from "node:assert/strict";

import { normalizeCustomIntent } from "./intent-normalizer.ts";

test("驯化：女仆装 → THEMED_MAID + 中性化文案 + 敏感标记", () => {
  const r = normalizeCustomIntent("我需要10点来人打扫房间。年龄在20-30岁之间，身穿女仆装。");
  assert.equal(r.isSensitiveCustomization, true);
  assert.equal(r.dressCode?.required, true);
  assert.equal(r.dressCode?.type, "THEMED_MAID");
  assert.equal(r.dressCode?.rawKeyword, "女仆装");
  assert.deepEqual(r.ageRange, [20, 30]);
  assert.equal(r.genderPreference, "ANY", "『女仆装』中的女字不得误判为 FEMALE");
  assert.match(r.cleanText, /女仆主题/);
  assert.match(r.cleanText, /20-30岁/);
  assert.doesNotMatch(r.cleanText, /女仆装/, "中性文案不得出现擦边原词");
  assert.equal(r.blockedReason, null, "非标定制不阻断");
});

test("驯化：JK 制服 / Cosplay → THEMED_COSPLAY", () => {
  const jk = normalizeCustomIntent("找保洁，要求穿JK制服，预算 100 元");
  assert.equal(jk.dressCode?.type, "THEMED_COSPLAY");
  assert.equal(jk.isSensitiveCustomization, true);

  const cos = normalizeCustomIntent("上门打扫，想雇个 cosplay 装扮的");
  assert.equal(cos.dressCode?.type, "THEMED_COSPLAY");
  assert.equal(cos.dressCode?.rawKeyword.toLowerCase().startsWith("cosplay"), true);
});

test("驯化：礼服/正装/西装 → FORMAL_UNIFORM；工装 → CUSTOM", () => {
  assert.equal(normalizeCustomIntent("穿礼服来").dressCode?.type, "FORMAL_UNIFORM");
  assert.equal(normalizeCustomIntent("正装上门").dressCode?.type, "FORMAL_UNIFORM");
  const custom = normalizeCustomIntent("要求穿工装来打扫");
  assert.equal(custom.dressCode?.type, "CUSTOM");
  assert.equal(custom.dressCode?.required, true);
});

test("驯化：年龄区间多形态（在…之间/到/至/单边界）+ 乱序纠正", () => {
  assert.deepEqual(normalizeCustomIntent("年龄在20-30岁之间").ageRange, [20, 30]);
  assert.deepEqual(normalizeCustomIntent("年龄在20到30岁之间").ageRange, [20, 30]);
  assert.deepEqual(normalizeCustomIntent("年龄20至30岁").ageRange, [20, 30]);
  assert.deepEqual(normalizeCustomIntent("20~30岁").ageRange, [20, 30]);
  assert.deepEqual(normalizeCustomIntent("年龄在30-20岁之间").ageRange, [20, 30], "乱序自动纠正");
  assert.deepEqual(normalizeCustomIntent("30岁以下").ageRange, [14, 30], "单边界封顶");
  assert.deepEqual(normalizeCustomIntent("18岁以上").ageRange, [18, 100], "单边界保底");
});

test("驯化：性别偏好提取 + 女仆装误伤防护", () => {
  assert.equal(normalizeCustomIntent("希望来个小姑娘打扫").genderPreference, "FEMALE");
  assert.equal(normalizeCustomIntent("想要个男生来").genderPreference, "MALE");
  assert.equal(normalizeCustomIntent("身穿女仆装").genderPreference, "ANY", "着装词不污染性别");
  assert.equal(normalizeCustomIntent("普通保洁").genderPreference, "ANY");
});

test("驯化：违禁词硬阻断分流（blockedReason 留痕，不生成公海文案）", () => {
  const bad = normalizeCustomIntent("上门服务 200 全套");
  assert.equal(bad.blockedReason, "涉黄服务", "绝对违禁词硬阻断标记");
  assert.equal(bad.cleanText, "", "违禁诉求不产出中性文案（不进入公海）");
  assert.equal(bad.isSensitiveCustomization, true);

  const none = normalizeCustomIntent("家宴做菜上门");
  assert.equal(none.blockedReason, null, "正常内容不误伤");
  assert.equal(none.isSensitiveCustomization, false);
});

test("驯化：零定制输入回归（空对象语义）", () => {
  const plain = normalizeCustomIntent("我需要10点来人打扫房间，预算 150 元");
  assert.equal(plain.isSensitiveCustomization, false);
  assert.equal(plain.cleanText, "");
  assert.equal(plain.dressCode, undefined);
  assert.equal(plain.ageRange, undefined);
  assert.equal(plain.genderPreference, "ANY");
  assert.equal(plain.blockedReason, null);
});

test("驯化：确定性（同输入同输出）+ 耗时上界 1ms", () => {
  const input = "年龄在20-30岁之间，身穿女仆装";
  const a = normalizeCustomIntent(input);
  const b = normalizeCustomIntent(input);
  assert.deepEqual(a, b, "纯函数确定性");
  const t0 = performance.now();
  for (let i = 0; i < 500; i++) normalizeCustomIntent(input);
  const avgMs = (performance.now() - t0) / 500;
  assert.ok(avgMs <= 1, `平均耗时 ${avgMs.toFixed(3)}ms ≤ 1ms 红线`);
});
