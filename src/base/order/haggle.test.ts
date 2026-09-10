import { test } from "node:test";
import assert from "node:assert/strict";
import { buildHaggleOptions, canHaggle, claimToHaggleCard, describeFairness, meanOfQuotes, sanitizePolishDraft } from "./haggle.ts";

test("均值口径：过滤无效报价，无报价回落null", () => {
  assert.equal(meanOfQuotes([150, 130, 170]), 150);
  assert.equal(meanOfQuotes([150, undefined, -5, NaN]), 150);
  assert.equal(meanOfQuotes([]), null);
  assert.equal(meanOfQuotes([undefined]), null);
});

test("超均值20%警示触发", () => {
  assert.equal(describeFairness(150, 100).warn, true);
  assert.equal(describeFairness(120, 100).warn, false);
  assert.equal(describeFairness(150, null).warn, false);
});

test("三档发送链：价格单调不增＋守底取均值", () => {
  const opts = buildHaggleOptions(150, 130, 200);
  assert.equal(opts.map((o) => o.tier).join(","), "quick,small,hold");
  assert.deepEqual(opts.map((o) => o.priceYuan), [150, 143, 130]);
  const noMean = buildHaggleOptions(150, null, 200);
  assert.equal(noMean[2].priceYuan, 200);
});

test("3轮上限", () => {
  assert.equal(canHaggle(0), true);
  assert.equal(canHaggle(2), true);
  assert.equal(canHaggle(3), false);
});

test("润话术输入清洗", () => {
  assert.equal(sanitizePolishDraft("  便宜点 "), "便宜点");
  assert.equal(sanitizePolishDraft("```便宜点```"), "便宜点");
  assert.equal(sanitizePolishDraft("   "), null);
  assert.equal(sanitizePolishDraft(123), null);
  assert.equal(sanitizePolishDraft("x".repeat(200))?.length, 120);
});

test("T2: 仅改价产确认卡", () => {  const wave = { id: "w1", budget: 150, basics: { time: "明晚", category: "保洁" } };
  const card = claimToHaggleCard({ id: "c1", price: 130, responderId: "resp-abc123" }, wave, 1000);
  assert.ok(card);
  assert.equal(card.state, "ready");
  assert.equal(card.price.totalYuan, 130);
  assert.match(card.traceId, /intent-haggle-c1/);
  assert.equal(claimToHaggleCard({ id: "c1", price: 150, responderId: "r" }, wave, 1000), null);
  assert.equal(claimToHaggleCard({ id: "c1", responderId: "r" }, wave, 1000), null);
});
