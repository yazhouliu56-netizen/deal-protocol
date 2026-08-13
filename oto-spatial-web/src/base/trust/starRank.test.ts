import { test } from "node:test";
import assert from "node:assert/strict";
import {
  completionRate,
  rankLabel,
  reviewStats,
  starWeight,
} from "./starRank.ts";
import type { Review } from "./review.ts";
import type { Claim } from "../order/wave.ts";

const review = (over: Partial<Review> = {}): Review =>
  ({
    id: "r1",
    claimId: "c1",
    fromId: "x",
    toId: "me-1",
    score: 5,
    dimensions: { punctual: 5, attitude: 5, professional: 5 },
    at: 100,
    ...over,
  }) as Review;

const claim = (over: Partial<Claim> = {}): Claim =>
  ({
    id: "c1",
    waveId: "w1",
    responderId: "me-1",
    status: "accepted",
    rounds: 0,
    createdAt: 100,
    ...over,
  }) as Claim;

test("reviewStats: mean of last window, rounded to 1 decimal", () => {
  const stats = reviewStats(
    [review({ score: 5 }), review({ score: 4 }), review({ score: 3 })],
    "me-1"
  );
  assert.equal(stats.count, 3);
  assert.equal(stats.avg, 4);
  assert.equal(stats.star, 4);
  // only toId matches
  assert.equal(reviewStats([review({ toId: "other" })], "me-1").count, 0);
});

test("reviewStats: unrated responder is 0-star with full completion", () => {
  const s = reviewStats([], "me-1");
  assert.deepEqual(s, { count: 0, avg: 0, star: 0, completion: 1 });
});

test("completionRate: fulfilled vs breached, in-flight excluded", () => {
  const fulfilled = claim({ fulfilledAt: 200 });
  const breached = claim({ status: "breached" });
  const inflight = claim({ id: "c2" });
  assert.equal(
    completionRate([fulfilled, breached, inflight], "me-1"),
    0.5,
    "1 fulfilled / 2 settled"
  );
  assert.equal(completionRate([inflight], "me-1"), 1, "no settled history");
});

test("starWeight: ★≥4 + ≥90% completion earns the match bonus", () => {
  assert.equal(starWeight(4, 0.9), 5);
  assert.equal(starWeight(5, 1), 5);
  assert.equal(starWeight(3, 0.95), 0);
  assert.equal(starWeight(4, 0.8), 0);
});

test("rankLabel renders Airtasker-style dual metrics", () => {
  assert.equal(rankLabel({ count: 0, avg: 0, star: 0, completion: 1 }), "新响应者 · 暂无评价");
  const l = rankLabel({ count: 8, avg: 4.8, star: 5, completion: 0.93 });
  assert.ok(l.includes("★★★★★"), "5 星渲染");
  assert.ok(l.includes("4.8"));
  assert.ok(l.includes("完成率 93%"));
});