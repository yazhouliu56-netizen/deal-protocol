import { test } from "node:test";
import assert from "node:assert/strict";
import {
  REVIEW_WINDOW_MS,
  createReview,
  creditFromReviews,
  dailyQuotaForTier,
  decayLabel,
  meanScore,
  reviewDeadline,
  reviewDue,
  type Review,
  type ReviewDimensions,
} from "./review.ts";

const dims: ReviewDimensions = { punctual: 5, attitude: 4, professional: 4 };

test("createReview scores the mean of the 3 dimensions", () => {
  const r = createReview({
    id: "r1",
    claimId: "c1",
    fromId: "a",
    toId: "b",
    dimensions: dims,
    at: 1000,
  });
  assert.equal(meanScore(dims), (5 + 4 + 4) / 3);
  assert.equal(r.score, 4.3);
});

test("review window is 72h after fulfilment", () => {
  const confirmedAt = 5000;
  assert.equal(reviewDeadline(confirmedAt) - confirmedAt, REVIEW_WINDOW_MS);
  assert.equal(reviewDue(0, confirmedAt, confirmedAt + 1000), true);
  assert.equal(reviewDue(0, confirmedAt, confirmedAt - 1), false);
  assert.equal(
    reviewDue(0, confirmedAt, confirmedAt + REVIEW_WINDOW_MS),
    false
  );
});

test("decayLabel hints recency (anti-reverse-identification)", () => {
  const now = 10_000_000;
  assert.equal(decayLabel(now - 3 * 24 * 3600_000, now), "1 周前");
  assert.equal(decayLabel(now - 20 * 24 * 3600_000, now), "1 个月前");
  assert.equal(decayLabel(now - 100 * 24 * 3600_000, now), "3 个月前");
});

test("creditFromReviews maps average score to tier, empty keeps tier", () => {
  const mk = (score: number): Review =>
    createReview({
      id: String(score),
      claimId: "c",
      fromId: "x",
      toId: "me",
      dimensions: { punctual: score, attitude: score, professional: score },
      at: 1,
    });
  assert.equal(creditFromReviews([], 3), 3);
  assert.equal(creditFromReviews([mk(5), mk(5)], 3), 5);
  assert.equal(creditFromReviews([mk(4), mk(4)], 3), 4);
  assert.equal(creditFromReviews([mk(3)], 3), 3);
  assert.equal(creditFromReviews([mk(1), mk(1)], 4), 1);
});

test("dailyQuotaForTier expands at Lv 4+ (响应额度扩容)", () => {
  assert.equal(dailyQuotaForTier(3), 5);
  assert.equal(dailyQuotaForTier(4), 8);
  assert.equal(dailyQuotaForTier(5), 8);
});