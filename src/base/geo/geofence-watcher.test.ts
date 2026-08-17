/**
 * L4-M3 50m 高精 GPS 围栏时空判定测试：
 * Haversine 距离精确触发 / 精度漂移过滤（accuracyWarning + 不确定带拦截）/
 * 停留时长防刷 / 陪玩 300m 安全距离脱离 / 非法坐标防御。
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  GEOFENCE_ACCURACY_DRIFT_METERS,
  GEOFENCE_DEFAULT_METERS,
  checkGeofenceArrival,
  checkGeofenceArrivalViaHotSwap,
  evaluateProximityDeparture,
  validateStayDuration,
} from "./geofence-watcher.ts";

// 基准点（北京天安门）：39.9087, 116.3975
const TARGET = { lat: 39.9087, lng: 116.3975 };

/** 沿经线偏移 1 米 ≈ 0.0000089932°（纬度 39.9° 处）。 */
const DEG_PER_METER = 1 / 111_194.9;

test("50m 围栏：25m 内精确触发到达（isArrived=true，距离精确到两位小数）", () => {
  const r = checkGeofenceArrival(
    { lat: TARGET.lat + 25 * DEG_PER_METER, lng: TARGET.lng },
    TARGET,
    GEOFENCE_DEFAULT_METERS,
  );
  assert.equal(r.isArrived, true);
  assert.ok(Math.abs(r.distanceMeters - 25) < 0.5);
  assert.equal(r.accuracyWarning, false);
});

test("50m 围栏：51m 外未到达（距离精确判定）", () => {
  const r = checkGeofenceArrival(
    { lat: TARGET.lat + 51 * DEG_PER_METER, lng: TARGET.lng },
    TARGET,
    GEOFENCE_DEFAULT_METERS,
  );
  assert.equal(r.isArrived, false);
  assert.ok(r.distanceMeters > 50);
  assert.equal(r.accuracyWarning, false);
});

test("50m 围栏：边界精度（49.5m 内、accuracy 缺省）仍触发", () => {
  const r = checkGeofenceArrival(
    { lat: TARGET.lat + 49.5 * DEG_PER_METER, lng: TARGET.lng },
    TARGET,
    50,
  );
  assert.equal(r.isArrived, true);
});

test("精度漂移过滤：accuracy 高劣且不确定带覆盖阈值 → 未到达 + accuracyWarning", () => {
  const r = checkGeofenceArrival(
    { lat: TARGET.lat + 40 * DEG_PER_METER, lng: TARGET.lng, accuracy: 30 },
    TARGET,
    50,
  );
  assert.equal(r.accuracyWarning, true);
  assert.equal(r.isArrived, false);
});

test("精度漂移过滤：accuracy 劣但距离短且不确定带未覆盖阈值（10m+25m<50m）→ 触发", () => {
  const r = checkGeofenceArrival(
    { lat: TARGET.lat + 10 * DEG_PER_METER, lng: TARGET.lng, accuracy: 25 },
    TARGET,
    50,
  );
  assert.equal(r.accuracyWarning, true);
  assert.equal(r.isArrived, true);
});

test("精度漂移过滤：accuracy 优良（≤15m）且距离达标 → 触发且无警告", () => {
  const r = checkGeofenceArrival(
    { lat: TARGET.lat + 20 * DEG_PER_METER, lng: TARGET.lng, accuracy: 8 },
    TARGET,
    50,
  );
  assert.equal(r.accuracyWarning, false);
  assert.equal(r.isArrived, true);
  assert.equal(GEOFENCE_ACCURACY_DRIFT_METERS, 15);
});

test("精度漂移过滤：accuracy 劣但 40m+8m 不确定带仍在阈值内 → 触发", () => {
  const r = checkGeofenceArrival(
    { lat: TARGET.lat + 30 * DEG_PER_METER, lng: TARGET.lng, accuracy: 8 },
    TARGET,
    50,
  );
  assert.equal(r.isArrived, true);
});

test("停留时长防刷：满 120 分钟有效，119 分钟无效", () => {
  const checkin = 1_800_000_000_000;
  assert.equal(validateStayDuration(checkin, checkin + 120 * 60_000, 120), true);
  assert.equal(validateStayDuration(checkin, checkin + 119 * 60_000, 120), false);
  assert.equal(validateStayDuration(checkin, checkin, 0), false);
});

test("停留时长防御：倒序时间/负数时长/NaN → false", () => {
  const checkin = 1_800_000_000_000;
  assert.equal(validateStayDuration(checkin, checkin - 10 * 60_000, 30), false);
  assert.equal(validateStayDuration(checkin, checkin + 60_000, -1), false);
  assert.equal(validateStayDuration(NaN, checkin + 60_000, 30), false);
});

test("陪玩 300m 安全距离脱离：≥300m → 已脱离（触发自动结账停表信号）", () => {
  assert.equal(evaluateProximityDeparture(
    { lat: TARGET.lat + 300 * DEG_PER_METER, lng: TARGET.lng },
    TARGET,
    300,
  ), true);
});

test("陪玩 300m 安全距离脱离：299m 未脱离", () => {
  assert.equal(evaluateProximityDeparture(
    { lat: TARGET.lat + 299 * DEG_PER_METER, lng: TARGET.lng },
    TARGET,
    300,
  ), false);
});

test("非法坐标防御：越界纬度/NaN → 不触发不抛异常", () => {
  assert.equal(checkGeofenceArrival({ lat: 999, lng: 116.4 }, TARGET, 50).isArrived, false);
  assert.equal(checkGeofenceArrival({ lat: NaN, lng: 116.4 }, TARGET, 50).isArrived, false);
  assert.equal(evaluateProximityDeparture({ lat: NaN, lng: 116.4 }, TARGET, 300), false);
});

test("热备入口：外部 LBS 全挂 → 本地 Haversine 兜底判定口径一致（红线 1）", async () => {
  // 25m 内：外部通道全失败，回落 LOCAL_MOCK 后仍精确触发到达
  const r = await checkGeofenceArrivalViaHotSwap(
    { lat: TARGET.lat + 25 * DEG_PER_METER, lng: TARGET.lng },
    TARGET,
    GEOFENCE_DEFAULT_METERS,
    "geofence-fallback-test",
  );
  assert.equal(r.isArrived, true);
  assert.ok(Math.abs(r.distanceMeters - 25) < 0.5);
  assert.equal(r.usedVendor, "LOCAL_MOCK");
  assert.equal(r.fallbackHops, 3);
});

test("热备入口：外部 LBS 全挂 + 精度漂移 → 判未到达且给出 accuracyWarning", async () => {
  const r = await checkGeofenceArrivalViaHotSwap(
    { lat: TARGET.lat + 10 * DEG_PER_METER, lng: TARGET.lng, accuracy: 60 },
    TARGET,
    GEOFENCE_DEFAULT_METERS,
    "geofence-drift-test",
  );
  // 距离 10m ≤ 50m 但不确定带 10+60 > 50 → 未到达
  assert.equal(r.isArrived, false);
  assert.equal(r.accuracyWarning, true);
  assert.equal(r.usedVendor, "LOCAL_MOCK");
});
