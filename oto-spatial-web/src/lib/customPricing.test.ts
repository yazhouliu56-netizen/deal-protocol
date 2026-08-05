import { test } from "node:test";
import assert from "node:assert/strict";
import {
  customSurcharge,
  suggestedPrice,
  raiseSuggestion,
  yuan,
  ADD_RATE,
} from "./customPricing.ts";

test("ladder: 15% × N is straight-line", () => {
  const base = 100;
  assert.equal(customSurcharge(base, 0), 0);
  assert.equal(customSurcharge(base, 1), Math.round(100 * ADD_RATE * 1)); // 15
  assert.equal(customSurcharge(base, 2), Math.round(200 * ADD_RATE)); // 30
  assert.equal(customSurcharge(base, 3), Math.round(300 * ADD_RATE)); // 45
});

test("suggestedPrice = base + ladder", () => {
  assert.equal(suggestedPrice(200, 2), 260);
  assert.equal(suggestedPrice(50, 1), 58);
  assert.equal(suggestedPrice(50, 0), 50);
});

test("raiseSuggestion nudges a bit above full ladder", () => {
  const r = raiseSuggestion(200, 2);
  assert.equal(r, suggestedPrice(200, 2) + Math.round(200 * 0.2));
});

test("yuan formats currency", () => {
  assert.equal(yuan(80), "¥80");
  assert.equal(yuan(83.7), "¥84");
});