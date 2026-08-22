import { test } from "node:test";
import assert from "node:assert/strict";
import {
  describeIntent,
  intentPrompt,
  isActionable,
  mockVoiceIntent,
  parseVoiceIntent,
} from "./voiceIntent.ts";

/* ---- parseVoiceIntent（LLM 输出校验） ---- */

test("parse: 完整发布局 → publish-wave 全字段对齐", () => {
  const i = parseVoiceIntent({
    action: "publish-wave",
    wave: { category: "羽毛球", time: "明天 10:00", area: "幸福家园", budget: 100, capacity: 2 },
  });
  assert.equal(i.kind, "publish-wave");
  if (i.kind === "publish-wave") {
    assert.deepEqual(i.wave, {
      category: "羽毛球",
      time: "明天 10:00",
      area: "幸福家园",
      budget: 100,
      capacity: 2,
    });
  }
});

test("parse: 缺 budget → 降级 chat（绝不执行无预算发布）", () => {
  assert.equal(parseVoiceIntent({ action: "publish-wave", wave: { category: "羽毛球" } }).kind, "chat");
  assert.equal(parseVoiceIntent({ action: "publish-wave" }).kind, "chat");
});

test("parse: budget 越界/非数 → 钳制或降级", () => {
  const huge = parseVoiceIntent({ action: "publish-wave", wave: { budget: 999999999, capacity: 99 } });
  assert.equal(huge.kind, "publish-wave");
  if (huge.kind === "publish-wave") {
    assert.equal(huge.wave.budget, 100000);
    assert.equal(huge.wave.capacity, 50);
  }
  assert.equal(parseVoiceIntent({ action: "publish-wave", wave: { budget: "abc" } }).kind, "chat");
  assert.equal(parseVoiceIntent({ action: "publish-wave", wave: { budget: null } }).kind, "chat");
});

test("parse: query/chat/非法输入", () => {
  assert.equal(parseVoiceIntent({ action: "query-waves" }).kind, "query-waves");
  assert.equal(parseVoiceIntent({ action: "chat" }).kind, "chat");
  assert.equal(parseVoiceIntent(null).kind, "chat");
  assert.equal(parseVoiceIntent("garbage").kind, "chat");
  assert.equal(parseVoiceIntent({ action: "destroy-system" }).kind, "chat");
});

test("parse: category/time/area 缺失 → 合理默认值", () => {
  const i = parseVoiceIntent({
    action: "publish-wave",
    wave: { budget: 50 },
  });
  assert.equal(i.kind, "publish-wave");
  if (i.kind === "publish-wave") {
    assert.equal(i.wave.category, "本地服务");
    assert.equal(i.wave.time, "尽快");
    assert.equal(i.wave.area, "附近");
    assert.equal(i.wave.capacity, 1);
  }
});

/* ---- mockVoiceIntent（本地降级） ---- */

test("mock: 发布羽毛球 + 预算 + 时间", () => {
  const i = mockVoiceIntent("帮我发布一个羽毛球局，明天下午三点，预算 80 元");
  assert.equal(i.kind, "publish-wave");
  if (i.kind === "publish-wave") {
    assert.equal(i.wave.category, "羽毛球");
    assert.match(i.wave.time, /明天/);
    // SSOT 收敛（P0 第 2 步）：「下午三点」→ 规范化 24h 制 15:00（规格明确要求
    // HH:mm 精确输出；原断言 /3点|3:00|30/ 锁定的是收敛前的字面形态）
    assert.equal(i.wave.time, "明天 15:00");
    assert.equal(i.wave.budget, 80);
    assert.equal(i.wave.capacity, 1);
  }
});

test("mock: 拼位关键词 → capacity 2", () => {
  const i = mockVoiceIntent("发起一个拼位篮球局，预算 120 元");
  assert.equal(i.kind, "publish-wave");
  if (i.kind === "publish-wave") assert.equal(i.wave.capacity, 2);
});

test("mock: 新商业话术「多人拼单局」同义识别 → capacity 2（P2 去黑话配套）", () => {
  const i = mockVoiceIntent("发起一个多人拼单局羽毛球，预算 100 元");
  assert.equal(i.kind, "publish-wave");
  if (i.kind === "publish-wave") assert.equal(i.wave.capacity, 2);
});

test("mock: 无预算 → chat", () => {
  assert.equal(mockVoiceIntent("帮我发个羽毛球局").kind, "chat");
});

test("mock: 查局 / 普通对话", () => {
  assert.equal(mockVoiceIntent("看看有哪些局").kind, "query-waves");
  assert.equal(mockVoiceIntent("你好啊").kind, "chat");
});

test("mock: 服务类别映射（写真/保洁/做饭）", () => {
  assert.equal(mockVoiceIntent("发布约拍写真，预算 300").kind, "publish-wave");
  const clean = mockVoiceIntent("想发布保洁单，预算 150 元");
  if (clean.kind === "publish-wave") assert.equal(clean.wave.category, "保洁");
  const cook = mockVoiceIntent("组一个上门做饭，预算 200 元");
  if (cook.kind === "publish-wave") assert.equal(cook.wave.category, "上门做饭");
});

test("mock: 打扫同义词词表命中 + 口语时间精确时分（阶段1 缺陷修复回归）", () => {
  // 「打扫」触发词 → publish-wave → 保洁类目；「10点」→ 10:00
  const clean = mockVoiceIntent("我需要10点来人打扫房间，预算 120 元");
  assert.equal(clean.kind, "publish-wave");
  if (clean.kind === "publish-wave") {
    assert.equal(clean.wave.category, "保洁");
    assert.equal(clean.wave.time, "10:00");
    assert.equal(clean.wave.budget, 120);
  }
  // 其余口语同义词均可触发发布意图
  assert.equal(mockVoiceIntent("想找人做卫生，预算 100 元").kind, "publish-wave");
  assert.equal(mockVoiceIntent("找人扫地，预算 80 元").kind, "publish-wave");
  assert.equal(mockVoiceIntent("擦玻璃一次，预算 60 元").kind, "publish-wave");
  // 「10点半」→ 10:30（SSOT 收敛后时段偏移语义见 timeParser.test：下午10点半→22:30，
  // 此处用上午口径锁定「半点解析」回归本身）；「14点30分」→ 14:30
  const half = mockVoiceIntent("上午 10点半来，预算 100 元");
  if (half.kind === "publish-wave") assert.equal(half.wave.time, "10:30");
  const minuted = mockVoiceIntent("14点30分到，预算 100 元");
  if (minuted.kind === "publish-wave") assert.equal(minuted.wave.time, "14:30");
});

/* ---- 描述 / 动作标记 / prompt ---- */

test("describeIntent: publish-wave 播报含关键字段", () => {
  const i = parseVoiceIntent({
    action: "publish-wave",
    wave: { category: "羽毛球", time: "明天 10:00", budget: 100, capacity: 2 },
  });
  const d = describeIntent(i);
  assert.match(d, /羽毛球/);
  assert.match(d, /明天 10:00/);
  assert.match(d, /100 元/);
  assert.match(d, /拼位/);
  assert.match(d, /支付确认卡/);
});

test("isActionable / intentPrompt", () => {
  assert.equal(isActionable({ kind: "chat" }), false);
  assert.equal(isActionable({ kind: "query-waves" }), true);
  const p = intentPrompt();
  assert.match(p, /publish-wave/);
  assert.match(p, /query-waves/);
  assert.match(p, /只输出 JSON/);
});