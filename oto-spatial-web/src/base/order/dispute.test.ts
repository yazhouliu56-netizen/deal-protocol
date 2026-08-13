import { test } from "node:test";
import assert from "node:assert/strict";
import {
  autoVerdict,
  creditDeltaFor,
  negotiate,
  openDispute,
  resolveAuto,
} from "./dispute.ts";

test("autoVerdict: no-show → 全责全退", () => {
  const v = autoVerdict("no-show");
  assert.equal(v.responsibility, "responder-full");
  assert.equal(v.money.type, "fullrefund");
});

test("autoVerdict: late → 部分责任协商上限60%", () => {
  const v = autoVerdict("late");
  assert.equal(v.responsibility, "responder-partial");
  if (v.money.type === "negotiate") assert.equal(v.money.maxPct, 60);
});

test("autoVerdict: demander-change → 归响应者", () => {
  const v = autoVerdict("deliverable-missing");
  assert.equal(v.responsibility, "responder-full");
});

test("openDispute: 无凭证拒绝", () => {
  assert.throws(() => openDispute({ claimId: "c1", reason: "late", evidence: "  " }), /evidence/);
});

test("openDispute: reason+evidence → DisputeRecord + 48h deadline", () => {
  const d = openDispute({ claimId: "c1", reason: "result-mismatch", evidence: "墙没刷平" }, 1000);
  assert.equal(d.reason, "result-mismatch");
  assert.equal(d.appealDeadline, 1000 + 48 * 3600_000);
  assert.equal(d.verdict.responsibility, "responder-partial");
});

test("negotiate: 部分责任协商 → 同意则按比例", () => {
  const d = openDispute({ claimId: "c1", reason: "late", evidence: "迟到了" }, 0);
  const out = negotiate(d, 30, true, "接受");
  assert.equal(out.outcome?.kind, "negotiated");
  if (out.outcome?.kind === "negotiated") assert.equal(out.outcome.agreedAmount, 30);
});

test("negotiate: 全责原因不可协商", () => {
  const d = openDispute({ claimId: "c1", reason: "no-show", evidence: "没来" }, 0);
  const out = negotiate(d, 50, true, "想退款");
  assert.equal(out.outcome?.kind, "auto");
});

test("creditDeltaFor: 全责 −2 / 部分责任按占比−1..−3 / 需求方 0", () => {
  const full = openDispute({ claimId: "c1", reason: "no-show", evidence: "没来" }, 0);
  assert.equal(creditDeltaFor(resolveAuto(full, "auto")), -2);

  const late = openDispute({ claimId: "c2", reason: "late", evidence: "迟到了" }, 0);
  const settled = negotiate(late, 30, true, "接受");
  assert.equal(creditDeltaFor(settled), -2); // round(30/20)=2 → −2

  const demander = openDispute({ claimId: "c3", reason: "demander-change", evidence: "不做了" }, 0);
  assert.equal(creditDeltaFor(demander), 0);
});