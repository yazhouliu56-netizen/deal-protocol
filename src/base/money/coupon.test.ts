/**
 * 有效评价券考卷（P2 资金口径 · 用户裁决 2026-09-16）。
 * 锁：3%＋2 元底 10 元封顶＋有效评价五门。
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  COUPON_CAP_CENTS,
  COUPON_MIN_CENTS,
  couponAmountFor,
  isEligibleCouponReview,
} from "./coupon.ts";

const GOOD = {
  allChecked: true,
  commentChars: 12,
  hasPhoto: false,
  reviewedInWindow: true,
  autoReturned: false,
  samePairWithin30d: false,
};

test("面额：100 元 → 3% = 3 元（区间内实收）", () => {
  assert.equal(couponAmountFor(10000), 300);
});

test("保底：3 元小单 3% 仅 9 分 → 保底 200 分", () => {
  assert.equal(couponAmountFor(300), COUPON_MIN_CENTS);
});

test("封顶：2000 元大单 3% = 60 元 → 封顶 1000 分", () => {
  assert.equal(couponAmountFor(200000), COUPON_CAP_CENTS);
});

test("非法实付 fail-fast", () => {
  assert.throws(() => couponAmountFor(0), /INVALID_TOTAL/);
  assert.throws(() => couponAmountFor(-50), /INVALID_TOTAL/);
  assert.throws(() => couponAmountFor(10.5), /INVALID_TOTAL/);
});

test("资格：真评价放行（10 字以上无图也可）", () => {
  assert.equal(isEligibleCouponReview(GOOD), true);
  assert.equal(isEligibleCouponReview({ ...GOOD, commentChars: 3, hasPhoto: true }), true);
});

test("资格：五门任一不过即拦", () => {
  assert.equal(isEligibleCouponReview({ ...GOOD, allChecked: false }), false);
  assert.equal(isEligibleCouponReview({ ...GOOD, commentChars: 3 }), false);
  assert.equal(isEligibleCouponReview({ ...GOOD, reviewedInWindow: false }), false);
  assert.equal(isEligibleCouponReview({ ...GOOD, autoReturned: true }), false);
  assert.equal(isEligibleCouponReview({ ...GOOD, samePairWithin30d: true }), false);
});
