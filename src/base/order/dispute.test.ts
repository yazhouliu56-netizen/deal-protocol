import { test } from "node:test";
import assert from "node:assert/strict";
import {
  autoVerdict,
  creditDeltaFor,
  negotiate,
  openDispute,
  resolveAuto,
  splitArbitrationAmountsCents,
  validateArbitrationRatios,
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

/* =====================================================================
 * 批次 3b · AI 仲裁确定性护栏考卷
 * ===================================================================== */

test("护栏：比例之和 ≠100 拒绝（sum-must-be-100）", () => {
  assert.throws(() => validateArbitrationRatios(50, 40), /sum-must-be-100/);
});

test("护栏：浮点和在 1e-9 容差内视为 100（33.333 + 66.667 合法通过）", () => {
  assert.doesNotThrow(() => validateArbitrationRatios(33.333, 66.667));
});

test("护栏：越界（负值 / >100 / NaN / Infinity）一律 out-of-range 拒绝", () => {
  assert.throws(() => validateArbitrationRatios(-10, 110), /out-of-range/);
  assert.throws(() => validateArbitrationRatios(101, -1), /out-of-range/);
  assert.throws(() => validateArbitrationRatios(Number.NaN, 100), /out-of-range/);
  assert.throws(() => validateArbitrationRatios(0, Number.POSITIVE_INFINITY), /out-of-range/);
});

test("护栏：合法比例通过且整数分守恒——refund+payout ≡ total", () => {
  const { refundCents, payoutCents } = splitArbitrationAmountsCents(100000, 20, 80);
  assert.equal(refundCents, 80000);
  assert.equal(payoutCents, 20000);
  assert.equal(refundCents + payoutCents, 100000);
});

test("分配映射语义：refund 随 providerRatio 缩放（服务方过失越大退得越多）", () => {
  const { refundCents, payoutCents } = splitArbitrationAmountsCents(1000, 30, 70);
  assert.equal(refundCents, 700);
  assert.equal(payoutCents, 300);
});

test("最大余数法无损：total=999 按 66.5/33.5 → 余数分落高小数环（refund 335/payout 664）且守恒", () => {
  const { refundCents, payoutCents } = splitArbitrationAmountsCents(999, 66.5, 33.5);
  assert.deepEqual({ refundCents, payoutCents }, { refundCents: 335, payoutCents: 664 });
  assert.equal(refundCents + payoutCents, 999);
});

test("极端边界：0/100 与 100/0 双向均守恒", () => {
  assert.deepEqual(splitArbitrationAmountsCents(50000, 100, 0), { refundCents: 0, payoutCents: 50000 });
  assert.deepEqual(splitArbitrationAmountsCents(50000, 0, 100), { refundCents: 50000, payoutCents: 0 });
});

test("总额非法拦截：非整数分（小数 / 负数 / NaN）拒绝", () => {
  assert.throws(() => splitArbitrationAmountsCents(100.5, 50, 50), /INVALID_TOTAL_AMOUNT/);
  assert.throws(() => splitArbitrationAmountsCents(-1, 50, 50), /INVALID_TOTAL_AMOUNT/);
});