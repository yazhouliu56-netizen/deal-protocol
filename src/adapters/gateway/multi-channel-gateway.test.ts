/**
 * L5-M1 多通道热备总线测试矩阵（node:test）：
 * 首选直通 / 一级失败平滑下跳 / 全挂本地兜底 / 超时降级 / 三连败熔断 /
 * 冷却期满半开探测自愈 / 熔断内跳过 / 状态池按 key 隔离 / SMS·LBS 门面全链路。
 */
import assert from "node:assert/strict";
import { test } from "node:test";

import {
  advanceChannelCircuit,
  buildAliyunSmsChannel,
  buildAmapChannel,
  buildHuaweiSmsChannel,
  buildLocalHaversineChannel,
  buildLocalSmsMockChannel,
  buildOpenFreeMapChannel,
  buildTencentLbsChannel,
  buildTencentSmsChannel,
  calculateDistanceWithFallback,
  dispatchSmsWithFallback,
  executeWithFallback,
  getChannelCircuit,
  markChannelProbe,
  resetChannelCircuit,
  shouldSkipChannel,
  type IVendorChannel,
  type SmsDispatchInput,
  type SmsDispatchOutput,
  type VendorType,
} from "./multi-channel-gateway.ts";

/** 测试用数字回显通道（可注入失败/超时行为）。 */
function okChannel(vendor: VendorType, priority: number, value: string, fail = false, timeoutMs = 5_000): IVendorChannel<string, string> {
  return {
    vendor,
    priority,
    timeoutMs,
    execute: async () => {
      if (fail) throw new Error(`vendor ${vendor} boom`);
      return value;
    },
  };
}

test("一级厂商正常时首选执行：fallbackHops === 0", async () => {
  const r = await executeWithFallback<string, string>(
    [
      okChannel("ALIYUN", 2, "tencent"),
      okChannel("TENCENT", 1, "aliyun"),
      okChannel("HUAWEI", 3, "huawei"),
      { vendor: "LOCAL_MOCK", priority: 99, timeoutMs: 1_000, execute: async () => "mock" },
    ],
    "x",
    "sms",
  );
  assert.equal(r.usedVendor, "TENCENT");
  assert.equal(r.result, "aliyun");
  assert.equal(r.fallbackHops, 0);
});

test("一级厂商 500 失败：毫秒级无缝降级至二级（fallbackHops === 1）", async () => {
  const r = await executeWithFallback<string, string>(
    [
      okChannel("ALIYUN", 1, "aliyun", true),
      okChannel("TENCENT", 2, "tencent"),
      okChannel("HUAWEI", 3, "huawei"),
      { vendor: "LOCAL_MOCK", priority: 99, timeoutMs: 1_000, execute: async () => "mock" },
    ],
    "x",
    "sms-fail1",
  );
  assert.equal(r.usedVendor, "TENCENT");
  assert.equal(r.result, "tencent");
  assert.equal(r.fallbackHops, 1);
});

test("连续两级失败：降级至第三级（fallbackHops === 2）", async () => {
  const r = await executeWithFallback<string, string>(
    [
      okChannel("ALIYUN", 1, "aliyun", true),
      okChannel("TENCENT", 2, "tencent", true),
      okChannel("HUAWEI", 3, "huawei"),
      { vendor: "LOCAL_MOCK", priority: 99, timeoutMs: 1_000, execute: async () => "mock" },
    ],
    "x",
    "sms-fail2",
  );
  assert.equal(r.usedVendor, "HUAWEI");
  assert.equal(r.fallbackHops, 2);
});

test("所有外部厂商全挂：自动切入本地 Mock 确定性兜底且无异常", async () => {
  const r = await executeWithFallback<string, string>(
    [
      okChannel("ALIYUN", 1, "aliyun", true),
      okChannel("TENCENT", 2, "tencent", true),
      okChannel("HUAWEI", 3, "huawei", true),
      { vendor: "LOCAL_MOCK", priority: 99, timeoutMs: 1_000, execute: async () => "mock-ok" },
    ],
    "x",
    "sms-all-down",
  );
  assert.equal(r.usedVendor, "LOCAL_MOCK");
  assert.equal(r.result, "mock-ok");
  assert.equal(r.fallbackHops, 3);
});

test("超时降级：一级超时视为失败，平滑下跳二级", async () => {
  const hanging: IVendorChannel<string, string> = {
    vendor: "ALIYUN",
    priority: 1,
    timeoutMs: 20,
    execute: async () => {
      await new Promise((r) => setTimeout(r, 500));
      return "too-late";
    },
  };
  const r = await executeWithFallback<string, string>(
    [hanging, okChannel("TENCENT", 2, "tencent"), { vendor: "LOCAL_MOCK", priority: 99, timeoutMs: 1_000, execute: async () => "mock" }],
    "x",
    "sms-timeout",
  );
  assert.equal(r.usedVendor, "TENCENT");
  assert.equal(r.result, "tencent");
  assert.equal(r.fallbackHops, 1);
});

test("连续失败 3 次触发熔断：UNHEALTHY 状态", async () => {
  resetChannelCircuit("breaker");
  const channels = [
    okChannel("ALIYUN", 1, "aliyun", true),
    okChannel("TENCENT", 2, "tencent"),
    { vendor: "LOCAL_MOCK", priority: 99, timeoutMs: 1_000, execute: async () => "mock" },
  ];
  for (let i = 0; i < 3; i++) {
    const r = await executeWithFallback(channels as never, "x", "breaker");
    assert.equal(r.usedVendor, "TENCENT");
  }
  const c = getChannelCircuit("breaker", "ALIYUN");
  assert.equal(c.status, "UNHEALTHY");
  assert.equal(c.failures, 3);
  // 熔断后 4 次调用：一级被跳过（fallbackHops 从 0 变 1），二级直接兜上
  const r4 = await executeWithFallback(channels as never, "x", "breaker");
  assert.equal(r4.usedVendor, "TENCENT");
  assert.equal(r4.fallbackHops, 1);
});

test("冷却期内跳过：shouldSkipChannel 判定", async () => {
  const circuit = advanceChannelCircuit({ status: "HEALTHY", failures: 0, openedAt: 0, probeUsed: false }, false, 1_000, { failThreshold: 3, cooldownMs: 60_000 });
  assert.equal(circuit.status, "DEGRADED");
  assert.equal(shouldSkipChannel(circuit, 1_001), false);
  // 熔断 3 次 → UNHEALTHY
  const open = advanceChannelCircuit(circuit, false, 2_000, { failThreshold: 3, cooldownMs: 60_000 });
  assert.equal(open.status, "DEGRADED");
  const open2 = advanceChannelCircuit(open, false, 3_000, { failThreshold: 3, cooldownMs: 60_000 });
  assert.equal(open2.status, "UNHEALTHY");
  assert.equal(open2.openedAt, 3_000);
  // 冷却内 → 跳过
  assert.equal(shouldSkipChannel(open2, 3_500), true);
  // 冷却期未到（30s）→ 跳过
  assert.equal(shouldSkipChannel(open2, 4_000), true);
});

test("冷却期满半开探测：放行一次，成功自愈", async () => {
  const circuit = advanceChannelCircuit({ status: "HEALTHY", failures: 0, openedAt: 0, probeUsed: false }, false, 1_000, { failThreshold: 3, cooldownMs: 60_000 });
  const c2 = advanceChannelCircuit(circuit, false, 2_000, { failThreshold: 3, cooldownMs: 60_000 });
  const c3 = advanceChannelCircuit(c2, false, 3_000, { failThreshold: 3, cooldownMs: 60_000 });
  // 冷却期满（openedAt 3000 + 60s → 63s 后）→ 半开探测放行
  assert.equal(shouldSkipChannel(c3, 64_000), false);
  const probed = markChannelProbe(c3);
  assert.equal(probed.probeUsed, true);
  // 探测后若仍失败 → 累计失败再次达阈值 → 重新熔断（新 openedAt 起算冷却）
  const after = advanceChannelCircuit(probed, false, 61_100, { failThreshold: 3, cooldownMs: 60_000 });
  assert.equal(after.status, "UNHEALTHY");
  assert.equal(after.failures, 4);
  assert.equal(after.openedAt, 61_100);
  // 探测成功 → 自愈 HEALTHY
  const healed = advanceChannelCircuit(probed, true, 61_100);
  assert.equal(healed.status, "HEALTHY");
  assert.equal(healed.failures, 0);
  // probeUsed 后不再重复放行（跳过直到再次失败触发重熔断）
  assert.equal(shouldSkipChannel({ ...c3, probeUsed: true }, 62_000), true);
});

test("半开探测失败：重新熔断，冷却重新计时", async () => {
  const c3 = advanceChannelCircuit(advanceChannelCircuit(advanceChannelCircuit({ status: "HEALTHY", failures: 0, openedAt: 0, probeUsed: false }, false, 1_000, { failThreshold: 3, cooldownMs: 60_000 }), false, 2_000, { failThreshold: 3, cooldownMs: 60_000 }), false, 3_000, { failThreshold: 3, cooldownMs: 60_000 });
  const probed = markChannelProbe(c3);
  // 探测失败 → 失败计数 +1（4 次 ≥ 阈值 3）→ 重新进入熔断（新 openedAt）
  const afterProbeFail = advanceChannelCircuit(probed, false, 61_000, { failThreshold: 3, cooldownMs: 60_000 });
  assert.equal(afterProbeFail.status, "UNHEALTHY");
  assert.equal(afterProbeFail.failures, 4);
  assert.equal(afterProbeFail.openedAt, 61_000);
  // 冷却周期从新 openedAt 起算
  assert.equal(shouldSkipChannel(afterProbeFail, 70_000), true);
});

test("状态池按 channelKey 隔离：互不影响", async () => {
  resetChannelCircuit();
  const a = okChannel("ALIYUN", 1, "aliyun", true);
  const b = okChannel("TENCENT", 2, "tencent");
  const mock = { vendor: "LOCAL_MOCK" as const, priority: 99, timeoutMs: 1_000, execute: async () => "mock" };
  for (let i = 0; i < 3; i++) {
    await executeWithFallback([a, b, mock], "x", "key-a");
  }
  assert.equal(getChannelCircuit("key-a", "ALIYUN").status, "UNHEALTHY");
  assert.equal(getChannelCircuit("key-b", "ALIYUN").status, "HEALTHY");
  // key-b 不受 key-a 熔断影响
  const r = await executeWithFallback([a, b, mock], "x", "key-b");
  assert.equal(r.usedVendor, "TENCENT");
  assert.equal(r.fallbackHops, 1);
});

test("resetChannelCircuit 清除熔断状态", async () => {
  resetChannelCircuit("reset-key");
  const a = okChannel("ALIYUN", 1, "aliyun", true);
  const b = okChannel("TENCENT", 2, "tencent");
  const mock = { vendor: "LOCAL_MOCK" as const, priority: 99, timeoutMs: 1_000, execute: async () => "mock" };
  for (let i = 0; i < 3; i++) {
    await executeWithFallback([a, b, mock], "x", "reset-key");
  }
  assert.equal(getChannelCircuit("reset-key", "ALIYUN").status, "UNHEALTHY");
  resetChannelCircuit("reset-key");
  assert.equal(getChannelCircuit("reset-key", "ALIYUN").status, "HEALTHY");
});

// ---------- SMS 门面 ----------

test("SMS 门面：三厂商全挂 → LOCAL_MOCK 存根兜底且无异常", async () => {
  const failing: IVendorChannel<SmsDispatchInput, SmsDispatchOutput>[] = [
    buildAliyunSmsChannel(),
    buildTencentSmsChannel(),
    buildHuaweiSmsChannel(),
    buildLocalSmsMockChannel(),
  ];
  const r = await dispatchSmsWithFallback(
    { phone: "13800000001", title: "紧急通知", content: "测试内容" },
    "sms-facade",
    failing,
  );
  assert.equal(r.usedVendor, "LOCAL_MOCK");
  assert.equal(r.result.success, true);
  assert.ok(r.result.messageId?.startsWith("mock-"));
});

test("SMS 门面：阿里云直通成功（注入成功通道模拟）", async () => {
  const aliyunOk = {
    vendor: "ALIYUN" as const,
    priority: 1,
    timeoutMs: 5_000,
    execute: async () => ({ success: true, messageId: "aliyun-ok" }),
  };
  const r = await dispatchSmsWithFallback(
    { phone: "13800000002", title: "t", content: "c" },
    "sms-ok",
    [aliyunOk, buildLocalSmsMockChannel()],
  );
  assert.equal(r.usedVendor, "ALIYUN");
  assert.equal(r.fallbackHops, 0);
  assert.equal(r.result.messageId, "aliyun-ok");
});

// ---------- LBS 距离门面 ----------

test("LBS 门面：全挂 → 本地 Haversine 纯数学兜底且无异常", async () => {
  const r = await calculateDistanceWithFallback(
    { a: { lat: 30.57, lng: 104.06 }, b: { lat: 30.5801, lng: 104.0802 } },
    "lbs-facade",
    [buildOpenFreeMapChannel(), buildAmapChannel(), buildTencentLbsChannel(), buildLocalHaversineChannel()],
  );
  assert.equal(r.usedVendor, "LOCAL_MOCK");
  // 成都两个点约 2km：Haversine 同地球模型，数值应 > 0 且合理
  assert.ok(r.result.distanceMeters > 1000, `got ${r.result.distanceMeters}`);
  assert.ok(r.result.distanceMeters < 3000, `got ${r.result.distanceMeters}`);
});

test("LBS 门面：一级（MapLibre/OpenFreeMap）失败 → 二级（高德）无 key 失败 → 三级（腾讯）→ 兜底", async () => {
  // 注入模拟成功的高德通道，验证优先级梯队
  const amapOk = {
    vendor: "AMAP" as const,
    priority: 2,
    timeoutMs: 4_000,
    execute: async () => ({ distanceMeters: 1234.56 }),
  };
  const r = await calculateDistanceWithFallback(
    { a: { lat: 30.57, lng: 104.06 }, b: { lat: 30.5801, lng: 104.0802 } },
    "lbs-amap-ok",
    [buildOpenFreeMapChannel(), amapOk, buildLocalHaversineChannel()],
  );
  assert.equal(r.usedVendor, "AMAP");
  assert.equal(r.fallbackHops, 1);
  assert.equal(r.result.distanceMeters, 1234.56);
});

test("LBS 门面：首选直通（Haversine 即真实兜底，注入直通通道验证 fallbackHops===0）", async () => {
  const direct = {
    vendor: "OPEN_FREE_MAP" as const,
    priority: 1,
    timeoutMs: 4_000,
    execute: async () => ({ distanceMeters: 88.88 }),
  };
  const r = await calculateDistanceWithFallback(
    { a: { lat: 30.57, lng: 104.06 }, b: { lat: 30.57, lng: 104.06 } },
    "lbs-direct",
    [direct, buildLocalHaversineChannel()],
  );
  assert.equal(r.usedVendor, "OPEN_FREE_MAP");
  assert.equal(r.fallbackHops, 0);
  assert.equal(r.result.distanceMeters, 88.88);
});

test("优先级排序：乱序传入按 priority 升序探测", async () => {
  const r = await executeWithFallback<string, string>(
    [
      { vendor: "HUAWEI", priority: 3, timeoutMs: 5_000, execute: async () => "huawei" },
      { vendor: "TENCENT", priority: 2, timeoutMs: 5_000, execute: async () => "tencent" },
      { vendor: "ALIYUN", priority: 1, timeoutMs: 5_000, execute: async () => "aliyun" },
      { vendor: "LOCAL_MOCK", priority: 99, timeoutMs: 1_000, execute: async () => "mock" },
    ],
    "x",
    "order-sort",
  );
  assert.equal(r.usedVendor, "ALIYUN");
  assert.equal(r.fallbackHops, 0);
});
