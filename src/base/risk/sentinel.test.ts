import { test } from "node:test";
import assert from "node:assert/strict";
import { homeAccessKeywordsFor } from "../../ammo/risk-rule.ts";
import {
  isHomeAccess,
  recordSentinel,
  sentinelCheck,
  type SentinelEvent,
} from "./sentinel.ts";

const HOME_KEYWORDS = homeAccessKeywordsFor("家政保洁");

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

test("引信联动：进家类目设备高危 → ×1.2 后仍 ≥70 封顶 100（词表由弹药注入）", () => {
  const r = sentinelCheck({
    deviceRisk: "high",
    category: "家政保洁",
    homeAccessKeywords: HOME_KEYWORDS,
    creditScore: 850,
    amountYuan: 120,
    publishCount: 2,
  });
  assert.equal(r.level, "high");
  assert.equal(r.score, 96); // 80×1.2
  assert.ok(isHomeAccess("家政保洁", HOME_KEYWORDS));
  assert.ok(!isHomeAccess("羽毛球", HOME_KEYWORDS));
  assert.ok(!isHomeAccess("家政保洁"), "未注入词表 → 不加权（弹药语义）");
});

test("D-3 引信参数化：权威类目映射中英双键同表，未装填类目回落全局引信", () => {
  const zh = homeAccessKeywordsFor("家政保洁");
  const ammoKey = homeAccessKeywordsFor("housekeeping");
  assert.deepEqual(zh, ammoKey, "中文类目键与弹药英文键指向同一专属词表");
  assert.ok(zh.length > 0, "进家类目专属词表非空");
  assert.ok(zh.some((k) => "家政保洁".includes(k)), "词表可命中该类目");
  assert.ok(!["羽毛球", "夜骑巡航"].some((c) => isHomeAccess(c, zh)), "非进家类目不误命中");
  const fallback = homeAccessKeywordsFor("不存在的类目");
  assert.ok(Array.isArray(fallback) && fallback.length > 0, "MAP 未命中 → 回落全局引信参数（向后兼容）");
  assert.ok(!isHomeAccess("羽毛球", fallback));
  assert.ok(!isHomeAccess("家政保洁"), "未注入词表 → 不加权（底座默认零业务词）");
});

test("D-3 引信参数化：housekeeping 弹药键注入同样触发 ×1.2 加权", () => {
  const r = sentinelCheck({
    deviceRisk: "high",
    category: "家政保洁",
    homeAccessKeywords: homeAccessKeywordsFor("housekeeping"),
    creditScore: 850,
    amountYuan: 120,
    publishCount: 2,
  });
  assert.equal(r.score, 96); // 80×1.2
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