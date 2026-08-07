import { test } from "node:test";
import assert from "node:assert/strict";
import {
  distanceKm,
  geoFromName,
  geoOf,
  nearby,
  toMapXy,
  type GeoPoint,
} from "./geo.ts";

const ORIGIN: GeoPoint = { lat: 30.5728, lng: 104.0668 };

test("distanceKm: same point = 0, Beijing-Shanghai ~1067km", () => {
  assert.equal(distanceKm(ORIGIN, ORIGIN), 0);
  const beijing = { lat: 39.9042, lng: 116.4074 };
  const shanghai = { lat: 31.2304, lng: 121.4737 };
  const d = distanceKm(beijing, shanghai);
  assert.ok(d > 1000 && d < 1130, `got ${d}`);
});

test("geoFromName is deterministic and near origin", () => {
  const a = geoFromName("幸福家园小区", ORIGIN);
  const b = geoFromName("幸福家园小区", ORIGIN);
  assert.deepEqual(a, b);
  assert.ok(distanceKm(a, ORIGIN) < 12);
});

test("geoOf: explicit geo wins, else fallback from area", () => {
  assert.deepEqual(geoOf({ basics: { geo: { lat: 31, lng: 121 } } }, ORIGIN), {
    lat: 31,
    lng: 121,
  });
  const g = geoOf({ basics: { area: "天府广场" } }, ORIGIN);
  assert.ok(Number.isFinite(g.lat) && Number.isFinite(g.lng));
  assert.ok(distanceKm(g, ORIGIN) < 12);
});

test("nearby: filters by radius and sorts nearest first", () => {
  const items = [
    { basics: { geo: { lat: 30.6, lng: 104.1 } } }, // ~3.3km
    { basics: { geo: { lat: 31.2, lng: 105.0 } } }, // ~110km — out of range
    { basics: { geo: { lat: 30.58, lng: 104.07 } } }, // ~0.7km
    { basics: { area: "老数据无坐标" } }, // fallback, near origin
  ];
  const result = nearby(items, ORIGIN, 50);
  assert.equal(result.length, 3);
  const d = result.map((r) => distanceKm(geoOf(r, ORIGIN), ORIGIN));
  assert.ok(d[0] <= d[1] && d[1] <= d[2], `order ${d.join(",")}`);
});

test("toMapXy: clamps into [0,1]", () => {
  const far = { lat: 90, lng: 180 };
  const xy = toMapXy(far, ORIGIN, 2, 2);
  assert.ok(xy.x >= 0 && xy.x <= 1 && xy.y >= 0 && xy.y <= 1);
});