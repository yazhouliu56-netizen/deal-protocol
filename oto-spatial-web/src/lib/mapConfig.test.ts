import { test } from "node:test";
import assert from "node:assert/strict";
import { buildMapDots, mapTier, type MapPointInput } from "./mapConfig.ts";

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