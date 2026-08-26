/**
 * LBS 轨迹流采样器（P1-3 一键 SOS 联动链 · L1-M2 硬件感知适配层）。
 * 平台硬件层：navigator.geolocation.watchPosition 前台连续采样，
 * 经 base/safe/crisis-tracker.recordBreadcrumbPoint 入轨迹缓冲（FIFO 64 点）。
 * 条文 #3/#5：由弹药 fuzePolicy.sos.autoLocationReport 声明式开关驱动，底座不自行开启；
 * 条文 #10：无 geolocation / 权限拒绝 / Headless 环境 100% 静默降级，绝不抛异常。
 */

import {
  recordBreadcrumbPoint,
  type BreadcrumbPoint,
} from "@/base/safe/crisis-tracker";

const MAX_TRAIL_POINTS = 64;

let trail: BreadcrumbPoint[] = [];
let watchId: number | null = null;

function currentGeolocation(): Geolocation | null {
  if (typeof navigator === "undefined") return null;
  return navigator.geolocation ?? null;
}

/** 内部纯入队位（测试直测点）：非法坐标由 base 拒绝并计数。 */
export function pushGeoPoint(point: BreadcrumbPoint): void {
  const r = recordBreadcrumbPoint(trail, point, MAX_TRAIL_POINTS);
  trail = r.points;
}

/**
 * 启动前台轨迹采样（仅当弹药 sos 引信 autoLocationReport=true 时调用）。
 * 返回是否真实启动；环境不支持时 false（静默降级，不抛错）。
 */
export function startGeoTracker(autoLocationReport: boolean): boolean {
  if (!autoLocationReport || watchId !== null) return false;
  const geo = currentGeolocation();
  if (!geo) return false;
  try {
    watchId = geo.watchPosition(
      (pos) => {
        const c = pos.coords;
        if (typeof c.latitude !== "number" || typeof c.longitude !== "number") return;
        pushGeoPoint({
          lat: c.latitude,
          lng: c.longitude,
          accuracy: Number.isFinite(c.accuracy) ? c.accuracy : 0,
          timestamp: pos.timestamp || Date.now(),
        });
      },
      () => {
        // 权限拒绝 / 不可用：保持已采集轨迹，静默停采（降级是设计的一部分）。
        stopGeoTracker();
      },
      { enableHighAccuracy: true, maximumAge: 5000, timeout: 15000 }
    );
    return true;
  } catch {
    watchId = null;
    return false;
  }
}

export function stopGeoTracker(): void {
  const geo = currentGeolocation();
  if (watchId !== null && geo) {
    try {
      geo.clearWatch(watchId);
    } catch {
      // 清理失败不影响主流程
    }
  }
  watchId = null;
}

/** 提取当前轨迹快照（不清空——重复触发 SOS 复用最近轨迹）。 */
export function snapshotGeoTrail(): BreadcrumbPoint[] {
  return [...trail];
}

/** 是否正在采样。 */
export function isGeoTracking(): boolean {
  return watchId !== null;
}

/** 测试隔离位：清空模块级状态。 */
export function resetGeoTrackerForTest(): void {
  trail = [];
  watchId = null;
}
