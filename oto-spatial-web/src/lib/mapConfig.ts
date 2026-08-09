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