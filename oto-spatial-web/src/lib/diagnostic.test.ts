import { test } from "node:test";
import assert from "node:assert/strict";
import {
  DIAGNOSE_AFTER_MS,
  mockDiagnose,
  type DiagnoseWave,
} from "./diagnostic.ts";

const base = (over: Partial<DiagnoseWave> = {}): DiagnoseWave => ({
  id: "wave-1",
  budget: 100,
  basics: { category: "家政保洁", radiusKm: 2 },
  customs: [],
  createdAt: Date.now() - DIAGNOSE_AFTER_MS - 1000,
  ...over,
});

test("too-fresh wave yields no advice", () => {
  const w = base({ createdAt: Date.now() - 1000 });
  assert.equal(mockDiagnose(w).length, 0);
});

test("fresh-but-claimable age still diagnoses after threshold", () => {
  const w = base({ createdAt: Date.now() - DIAGNOSE_AFTER_MS - 5000 });
  assert.ok(mockDiagnose(w).length > 0);
});

test("vague wave (no customs) gets the custom-conditions advice", () => {
  const advice = mockDiagnose(base());
  assert.ok(advice.some((a) => a.kind === "customs"));
});

test("wave with customs + tight radius gets radius advice first", () => {
  const w = base({ customs: [{ text: "30 岁左右女性厨师" }] });
  const advice = mockDiagnose(w);
  assert.ok(advice.some((a) => a.kind === "radius"));
  assert.ok(!advice.some((a) => a.kind === "customs"));
});

test("comfortable radius (>=5km) never gets radius advice", () => {
  const w = base({
    basics: { category: "羽毛球约局", radiusKm: 5 },
    customs: [{ text: "业余水平" }],
  });
  const advice = mockDiagnose(w);
  assert.ok(!advice.some((a) => a.kind === "radius"));
});

test("well-formed demand gets budget advice as the last resort", () => {
  const w = base({
    basics: { category: "羽毛球约局", radiusKm: 5 },
    customs: [{ text: "业余水平" }],
  });
  const advice = mockDiagnose(w);
  assert.equal(advice.length, 1);
  assert.equal(advice[0]!.kind, "price");
});

test("advice is capped at 3 and ids are wave-scoped", () => {
  const w = base({
    basics: { category: "羽毛球约局", radiusKm: 1 },
    customs: [{ text: "业余水平" }, { text: "包球" }],
  });
  const advice = mockDiagnose(w);
  assert.ok(advice.length <= 3);
  assert.ok(advice.every((a) => a.id.startsWith("wave-1")));
});