/**
 * base/geo RN 适配层接口（ADR-0015，缺口 N16）。
 * mobile 的 location.ts 消费方在此声明统一接口；web 用 mock 实现，
 * RN 端实现可注入（getCurrentPosition 等价物 + 权限 + 精度）。
 * 纯接口 + 无副作用工厂，SSR 安全。
 */

import type { GeoPoint } from "./geo.ts";

/** RN 端位置源实现。web 端默认 MockGeoSrc（演示坐标）。 */
export interface GeoSrc {
  readonly platform: "web" | "rn";
  /** 当前位置（可选，未授权/失败 → null）。 */
  current(): Promise<GeoPoint | null>;
  /** 位置权限状态。 */
  permission(): Promise<"granted" | "denied" | "undetermined">;
  /** 按名称解析坐标（RN 端可用系统地理编码）。 */
  geocode(name: string): Promise<GeoPoint | null>;
}

/** Web 演示实现：确定性伪坐标（依赖 base/geo.geoFromName）。 */
export class MockGeoSrc implements GeoSrc {
  readonly platform = "web" as const;
  private origin: GeoPoint;
  private granted: boolean;
  constructor(origin: GeoPoint = { lat: 30.57, lng: 104.06 }, granted = true) {
    this.origin = origin;
    this.granted = granted;
  }
  async current(): Promise<GeoPoint | null> {
    return this.granted ? this.origin : null;
  }
  async permission(): Promise<"granted" | "denied" | "undetermined"> {
    return this.granted ? "granted" : "undetermined";
  }
  async geocode(name: string): Promise<GeoPoint | null> {
    const { geoFromName } = await import("./geo.ts");
    return name ? geoFromName(name, this.origin) : null;
  }
}

/**
 * Web 真实定位实现（ADR-0015 N16 消费方）：navigator.geolocation 封装。
 * 未授权/超时/无能力 → current() 返回 null（调用方降级到 mock/演示坐标，
 * 宪法 #10：壳即降级，永不裸奔）。同源 geocode 与 Mock 一致（web 无系统地理编码）。
 */
export class WebGeoSrc implements GeoSrc {
  readonly platform = "web" as const;
  private cached: GeoPoint | null = null;
  private dead = false;

  async current(): Promise<GeoPoint | null> {
    if (this.cached) return this.cached;
    if (this.dead || typeof navigator === "undefined" || !navigator.geolocation) {
      return null;
    }
    try {
      const pos = await new Promise<GeolocationPosition>((resolve, reject) => {
        navigator.geolocation.getCurrentPosition(resolve, reject, {
          timeout: 8000,
          maximumAge: 60_000,
        });
      });
      const p: GeoPoint = { lat: pos.coords.latitude, lng: pos.coords.longitude };
      this.cached = p;
      return p;
    } catch {
      this.dead = true;
      return null;
    }
  }

  async permission(): Promise<"granted" | "denied" | "undetermined"> {
    if (typeof navigator === "undefined" || !navigator.geolocation) return "denied";
    try {
      const status = await navigator.permissions.query({ name: "geolocation" });
      if (status.state === "granted") return "granted";
      if (status.state === "denied") return "denied";
      return "undetermined";
    } catch {
      return (await this.current()) ? "granted" : "undetermined";
    }
  }

  async geocode(name: string): Promise<GeoPoint | null> {
    const { geoFromName } = await import("./geo.ts");
    const origin = (await this.current()) ?? { lat: 30.57, lng: 104.06 };
    return name ? geoFromName(name, origin) : null;
  }
}

/** 统一入口：mobile location.ts 应接线到 setGeoSrc；web 默认 mock。 */
let src: GeoSrc = new MockGeoSrc();

export function setGeoSrc(next: GeoSrc): GeoSrc {
  src = next;
  return src;
}

export function getGeoSrc(): GeoSrc {
  return src;
}

export function isRn(): boolean {
  return src.platform === "rn";
}