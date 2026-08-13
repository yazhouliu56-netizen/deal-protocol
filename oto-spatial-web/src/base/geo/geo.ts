/**
 * Geo utilities for the P2P broadcast map (P3 precondition).
 * Pure + unit-testable; no runtime relative imports so `node --experimental-strip-types`
 * can run tests directly.
 *
 * Waves carry an optional `basics.geo` ({ lat, lng }). Data authored before geo
 * existed gets a deterministic pseudo-coordinate (hash of the area string) so
 * the heat map / nearby features can still demo on legacy data.
 */

export interface GeoPoint {
  lat: number;
  lng: number;
}

export type GeoReferenced = {
  basics?: { geo?: GeoPoint; area?: string };
};

const EARTH_KM = 6371;

/** Great-circle distance in km (Haversine). Pure. */
export function distanceKm(a: GeoPoint, b: GeoPoint): number {
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const lat1 = toRad(a.lat);
  const lat2 = toRad(b.lat);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return 2 * EARTH_KM * Math.asin(Math.sqrt(h));
}

/** Deterministic pseudo-coordinates from a string (legacy/no-geo fallback). */
export function geoFromName(name: string, origin: GeoPoint): GeoPoint {
  let h = 2166136261 >>> 0;
  for (let i = 0; i < name.length; i++) {
    h ^= name.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  // +/- 0.06° (~6-7 km box) around the origin — enough spread for the map.
  const lat = origin.lat + ((h % 2000) - 1000) / 100000;
  const lng = origin.lng + (((h >> 8) % 2000) - 1000) / 100000;
  return { lat, lng };
}

/** Resolve a ref's on-map position: explicit geo, else generated from area. */
export function geoOf(
  item: GeoReferenced,
  fallback: GeoPoint
): GeoPoint {
  const g = item.basics?.geo;
  return g && Number.isFinite(g.lat) && Number.isFinite(g.lng)
    ? g
    : geoFromName(item.basics?.area ?? "", fallback);
}

/** Items within `radiusKm` of the origin, nearest first. */
export function nearby<T extends GeoReferenced>(
  items: T[],
  origin: GeoPoint,
  radiusKm: number
): T[] {
  return items
    .map((it) => ({ it, d: distanceKm(geoOf(it, origin), origin) }))
    .filter(({ d }) => d <= radiusKm)
    .sort((a, b) => a.d - b.d)
    .map(({ it }) => it);
}

/** Map an item to its scaled x (lng) / y (lat) position on a fixed box. */
export function toMapXy(p: GeoPoint, origin: GeoPoint, spanLng: number, spanLat: number) {
  const x = 0.5 + (p.lng - origin.lng) / spanLng;
  const y = 0.5 - (p.lat - origin.lat) / spanLat;
  return { x: Math.max(0, Math.min(1, x)), y: Math.max(0, Math.min(1, y)) };
}