import { test } from "node:test";
import assert from "node:assert/strict";
import {
  hashDoc,
  signDoc,
  verifyDoc,
  insure,
  claim,
  type InsurePolicy,
} from "./signInsure.ts";

test("hashDoc is deterministic and stable", () => {
  assert.equal(hashDoc("协议A"), hashDoc("协议A"));
  assert.notEqual(hashDoc("协议A"), hashDoc("协议B"));
  assert.match(hashDoc("x"), /^seal-[0-9a-f]{8}$/);
});

test("signDoc + verifyDoc round-trips and detects tampering", () => {
  const doc = signDoc("内容快照", "me-1", 1000);
  assert.equal(verifyDoc(doc).ok, true);
  assert.ok(verifyDoc(doc).note.includes("me-1"));
  const tampered = { ...doc, content: "内容被改" };
  assert.equal(verifyDoc(tampered).ok, false);
  assert.ok(verifyDoc(tampered).note.includes("篡改"));
});

test("insure issues a policy and is idempotent per wave+holder", () => {
  const first = insure([], "w1", "u1", 5, 50, 1000);
  assert.equal(first.fresh, true);
  assert.ok(first.policy);
  assert.equal(first.policies.length, 1);
  const dup = insure(first.policies, "w1", "u1", 5, 50, 2000);
  assert.equal(dup.fresh, false);
  assert.equal(dup.policies.length, 1);
  // 不同 holder 可分别投保
  const other = insure(first.policies, "w1", "u2", 5, 50, 3000);
  assert.equal(other.fresh, true);
  assert.equal(other.policies.length, 2);
});

test("claim pays out once and is idempotent; unknown policy pays 0", () => {
  const issued = insure([], "w1", "u1", 5, 50, 1000);
  const p = issued.policy!;
  const paid = claim(issued.policies, p.id, 5000);
  assert.equal(paid.payout, 50);
  assert.equal(paid.policies[0].claimed, true);
  const again = claim(paid.policies, p.id, 6000);
  assert.equal(again.payout, 0);
  const missing = claim(issued.policies, "pol-nope", 7000);
  assert.equal(missing.payout, 0);
});

test("claimed policies do not re-insure", () => {
  const issued = insure([], "w1", "u1", 5, 50, 1000) as {
    policies: InsurePolicy[];
  };
  const paid = claim(issued.policies, issued.policies[0].id, 5000);
  const again = insure(paid.policies, "w1", "u1", 5, 50, 8000);
  assert.equal(again.fresh, true); // 已理赔保单不占位 → 允许重新投保（全新保单）
  assert.equal(again.policies.length, 2);
});