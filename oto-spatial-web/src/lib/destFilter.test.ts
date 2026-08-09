import { test } from "node:test";
import assert from "node:assert/strict";
import {
  filterDestinations,
  inBand,
  priceOf,
  distanceFrom,
  ORIGIN,
  PRICE_BANDS,
} from "./destFilter.ts";
import { otoExperiences } from "./mockData.ts";

test("priceOf: parses comma + yuan", () => {
  assert.equal(priceOf("¥2,280/晚"), 2280);
  assert.equal(priceOf("¥1,070/晚"), 1070);
  assert.equal(priceOf("¥3,690/晚"), 3690);
});

test("priceOf: unparsable → Infinity", () => {
  assert.equal(priceOf("面议"), Number.POSITIVE_INFINITY);
});

test("inBand: every band boundary", () => {
  assert.equal(inBand(1200, "any"), true);
  assert.equal(inBand(1200, "lt1500"), true);
  assert.equal(inBand(1500, "lt1500"), false);
  assert.equal(inBand(1500, "mid"), true);
  assert.equal(inBand(2500, "mid"), true);
  assert.equal(inBand(2501, "mid"), false);
  assert.equal(inBand(2600, "gt2500"), true);
});

test("filterDestinations: band filters correctly", () => {
  const r = filterDestinations(otoExperiences, {
    band: "lt1500",
    arOnly: false,
    sort: "recommend",
  });
  assert.ok(r.length > 0);
  for (const e of r) assert.ok(priceOf(e.price) < 1500);
});

test("filterDestinations: arOnly keeps only AR destinations", () => {
  const r = filterDestinations(otoExperiences, {
    band: "any",
    arOnly: true,
    sort: "recommend",
  });
  assert.ok(r.length > 0 && r.every((e) => e.hasAR));
});

test("filterDestinations: price-asc sorts ascending", () => {
  const r = filterDestinations(otoExperiences, {
    band: "any",
    arOnly: false,
    sort: "price-asc",
  });
  const prices = r.map((e) => priceOf(e.price));
  for (let i = 1; i < prices.length; i++) {
    assert.ok(prices[i - 1] <= prices[i]);
  }
});

test("filterDestinations: rating sort desc", () => {
  const r = filterDestinations(otoExperiences, {
    band: "any",
    arOnly: false,
    sort: "rating",
  });
  for (let i = 1; i < r.length; i++) {
    assert.ok(r[i - 1].rating >= r[i].rating);
  }
});

test("distanceFrom: Chengdu→Kyoto sane magnitude, same-origin zero", () => {
  const kyoto = otoExperiences.find((e) => e.id === "oto-kyoto-ryokan")!;
  const d = distanceFrom(kyoto, ORIGIN);
  assert.ok(d > 1000 && d < 5000, `Kyoto ~3200km, got ${d}`);
  const zero = distanceFrom(
    {
      ...kyoto,
      coordinates: { lat: ORIGIN.lat, lng: ORIGIN.lng },
    },
    ORIGIN
  );
  assert.ok(zero < 0.001);
});

test("near sort puts Chengdu-closest first (Kyoto vs Maldives)", () => {
  const r = filterDestinations(otoExperiences, {
    band: "any",
    arOnly: false,
    sort: "near",
  });
  const d = r.map((e) => distanceFrom(e, ORIGIN));
  for (let i = 1; i < d.length; i++) assert.ok(d[i - 1] <= d[i]);
});

test("PRICE_BANDS has 4 stable ids", () => {
  assert.deepEqual(
    PRICE_BANDS.map((b) => b.id),
    ["any", "lt1500", "mid", "gt2500"]
  );
});