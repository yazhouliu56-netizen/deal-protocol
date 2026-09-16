/**
 * Type2 保证金考卷（P3 · 用户裁决 2026-09-16）。
 * 锁：1.2x／6h 线／迟到扣半／爽约锅到场平分／99 池／累犯／守恒。
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  TYPE2_B_TIERS_CENTS,
  TYPE2_CONFIRM_TIMEOUT_MS,
  TYPE2_FREE_CANCEL_MS,
  TYPE2_MEMBER_POOL_CENTS,
  TYPE2_OBJECTION_MS,
  guaranteeForA,
  memberPoolCover,
  settleType2Guarantees,
  type2BreachPolicy,
  type2CancelTier,
  type2ConfirmDeadline,
  type2ObjectionDeadline,
} from "./type2-guarantee.ts";

test("A 类：人均 100 元 × 1.2 = 12000 分；1.0–1.5 可调，越界抛", () => {
  assert.equal(guaranteeForA(10000), 12000);
  assert.equal(guaranteeForA(10000, 1.0), 10000);
  assert.equal(guaranteeForA(10000, 1.5), 15000);
  assert.throws(() => guaranteeForA(10000, 0.9), /INVALID_BUFFER/);
  assert.throws(() => guaranteeForA(10000, 1.6), /INVALID_BUFFER/);
  assert.throws(() => guaranteeForA(0), /INVALID_AMOUNT/);
});

test("取消档：开局 6h 前 free，之后 forfeit（含已开始）", () => {
  const startsAt = 1_000_000_000;
  assert.equal(type2CancelTier(startsAt, startsAt - TYPE2_FREE_CANCEL_MS - 1), "free");
  assert.equal(type2CancelTier(startsAt, startsAt - TYPE2_FREE_CANCEL_MS + 1), "forfeit");
  assert.equal(type2CancelTier(startsAt, startsAt + 60_000), "forfeit");
});

test("结算：4 人各 120，1 人爽约 → 锅 120 到场 3 人平分", () => {
  const r = settleType2Guarantees([
    { userId: "a", frozenCents: 12000, present: true, late: false },
    { userId: "b", frozenCents: 12000, present: true, late: false },
    { userId: "c", frozenCents: 12000, present: true, late: false },
    { userId: "d", frozenCents: 12000, present: false, late: false },
  ]);
  assert.equal(r.potCents, 12000);
  assert.equal(r.unallocatedCents, 0);
  assert.deepEqual(r.refunds, { a: 16000, b: 16000, c: 16000, d: 0 });
});

test("迟到扣半：120 冻 → 退 60，另半进锅", () => {
  const r = settleType2Guarantees([
    { userId: "a", frozenCents: 12000, present: true, late: true },
    { userId: "b", frozenCents: 12000, present: true, late: false },
  ]);
  // 锅 = 6000，2 人平分各 ＋3000
  assert.equal(r.potCents, 6000);
  assert.deepEqual(r.refunds, { a: 9000, b: 15000 });
});

test("除不尽：锅 1 分 2 人分 → 索引序余数，守恒", () => {
  const r = settleType2Guarantees([
    { userId: "a", frozenCents: 100, present: true, late: false },
    { userId: "b", frozenCents: 100, present: true, late: false },
    { userId: "c", frozenCents: 1, present: false, late: false },
  ]);
  assert.equal(r.refunds.a + r.refunds.b + r.refunds.c, 201);
  assert.equal(r.refunds.a - 100 + (r.refunds.b - 100), 1);
});

test("全员爽约：无接收人，锅进 unallocated 无黑洞", () => {
  const r = settleType2Guarantees([
    { userId: "a", frozenCents: 990, present: false, late: false },
    { userId: "b", frozenCents: 990, present: false, late: false },
  ]);
  assert.deepEqual(r.refunds, { a: 0, b: 0 });
  assert.equal(r.unallocatedCents, 1980);
});

test("会员池：99 池 cover 9.9 档，120 元 A 局不够走单笔", () => {
  assert.deepEqual(memberPoolCover(TYPE2_MEMBER_POOL_CENTS, TYPE2_B_TIERS_CENTS[0]), {
    covered: true,
    freezeCents: 990,
  });
  assert.deepEqual(memberPoolCover(TYPE2_MEMBER_POOL_CENTS, 12000), {
    covered: false,
    freezeCents: 0,
  });
});

test("累犯：2 次翻倍，3 次翻倍＋停 7 天", () => {
  assert.deepEqual(type2BreachPolicy(0), { multiplier: 1, suspendDays: 0 });
  assert.deepEqual(type2BreachPolicy(1), { multiplier: 1, suspendDays: 0 });
  assert.deepEqual(type2BreachPolicy(2), { multiplier: 2, suspendDays: 0 });
  assert.deepEqual(type2BreachPolicy(3), { multiplier: 2, suspendDays: 7 });
  assert.deepEqual(type2BreachPolicy(9), { multiplier: 2, suspendDays: 7 });
});

test("窗常量：异议 6h／确认 24h", () => {
  assert.equal(TYPE2_OBJECTION_MS, 6 * 3600_000);
  assert.equal(TYPE2_CONFIRM_TIMEOUT_MS, 24 * 3600_000);
  assert.equal(TYPE2_FREE_CANCEL_MS, 6 * 3600_000);
  assert.equal(type2ObjectionDeadline(1000), 1000 + 6 * 3600_000);
  assert.equal(type2ConfirmDeadline(1000), 1000 + 24 * 3600_000);
});
