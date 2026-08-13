import { test } from "node:test";
import assert from "node:assert/strict";
import { checkForgery, checkTextEvidence, withLlmReview } from "./forgery.ts";
import { claim, hashDoc, insure, signDoc, verifyDoc } from "../platform/signInsure.ts";

test("鉴真：无信号 → clean 0 分", () => {
  const r = checkForgery({ noExif: false, oddName: false, reused: false, timeMismatch: false, oddRatio: false });
  assert.equal(r.score, 0);
  assert.equal(r.level, "clean");
});

test("鉴真：复用截图 + 时间矛盾 = 65 高危", () => {
  const r = checkForgery({ noExif: false, oddName: false, reused: true, timeMismatch: true, oddRatio: false });
  assert.equal(r.score, 65);
  assert.equal(r.level, "highly-suspicious");
  assert.ok(r.hits.includes("reused"));
});

test("鉴真：单信号 25 → suspicious", () => {
  const r = checkForgery({ noExif: true, oddName: false, reused: false, timeMismatch: false, oddRatio: false });
  assert.equal(r.level, "suspicious");
});

test("鉴真：文本重复证据 → reused 命中", () => {
  const r = checkTextEvidence(["一模一样", "一模一样", "一模一样"]);
  assert.ok(r.hits.includes("reused"));
  assert.equal(r.score, 35);
});

test("鉴真：LLM 复核降级链", () => {
  const rule = checkForgery({ noExif: true, oddName: false, reused: false, timeMismatch: false, oddRatio: false });
  const noLlm = withLlmReview(rule, null);
  assert.equal(noLlm.score, rule.score);
  const review = withLlmReview(rule, 0.9);
  assert.ok(review.score < rule.score);
});

test("签章：内容→章确定性；篡改验签失败", () => {
  const doc = signDoc("甲乙双方约定：保洁 2 小时 100 元", "u1", 1000);
  assert.equal(hashDoc("甲乙双方约定：保洁 2 小时 100 元"), doc.seal);
  assert.equal(verifyDoc(doc).ok, true);
  const tampered = { ...doc, content: "甲乙双方约定：保洁 1 小时 50 元" };
  assert.equal(verifyDoc(tampered).ok, false);
});

test("保险：投保幂等；理赔一次性", () => {
  let policies: Awaited<ReturnType<typeof insure>>["policies"] = [];
  const r1 = insure(policies, "w1", "u1", 5, 100, 1000);
  policies = r1.policies;
  assert.equal(r1.fresh, true);
  const r2 = insure(policies, "w1", "u1", 5, 100, 2000);
  assert.equal(r2.fresh, false);
  assert.equal(r2.policy?.id, r1.policy?.id);
  const p = r1.policy!;
  const c1 = claim(policies, p.id, 3000);
  assert.equal(c1.payout, 100);
  const c2 = claim(c1.policies, p.id, 4000);
  assert.equal(c2.payout, 0);
});