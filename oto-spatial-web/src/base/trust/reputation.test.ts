import { test } from "node:test";
import assert from "node:assert/strict";
import {
  applyCreditDelta,
  creditTierFrom,
  defaultedToGoodReview,
  maskName,
  maskTimeline,
} from "./reputation.ts";

test("defaultUnratedReview after 72h", () => {
  const t = 1_700_000_000_000;
  const H = 60 * 60 * 1000;
  // completed 73h ago, reviewed now → the 72h window lapsed → default good
  assert.equal(defaultedToGoodReview(t - 73 * H, t, t), true);
  // completed 1h ago and reviewed → within window → no default
  assert.equal(defaultedToGoodReview(t - 1 * H, t, t), false);
});

test("creditTierFrom ladder + verified floor", () => {
  assert.equal(creditTierFrom(1, 2.5, false), 1);
  assert.equal(creditTierFrom(3, 4.2, false), 3);
  assert.equal(creditTierFrom(8, 4.6, false), 4);
  assert.equal(creditTierFrom(15, 4.2, false), 3); // avg < 4.5 → tier stays 3
  assert.equal(creditTierFrom(20, 4.9, false), 5);
  assert.equal(creditTierFrom(0, 0, true), 3); // verified floors at 3
});

test("applyCreditDelta clamps to [1,5]", () => {
  assert.equal(applyCreditDelta(3, -1), 2);
  assert.equal(applyCreditDelta(1, -1), 1);
  assert.equal(applyCreditDelta(5, 1), 5);
});

test("maskReviewTimeline keeps all items, deterministic per seed", () => {
  const items = Array.from({ length: 5 }, (_, i) => ({
    id: `r${i}`,
    createdAt: 1000 + i * 10,
  })).map((x) => ({ ...x, reviewedAt: x.createdAt }));
  const masked = maskTimeline(items, 42);
  assert.equal(masked.length, items.length);
  assert.deepEqual(
    new Set(masked.map((m) => m.id)),
    new Set(items.map((i) => i.id))
  );
  const again = maskTimeline(items, 42);
  assert.deepEqual(masked, again); // same input+seed → same order
});

test("maskName anonymizes", () => {
  assert.equal(maskName("阿凯"), "阿**");
});