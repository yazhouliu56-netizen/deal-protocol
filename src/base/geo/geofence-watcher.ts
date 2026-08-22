/**
 * L4-M3 物理履约闭环 · 50m 高精 GPS 围栏时空判定引擎（纯函数，无头适配器）。
 *
 * 红线 3：本模块为纯函数层，零 UI / Store 依赖；红线 1：时空判定全部
 * 确定性计算（Haversine + 精度漂移过滤），不引入任何概率性判断。
 * 距离复用 `base/geo/geo.ts` 的 Haversine 纯函数（同一地球模型，避免
 * 双实现漂移）；GPS 精度漂移过滤：设备上报 accuracy 时，若「距离 + 精度
 * 不确定带」越过围栏阈值则判为未到达（防漂移误触发），并给出 accuracyWarning。
 *
 * L5-M1 多通道适配：新增异步入口 `checkGeofenceArrivalViaHotSwap` —— 距离
 * 经多厂商热备总线计算（MapLibre/OpenFreeMap ➔ 高德 ➔ 腾讯 ➔ 本地
 * Haversine 纯数学兜底，宪法 #10），外部 LBS 全挂时自动回落本地确定性
 * 计算，判定口径与同步入口完全一致。
 */

import { distanceKm, type GeoPoint } from "./geo.ts";
import {
  calculateDistanceWithFallback,
  type LbsDistanceInput,
} from "../platform/multi-channel-gateway.ts";

/** 设备坐标（GPS 上报点；accuracy 缺省 = 无法获取精度信息）。 */
export interface Coordinates {
  lat: number;
  lng: number;
  /** 水平定位精度（米）；缺省 = 未知（不参与漂移过滤）。 */
  accuracy?: number;
}

/** 到达判定结果。 */
export interface GeofenceArrivalResult {
  /** 是否判定到达围栏（精度漂移不确定带未覆盖阈值）。 */
  isArrived: boolean;
  /** 与目标点的 Haversine 直线距离（米，两位小数）。 */
  distanceMeters: number;
  /** 精度质量警告（漂移不确定带影响判定，建议重试定位）。 */
  accuracyWarning: boolean;
}

/** 默认 50m 履约围栏（白皮书 L4-M3；attendance 同口径）。 */
export const GEOFENCE_DEFAULT_METERS = 50;
/** 精度漂移不可信阈值（米）：精度劣于此即视为低质量定位。 */
export const GEOFENCE_ACCURACY_DRIFT_METERS = 15;

const round2 = (n: number): number => Math.round(n * 100) / 100;

function isValidCoords(c: Coordinates): boolean {
  return (
    Number.isFinite(c.lat) &&
    Number.isFinite(c.lng) &&
    c.lat >= -90 &&
    c.lat <= 90 &&
    c.lng >= -180 &&
    c.lng <= 180
  );
}

/**
 * 50m 围栏到达判定（L4-M3 核销前置）。
 *
 * - 距离 = Haversine 米距（复用 base/geo 地球模型）；
 * - 精度漂移过滤：设备上报 accuracy 时，若 dist + accuracy > 阈值 →
 *   不确定带已覆盖阈值边界，判未到达 + accuracyWarning（防 GPS 漂移
 *   在围栏边缘反复误触发签到/核销）；
 * - 无 accuracy（定位源不提供精度）→ 按纯距离判定，不误报警告。
 */
export function checkGeofenceArrival(
  currentCoords: Coordinates,
  targetCoords: Coordinates,
  thresholdMeters: number = GEOFENCE_DEFAULT_METERS,
): GeofenceArrivalResult {
  if (!isValidCoords(currentCoords) || !isValidCoords(targetCoords)) {
    return { isArrived: false, distanceMeters: 0, accuracyWarning: false };
  }
  const distanceMeters = round2(distanceKm(currentCoords, targetCoords) * 1000);
  const hasAccuracy = Number.isFinite(currentCoords.accuracy);
  const accuracyWarning =
    hasAccuracy &&
    (currentCoords.accuracy as number) > GEOFENCE_ACCURACY_DRIFT_METERS;
  const driftBand = hasAccuracy ? (currentCoords.accuracy as number) : 0;
  const isArrived = distanceMeters <= thresholdMeters && distanceMeters + driftBand <= thresholdMeters;
  return { isArrived, distanceMeters, accuracyWarning };
}

/**
 * 停留有效时长防刷校验（L4-M3 物理履约防挂机）：
 * 到场签到 → 完工签退的实际停留时长 ≥ 最小服务时长才算有效履约，
 * 否则视为「秒签秒退」刷单（由上层阻断核销）。
 */
export function validateStayDuration(
  checkinTime: number,
  checkoutTime: number,
  minDurationMinutes: number,
): boolean {
  if (
    !Number.isFinite(checkinTime) ||
    !Number.isFinite(checkoutTime) ||
    !Number.isFinite(minDurationMinutes) ||
    minDurationMinutes <= 0
  ) {
    return false;
  }
  return checkoutTime - checkinTime >= minDurationMinutes * 60_000;
}

/**
 * 陪玩 300m 安全距离脱离判定（CompanionSlot / DepartureFinishHook 同口径）：
 * 双方当前距离 ≥ 安全距离 → 已安全脱离（触发自动结账停表信号）。
 */
export function evaluateProximityDeparture(
  currentCoords: Coordinates,
  targetCoords: Coordinates,
  safeDistanceMeters: number = 300,
): boolean {
  if (!isValidCoords(currentCoords) || !isValidCoords(targetCoords)) {
    return false;
  }
  return distanceKm(currentCoords, targetCoords) * 1000 >= safeDistanceMeters;
}

/**
 * L5-M1 热备距离判定入口（异步）：距离经多厂商热备总线计算，
 * 外部 LBS 服务全挂时回落本地 Haversine，判定口径与同步入口一致。
 * 返回到达判定 + 本次实际使用的厂商与下跳次数（治理/审计用）。
 */
export async function checkGeofenceArrivalViaHotSwap(
  currentCoords: Coordinates,
  targetCoords: Coordinates,
  thresholdMeters: number = GEOFENCE_DEFAULT_METERS,
  channelKey = "geofence-arrival",
): Promise<GeofenceArrivalResult & { usedVendor: string; fallbackHops: number }> {
  const input: LbsDistanceInput = {
    a: { lat: currentCoords.lat, lng: currentCoords.lng },
    b: { lat: targetCoords.lat, lng: targetCoords.lng },
  };
  const dispatch = await calculateDistanceWithFallback(input, channelKey);
  const distanceMeters = Math.round(dispatch.result.distanceMeters * 100) / 100;

  const hasAccuracy = Number.isFinite(currentCoords.accuracy);
  const accuracyWarning =
    hasAccuracy &&
    (currentCoords.accuracy as number) > GEOFENCE_ACCURACY_DRIFT_METERS;
  const driftBand = hasAccuracy ? (currentCoords.accuracy as number) : 0;
  const isArrived = distanceMeters <= thresholdMeters && distanceMeters + driftBand <= thresholdMeters;

  return {
    isArrived,
    distanceMeters,
    accuracyWarning,
    usedVendor: dispatch.usedVendor,
    fallbackHops: dispatch.fallbackHops,
  };
}

/** 复合坐标类型兼容（GeoPoint = { lat, lng } ⊂ Coordinates）。 */
export type { GeoPoint };
