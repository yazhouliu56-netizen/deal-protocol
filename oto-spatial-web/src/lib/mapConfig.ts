/**
 * P3 map configuration (ADR-0004): MapLibre GL JS + OpenFreeMap free vector
 * instance. Pure + unit-testable: NO runtime relative imports (keeps
 * `node --experimental-strip-types` tests running directly).
 *
 * Initial scope (ADR-0004): static base map + 3D perspective (pitch) +
 * active-wave points + click-to-focus. Tile URL is a single constant so a
 * future switch to self-hosted / commercial tiles = one line.
 */

export interface GeoPoint {
  lat: number;
  lng: number;
}

export interface MapPointInput {
  id: string;
  status?: string;
  removed?: boolean;
  hotness?: number;
  category?: string;
  /** Pre-resolved on-map position (caller resolves via geo.geoOf). */
  position: GeoPoint;
}

export const MAP_CENTER: GeoPoint = { lat: 30.5728, lng: 104.0668 };

/** Initial zoom — city granularity for a "po-do immersion" feel. */
export const MAP_ZOOM = 13;

/** 3D pitch tilt (degrees). 0 = flat cartographic view. */
export const MAP_PITCH = 25;

/** Free extrusion-capable style (buildings render volumetric). */
export const MAP_STYLE_URL = "https://tiles.openfreemap.org/styles/liberty";

export type MapTier = "css" | "3d";

/** User-facing map preference: auto (follow device) or forced tier. */
export type MapOverride = "auto" | MapTier;

/**
 * Merges the auto-computed tier with the user's stored preference.
 * "auto" = follow device probes; otherwise the override always wins.
 */
export function resolveMapTier(auto: MapTier, override: MapOverride): MapTier {
  return override === "auto" ? auto : override;
}

/**
 * Rendering tier via explicit capability flags (caller injects the browser
 * probes — keeps this module import-free). Low power or no WebGL falls all
 * the way back to the S1 CSS grid: never a blank card.
 */
export function mapTier(input: {
  lowPower: boolean;
  webgl: boolean;
}): MapTier {
  return input.lowPower || !input.webgl ? "css" : "3d";
}

export type MapDot = {
  id: string;
  position: GeoPoint;
  /** 0..1 heat strength (map glow styling). */
  hot: number;
  category: string;
};

/** Project active waves onto map glow dots (anonymous: no identity fields). */
export function buildMapDots(waves: MapPointInput[]): MapDot[] {
  return waves
    .filter((w) => w.status === "active" && !w.removed)
    .map((w) => ({
      id: w.id,
      position: w.position,
      hot: Math.max(0, Math.min(1, (w.hotness ?? 0) / 8)),
      category: w.category ?? "未分类",
    }));
}

/**
 * 冷启动氛围数据（纯本地 demo）：一批静态「附近生活点」让城市不空 ——
 * 视觉密度，不参与撮合。坐标围绕 MAP_CENTER ±0.05°（成都城区网格）。
 */
export const AMBIENT_POIS: GeoPoint[] = [
  { lat: 30.5743, lng: 104.0624 },
  { lat: 30.5712, lng: 104.0699 },
  { lat: 30.5768, lng: 104.0661 },
  { lat: 30.5691, lng: 104.0632 },
  { lat: 30.5772, lng: 104.0718 },
  { lat: 30.5801, lng: 104.0587 },
  { lat: 30.5678, lng: 104.0598 },
  { lat: 30.5823, lng: 104.0759 },
  { lat: 30.5682, lng: 104.0731 },
  { lat: 30.5796, lng: 104.0798 },
  { lat: 30.5723, lng: 104.077 },
  { lat: 30.5761, lng: 104.0821 },
  { lat: 30.5666, lng: 104.0666 },
  { lat: 30.5814, lng: 104.0688 },
  { lat: 30.5705, lng: 104.0812 },
  { lat: 30.5739, lng: 104.0837 },
  { lat: 30.5784, lng: 104.0549 },
  { lat: 30.5652, lng: 104.0717 },
];