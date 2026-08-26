/**
 * LBS 距离判定端口（Microkernel 2.0 战役 2 · 六边形架构）：
 * 纯核（geofence-watcher）只依赖本端口的类型与本地 Haversine 兜底实现；
 * 多厂商热备总线（src/adapters/gateway/multi-channel-gateway）作为可注入
 * 实现方，经 configureLbsDistance 在组合根装配。adapters→base 单向。
 */

export interface LbsDistanceInput {
  a: { lat: number; lng: number };
  b: { lat: number; lng: number };
}

export interface LbsDistanceOutput {
  /** 米（两位小数）。 */
  distanceMeters: number;
}

/** 热备总线派发结果形状（厂商与下跳次数供治理/审计）。 */
export interface LbsDispatchResult {
  result: LbsDistanceOutput;
  usedVendor: string;
  fallbackHops: number;
}

export type LbsDistanceFn = (
  input: LbsDistanceInput,
  channelKey?: string,
) => Promise<LbsDispatchResult>;

/** 本地 Haversine 大圆距离（米）——确定性纯函数兜底。 */
export function haversineMeters(a: LbsDistanceInput["a"], b: LbsDistanceInput["b"]): number {
  const toRad = (d: number) => (d * Math.PI) / 180;
  const EARTH_KM = 6371;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const lat1 = toRad(a.lat);
  const lat2 = toRad(b.lat);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return Math.round(2 * EARTH_KM * 1000 * Math.asin(Math.sqrt(h)) * 100) / 100;
}

/** 无适配器装配时的纯本地派发（等价 LOCAL_MOCK 通道语义）。 */
export function localHaversineDispatch(input: LbsDistanceInput): LbsDispatchResult {
  return {
    result: { distanceMeters: haversineMeters(input.a, input.b) },
    usedVendor: "LOCAL_MOCK",
    fallbackHops: 0,
  };
}
