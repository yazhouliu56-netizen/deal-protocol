/**
 * 有效评价券真相源（P2 资金口径 · 用户裁决 2026-09-16）。
 *
 * 六圈定位：第 2 圈业务核心（营销账，绝不动服务者 15%）。
 * 规则锁死：实付 × 3%，2 元保底，10 元封顶，本品类 7 天有效，
 * 每月最多 3 张；只发有效评价——三项全勾 ＋（≥10 字或 1 图）＋
 * 72h 窗内 ＋ 非自动全返；同一对用户 30 天只发 1 次（防刷）。
 * 计数/发券/过期由调用方（adapters/DB）执行，本模块只判资格与算面额。
 *
 * Pure + unit-testable; no runtime imports.
 */

/** 券比例：实付 3%（成本跟 GMV 挂钩，平台营销账）。 */
export const COUPON_RATE = 0.03;
/** 保底 2 元（小单有体感）。 */
export const COUPON_MIN_CENTS = 200;
/** 封顶 10 元（大单贴得起）。 */
export const COUPON_CAP_CENTS = 1000;
/** 有效期 7 天（毫秒，调用方落盘用）。 */
export const COUPON_VALIDITY_MS = 7 * 24 * 3600_000;
/** 每用户每月最多 3 张。 */
export const COUPON_MONTHLY_MAX = 3;
/** 同一对用户 30 天只发 1 次。 */
export const COUPON_PAIR_COOLDOWN_MS = 30 * 24 * 3600_000;
/** 有效评价文字门槛：10 字。 */
export const COUPON_COMMENT_MIN_CHARS = 10;

export type CouponErrorCode = "INVALID_TOTAL";

export class CouponError extends Error {
  readonly code: CouponErrorCode;
  constructor(code: CouponErrorCode, message?: string) {
    super(message ? `[${code}] ${message}` : `[${code}]`);
    this.name = "CouponError";
    this.code = code;
  }
}

/** 面额：round(实付 × 3%)，夹在 [200, 1000] 分内。 */
export function couponAmountFor(totalCents: number): number {
  if (!Number.isInteger(totalCents) || totalCents <= 0) {
    throw new CouponError("INVALID_TOTAL", `实付必须为正整数分，收到 ${totalCents}`);
  }
  const raw = Math.round(totalCents * COUPON_RATE);
  return Math.min(COUPON_CAP_CENTS, Math.max(COUPON_MIN_CENTS, raw));
}

export interface CouponEligibility {
  /** 三项全勾（任一落勾 = 有负向，不发券）。 */
  allChecked: boolean;
  /** 评价正文字符数（去空白后由调用方数好传入）。 */
  commentChars: number;
  /** 是否带图。 */
  hasPhoto: boolean;
  /** 72h 窗内提交（超时自动全返的不算）。 */
  reviewedInWindow: boolean;
  /** 是否为超时自动全返（是则一票否决）。 */
  autoReturned: boolean;
  /** 同一对用户 30 天内已发过（是则一票否决）。 */
  samePairWithin30d: boolean;
}

/** 有效评价才发券（水评/自动返/刷单全部拦掉）。 */
export function isEligibleCouponReview(input: CouponEligibility): boolean {
  if (!input.allChecked) return false;
  if (!(input.commentChars >= COUPON_COMMENT_MIN_CHARS || input.hasPhoto)) return false;
  if (!input.reviewedInWindow) return false;
  if (input.autoReturned) return false;
  if (input.samePairWithin30d) return false;
  return true;
}
