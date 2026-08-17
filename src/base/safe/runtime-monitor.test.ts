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
  computeRiskScore,
  isNighttimeHour,
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

/* =====================================================================
 * 阶段3：多因子动态风险评分 + 引信自适应升级（PROXIMITY_ENHANCED）
 * ===================================================================== */

const SENSITIVE_CUSTOM: import("../../types/ammo-schema.ts").INormalizedCustomIntent = {
  cleanText: "要求：指定工作着装(女仆主题) · 期望年龄: 20-30岁",
  isSensitiveCustomization: true,
  blockedReason: null,
  dressCode: { required: true, type: "THEMED_MAID", rawKeyword: "女仆装" },
  ageRange: [20, 30],
  genderPreference: "ANY",
};

/** 阶段3-1：风险评分纯函数矩阵（基础 20 + 各因子权重）。 */
test("SAFE_MONITOR 阶段3：多因子风险评分矩阵（确定性加权）", () => {
  // 基础 20（入户保洁）
  assert.equal(computeRiskScore({ baseRiskScore: 20 }), 20);
  // +30 敏感定制
  assert.equal(computeRiskScore({ baseRiskScore: 20, customRequirements: SENSITIVE_CUSTOM }), 50);
  // +20 夜间（22:00 / 05:00 属夜间；12:00 不属）
  assert.equal(isNighttimeHour(22), true);
  assert.equal(isNighttimeHour(23), true);
  assert.equal(isNighttimeHour(0), true);
  assert.equal(isNighttimeHour(5), true);
  assert.equal(isNighttimeHour(6), false);
  assert.equal(isNighttimeHour(12), false);
  assert.equal(computeRiskScore({ baseRiskScore: 20, hourOfDay: 23 }), 40);
  // +20 任一信用分 < 70
  assert.equal(computeRiskScore({ baseRiskScore: 20, creditScores: { demander: 60, provider: 90 } }), 40);
  // clamp 0-100 + 缺省零风险
  assert.equal(computeRiskScore({}), 0);
  assert.equal(computeRiskScore({ baseRiskScore: 999 }), 100);
  assert.equal(computeRiskScore({ baseRiskScore: -5 }), 0);
});

/** 阶段3-2：风险分 ≥ 50 → PROXIMITY_ENHANCED 强制三武装 + 强化徽标。 */
test("SAFE_MONITOR 阶段3：敏感定制 20+30=50 ≥ 阈值 → PROXIMITY_ENHANCED 自适应升级", () => {
  const r = evaluateRuntimeSafety({
    ...BASE_INPUT,
    baseRiskScore: 20,
    customRequirements: SENSITIVE_CUSTOM,
  });
  assert.equal(r.riskScore, 50);
  assert.equal(r.safetyLevel, "PROXIMITY_ENHANCED");
  assert.deepEqual(r.forceArmed, {
    virtualNumberActive: true,
    tripGuardActive: true,
    chatModerationActive: true,
  });
  assert.equal(r.safetyBadge, "🛡️ 强化安全守护中（虚拟号+实时存证）");
});

/** 阶段3-3：夜间 + 低信用 → 升级；零定制夜间 40 < 50 → STANDARD。 */
test("SAFE_MONITOR 阶段3：夜间+低信用叠加升级 / 未达阈值维持 STANDARD", () => {
  const night = evaluateRuntimeSafety({
    ...BASE_INPUT,
    baseRiskScore: 20,
    hourOfDay: 23,
    creditScores: { demander: 95, provider: 60 },
  });
  assert.equal(night.riskScore, 60);
  assert.equal(night.safetyLevel, "PROXIMITY_ENHANCED");

  const plain = evaluateRuntimeSafety({ ...BASE_INPUT, baseRiskScore: 20, hourOfDay: 23 });
  assert.equal(plain.riskScore, 40, "40 < 50 阈值");
  assert.equal(plain.safetyLevel, "STANDARD");
  assert.equal(plain.forceArmed.virtualNumberActive, false, "未升级不强制武装");
  assert.equal(plain.safetyBadge, "🛡️ 安全守护中");
});

/** 阶段3-4：升级与既有威胁态共存（升级是独立维度，不吞并威胁判定）。 */
test("SAFE_MONITOR 阶段3：升级态下敏感词命中仍 THREAT + 报告结构完整", () => {
  const r = evaluateRuntimeSafety({
    ...BASE_INPUT,
    baseRiskScore: 20,
    customRequirements: SENSITIVE_CUSTOM,
    chatText: "提供上门服务 200",
  });
  assert.equal(r.securityPillStatus, "THREAT", "敏感词命中仍高危");
  assert.equal(r.safetyLevel, "PROXIMITY_ENHANCED", "定制升级独立成立");
  assert.equal(r.riskScore, 50);
  assert.ok(Number.isInteger(r.riskScore));
  assert.match(r.activeThreats[0], /^sensitive-content:/);
});
