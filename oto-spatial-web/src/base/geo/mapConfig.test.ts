import { test } from "node:test";
import assert from "node:assert/strict";
import {
  AMBIENT_POIS,
  buildMapDots,
  mapTier,
  resolveMapTier,
  type MapPointInput,
} from "./mapConfig.ts";

const base: MapPointInput = {
  id: "w-1",
  status: "active",
  position: { lat: 30.57, lng: 104.07 },
};

test("mapTier: ok device → 3d tier", () => {
  assert.equal(mapTier({ lowPower: false, webgl: true }), "3d");
});

test("mapTier: low-power device → css fallback", () => {
  assert.equal(mapTier({ lowPower: true, webgl: true }), "css");
});

test("mapTier: no WebGL → css fallback", () => {
  assert.equal(mapTier({ lowPower: false, webgl: false }), "css");
});

test("buildMapDots: only active, non-removed waves projected", () => {
  const dots = buildMapDots([
    { ...base, id: "a", status: "active" },
    { ...base, id: "b", status: "pending" },
    { ...base, id: "c", status: "active", removed: true },
  ]);
  assert.deepEqual(dots.map((d) => d.id), ["a"]);
  assert.equal(dots[0].position.lat, 30.57);
  assert.equal(dots[0].position.lng, 104.07);
});

test("buildMapDots: heat clamped to 0..1", () => {
  const dots = buildMapDots([
    { ...base, id: "hot", hotness: 12 },
    { ...base, id: "cold", hotness: -3 },
    { ...base, id: "mid", hotness: 4 },
  ]);
  const byId = Object.fromEntries(dots.map((d) => [d.id, d.hot]));
  assert.equal(byId.hot, 1);
  assert.equal(byId.cold, 0);
  assert.equal(byId.mid, 0.5);
});

test("buildMapDots: missing category → 未分类", () => {
  const [d] = buildMapDots([{ ...base, status: "active" }]);
  assert.equal(d.category, "未分类");
});

test("resolveMapTier: auto follows device probes", () => {
  assert.equal(resolveMapTier("3d", "auto"), "3d");
  assert.equal(resolveMapTier("css", "auto"), "css");
});

test("resolveMapTier: explicit override wins over probes", () => {
  assert.equal(resolveMapTier("css", "3d"), "3d");
  assert.equal(resolveMapTier("3d", "css"), "css");
});

test("AMBIENT_POIS: cold-start density stays inside MAP_CENTER box", () => {
  assert.ok(AMBIENT_POIS.length >= 15, "density matters for a non-empty city");
  AMBIENT_POIS.forEach((p) => {
    assert.ok(Math.abs(p.lat - 30.574) <= 0.012, `lat drift ${p.lat}`);
    assert.ok(Math.abs(p.lng - 104.066) <= 0.03, `lng drift ${p.lng}`);
  });
});