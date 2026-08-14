import { test } from "node:test";
import assert from "node:assert/strict";
import {
  isHomeAccess,
  recordSentinel,
  sentinelCheck,
  type SentinelEvent,
} from "./sentinel.ts";

test("全绿：正常用户所有因子 0 → safe", () => {
  const r = sentinelCheck({
    deviceRisk: "safe",
    creditScore: 850,
    amountYuan: 120,
    publishCount: 2,
    completionRate: 0.9,
    graphIdentityCount: 1,
  });
  assert.equal(r.level, "safe");
  assert.equal(r.score, 0);
  assert.equal(r.triggeredBy.length, 0);
});

test("设备高危单独触发 → high", () => {
  const r = sentinelCheck({
    deviceRisk: "high",
    creditScore: 850,
    amountYuan: 120,
    publishCount: 2,
    completionRate: 0.9,
    graphIdentityCount: 1,
  });
  assert.equal(r.level, "high");
  assert.ok(r.score >= 70);
  assert.ok(r.triggeredBy.includes("设备多开"));
});

test("新号大额 → 信用因子 60 分（仅激活因子归一 → watch 观察）", () => {
  const r = sentinelCheck({
    creditScore: 450,
    amountYuan: 800,
    publishCount: 1,
  });
  assert.equal(r.score, 60);
  assert.equal(r.level, "watch");
  assert.ok(r.triggeredBy.includes("信用与金额"));
});

test("高频低完成 → behavior 因子 70 分 → high", () => {
  const r = sentinelCheck({
    creditScore: 850,
    amountYuan: 120,
    publishCount: 7,
    completionRate: 0.1,
  });
  assert.ok(r.triggeredBy.includes("发布行为"));
  assert.equal(r.score, 70);
  assert.equal(r.level, "high");
});

test("图因子：多身份+裂变 → 75 分 → high", () => {
  const r = sentinelCheck({
    graphIdentityCount: 4,
    graphFission: true,
    publishCount: 1,
    amountYuan: 100,
  });
  assert.ok(r.triggeredBy.includes("关联图谱"));
  assert.equal(r.score, 75);
  assert.equal(r.level, "high");
});

test("引信联动：进家类目设备高危 → ×1.2 后仍 ≥70 封顶 100", () => {
  const r = sentinelCheck({
    deviceRisk: "high",
    category: "家政保洁",
    creditScore: 850,
    amountYuan: 120,
    publishCount: 2,
  });
  assert.equal(r.level, "high");
  assert.equal(r.score, 96); // 80×1.2
  assert.ok(isHomeAccess("家政保洁"));
  assert.ok(!isHomeAccess("羽毛球"));
});

test("宪法 #9：设备高危不被低危因子稀释 → 保持 high", () => {
  const r = sentinelCheck({
    deviceRisk: "high",
    creditScore: 850,
    amountYuan: 120,
    publishCount: 2,
    graphIdentityCount: 3,
  });
  assert.equal(r.level, "high");
  assert.ok(r.score >= 70);
});

test("数据缺失（宪法 #10）：无信用/无图数据 → 剔除重归一不误伤", () => {
  const r = sentinelCheck({
    deviceRisk: "watch",
    publishCount: 0,
    amountYuan: 100,
  });
  // 只剩 device 因子，归一后 = 50
  assert.equal(r.score, 50);
  assert.equal(r.level, "watch");
});

test("事件流：high 拒绝 / safe 通过 note", () => {
  let events: SentinelEvent[] = [];
  const safe = sentinelCheck({ creditScore: 850, amountYuan: 50, publishCount: 1 });
  events = recordSentinel(events, safe, "u1", 1000);
  assert.equal(events.length, 1);
  assert.equal(events[0].note, "通过甄检");

  const high = sentinelCheck({ deviceRisk: "high", creditScore: 850, amountYuan: 50, publishCount: 1 });
  events = recordSentinel(events, high, "u1", 2000);
  assert.equal(events.length, 2);
  assert.ok(events[1].note.startsWith("拒绝发布"));
  assert.equal(events[1].level, "high");
});