/**
 * 评价隐私四件考卷（R2 · 用户裁决 2026-09-16）。
 * 锁：双盲＋k=5＋3~7天抖动＋报复罚则。
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  RETALIATION_SUSPEND_DAYS,
  REVIEW_K_ANONYMITY,
  blindRevealVisible,
  countRetaliationSuspicions,
  isReleasable,
  kGatePassed,
  retaliationPenalty,
  revealAt,
} from "./review-privacy.ts";

const DAY = 24 * 3600_000;
const DEADLINE = 1_000_000_000;

test("双盲：都交互见；一方未交窗到才见，窗内不见", () => {
  assert.equal(blindRevealVisible(true, true, DEADLINE, DEADLINE - 1000), true);
  assert.equal(blindRevealVisible(true, false, DEADLINE, DEADLINE - 1000), false);
  assert.equal(blindRevealVisible(false, true, DEADLINE, DEADLINE - 1000), false);
  assert.equal(blindRevealVisible(true, false, DEADLINE, DEADLINE), true);
});

test("k=5 门：4 条不露明细，5 条放行（单单定位漏洞数学封死）", () => {
  assert.equal(REVIEW_K_ANONYMITY, 5);
  assert.equal(kGatePassed(4), false);
  assert.equal(kGatePassed(5), true);
});

test("随机抖动：3~7 天合法，之外抛；到期才可放", () => {
  assert.equal(revealAt(1000, 3), 1000 + 3 * DAY);
  assert.equal(revealAt(1000, 7), 1000 + 7 * DAY);
  assert.throws(() => revealAt(1000, 2), /INVALID_JITTER/);
  assert.throws(() => revealAt(1000, 8), /INVALID_JITTER/);
  assert.equal(isReleasable(1000 + 3 * DAY, 1000 + 3 * DAY - 1), false);
  assert.equal(isReleasable(1000 + 3 * DAY, 1000 + 3 * DAY), true);
});

test("报复监测：差评后 30 天窗内拒接计数；2=差评权重，3=停 7 天", () => {
  const bad = 5_000_000_000;
  const now = bad + 10 * DAY;
  assert.equal(countRetaliationSuspicions(bad, [bad + DAY, bad + 2 * DAY, bad + 40 * DAY], now), 2);
  assert.equal(countRetaliationSuspicions(bad, [bad - DAY], now), 0);
  assert.deepEqual(retaliationPenalty(1), { suspicions: 1, badReviewEquivalents: 0, suspendDays: 0 });
  assert.deepEqual(retaliationPenalty(2), { suspicions: 2, badReviewEquivalents: 1, suspendDays: 0 });
  assert.deepEqual(retaliationPenalty(3), {
    suspicions: 3,
    badReviewEquivalents: 1,
    suspendDays: RETALIATION_SUSPEND_DAYS,
  });
});
