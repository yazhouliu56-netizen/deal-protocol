/**
 * S3 SAFE_MONITOR 运行时安全监控总线测试：
 * 正常守护 → GUARDED；敏感词命中 → THREAT；围栏漂移/未到达 → 告警；
 * 隐私未武装 → 告警；多维叠加状态映射与报告结构完整性。
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  evaluateRuntimeSafety,
  SAFE_MONITOR_THREAT_CODES,
  type IRuntimeSafetyReport,
} from "./runtime-monitor.ts";

const BASE_INPUT = {
  ammoId: "housekeeping-v1",
  orderId: "w-001",
};

/** 无告警正常守护（无信号输入 = 全维度零威胁，保守为 GUARDED）。 */
test("SAFE_MONITOR：零信号输入 → 全维度守护 GUARDED", () => {
  const r = evaluateRuntimeSafety(BASE_INPUT);
  assert.equal(r.isGuarded, true);
  assert.equal(r.securityPillStatus, "GUARDED");
  assert.deepEqual(r.activeThreats, []);
  assert.equal(r.ammoId, "housekeeping-v1");
  assert.equal(r.orderId, "w-001");
  assert.equal(r.details.geofence, null);
  assert.equal(r.details.textFlag, null);
  assert.equal(r.details.privacyArmed, null);
});

/** 围栏命中 + 隐私武装 + 无敏感词 → GUARDED（完整正常链路）。 */
test("SAFE_MONITOR：围栏命中 + 隐私武装 + 无敏感词 → GUARDED", () => {
  const r = evaluateRuntimeSafety({
    ...BASE_INPUT,
    coords: {
      current: { lat: 31.2304, lng: 121.4737 },
      target: { lat: 31.2304, lng: 121.4737 },
      thresholdMeters: 50,
    },
    chatText: "今天天气不错，下午两点上门保洁",
    privacyArmed: true,
  });
  assert.equal(r.isGuarded, true);
  assert.equal(r.securityPillStatus, "GUARDED");
  assert.deepEqual(r.activeThreats, []);
  assert.equal(r.details.geofence?.isArrived, true);
  assert.equal(r.details.geofence?.distanceMeters, 0);
  assert.equal(r.details.geofence?.accuracyWarning, false);
  assert.equal(r.details.textFlag, null);
  assert.equal(r.details.privacyArmed, true);
});

/** 敏感词命中 → THREAT + 精确原因码（高危优先）。 */
test("SAFE_MONITOR：敏感词命中 → THREAT", () => {
  const r = evaluateRuntimeSafety({
    ...BASE_INPUT,
    chatText: "这个报价太黑了，我们私下转账吧",
    privacyArmed: true,
  });
  assert.equal(r.securityPillStatus, "THREAT");
  assert.equal(r.isGuarded, false);
  assert.ok(
    r.activeThreats.some((t) => t.startsWith(SAFE_MONITOR_THREAT_CODES.SENSITIVE_CONTENT)),
    `应含敏感词威胁，实际 ${JSON.stringify(r.activeThreats)}`,
  );
  assert.equal(r.details.textFlag !== null, true);
});

/** 围栏未到达（无精度信息）→ ATTENTION（单低危告警）。 */
test("SAFE_MONITOR：围栏未到达 → ATTENTION", () => {
  const r = evaluateRuntimeSafety({
    ...BASE_INPUT,
    coords: {
      current: { lat: 31.25, lng: 121.49 },
      target: { lat: 31.2304, lng: 121.4737 },
      thresholdMeters: 50,
    },
  });
  assert.equal(r.securityPillStatus, "ATTENTION");
  assert.ok(r.activeThreats.includes(SAFE_MONITOR_THREAT_CODES.GEOFENCE_NOT_ARRIVED));
  assert.equal(r.details.geofence?.isArrived, false);
  assert.ok(r.details.geofence && r.details.geofence.distanceMeters > 50);
});

/** 精度漂移警告（accuracy 劣于 15m 阈值）→ 独立威胁码。 */
test("SAFE_MONITOR：定位精度漂移 → geofence-drift 告警", () => {
  const r = evaluateRuntimeSafety({
    ...BASE_INPUT,
    coords: {
      current: { lat: 31.2304, lng: 121.4737, accuracy: 60 },
      target: { lat: 31.2304, lng: 121.4737 },
    },
  });
  assert.ok(r.activeThreats.includes(SAFE_MONITOR_THREAT_CODES.GEOFENCE_DRIFT));
  assert.equal(r.details.geofence?.accuracyWarning, true);
});

/** 隐私未武装 → privacy-not-armed 告警（低危）。 */
test("SAFE_MONITOR：虚拟隐私号未武装 → ATTENTION", () => {
  const r = evaluateRuntimeSafety({
    ...BASE_INPUT,
    privacyArmed: false,
  });
  assert.equal(r.securityPillStatus, "ATTENTION");
  assert.ok(r.activeThreats.includes(SAFE_MONITOR_THREAT_CODES.PRIVACY_NOT_ARMED));
  assert.equal(r.details.privacyArmed, false);
});

/** 多维叠加（敏感词 + 围栏漂移）→ THREAT（高危优先于数量）。 */
test("SAFE_MONITOR：敏感词 + 围栏漂移叠加 → THREAT", () => {
  const r = evaluateRuntimeSafety({
    ...BASE_INPUT,
    coords: {
      current: { lat: 31.2304, lng: 121.4737, accuracy: 80 },
      target: { lat: 31.2304, lng: 121.4737 },
    },
    chatText: "加个微信吧，不走平台私下转账",
    privacyArmed: false,
  });
  assert.equal(r.securityPillStatus, "THREAT");
  assert.ok(r.activeThreats.length >= 3);
  assert.ok(r.activeThreats.includes(SAFE_MONITOR_THREAT_CODES.GEOFENCE_DRIFT));
  assert.ok(r.activeThreats.includes(SAFE_MONITOR_THREAT_CODES.PRIVACY_NOT_ARMED));
});

/** 无敏感词但双低危叠加（漂移 + 隐私未武装）→ THREAT（≥2 升级）。 */
test("SAFE_MONITOR：双低危叠加无敏感词 → THREAT（数量升级）", () => {
  const r = evaluateRuntimeSafety({
    ...BASE_INPUT,
    coords: {
      current: { lat: 31.2304, lng: 121.4737, accuracy: 40 },
      target: { lat: 31.2304, lng: 121.4737 },
    },
    privacyArmed: false,
  });
  assert.equal(r.securityPillStatus, "THREAT");
  assert.equal(r.activeThreats.length, 2);
  assert.equal(r.isGuarded, false);
});

/** 报告结构完整性：ammoId/orderId/三字段稳定输出。 */
test("SAFE_MONITOR：报告结构完整性（输入透传 + 三字段输出）", () => {
  const r: IRuntimeSafetyReport = evaluateRuntimeSafety({
    ammoId: "meetup-social-v1",
    orderId: "w-042",
    chatText: "AA 平摊 80 元",
  });
  assert.equal(r.ammoId, "meetup-social-v1");
  assert.equal(r.orderId, "w-042");
  assert.equal(typeof r.isGuarded, "boolean");
  assert.ok(Array.isArray(r.activeThreats));
  assert.ok(["GUARDED", "ATTENTION", "THREAT"].includes(r.securityPillStatus));
  assert.ok(r.details);
  assert.equal(r.details.textFlag, null);
});
