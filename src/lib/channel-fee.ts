/**
 * 通道费纯核（P8 · 用户裁决 2026-09-18：平台零垫付，代通道收取，如实明示）。
 *
 * 收款通道费 = 显示金额 × 通道费率（webhook 记账＋结算方程传值）；
 * 提现通道费 = 从到账扣（ALIPAY 按费率，BANK 按单笔固定费；微信提现同逻辑）。
 *
 * Pure + unit-testable.
 */

export type ReceiveChannel = "stripe" | "alipay" | "wechat";
export type WithdrawMethod = "ALIPAY" | "BANK";

export interface ChannelRates {
  wechat: number;
  alipay: number;
  stripe: number;
}

/** 收款通道费（元，2 位；未知通道回落 0 并由调用方告警）。 */
export function receiveChannelFee(
  channel: string,
  amountYuan: number,
  rates: ChannelRates,
): { fee: number; rate: number } {
  const rate =
    channel === "stripe" ? rates.stripe
    : channel === "alipay" ? rates.alipay
    : channel === "wechat" ? rates.wechat
    : NaN;
  if (!Number.isFinite(rate) || rate < 0 || rate > 1) return { fee: 0, rate: 0 };
  const amount = Number.isFinite(amountYuan) && amountYuan > 0 ? amountYuan : 0;
  return { fee: Math.round(amount * rate * 100) / 100, rate };
}

/** 提现通道费（元，2 位；ALIPAY 按费率，BANK 按单笔固定费）。 */
export function withdrawFee(
  method: string,
  amountYuan: number,
  alipayRate: number,
  bankFlat: number,
): { fee: number; net: number; desc: string } {
  const amount = Number.isFinite(amountYuan) && amountYuan > 0 ? amountYuan : 0;
  if (method === "BANK") {
    const fee = Math.min(Math.max(0, Number(bankFlat) || 0), amount);
    return { fee, net: Math.round((amount - fee) * 100) / 100, desc: `银行卡转账固定¥${fee}` };
  }
  const rate = Number.isFinite(alipayRate) && alipayRate >= 0 ? alipayRate : 0;
  const fee = Math.round(amount * rate * 100) / 100;
  return { fee, net: Math.round((amount - fee) * 100) / 100, desc: `支付宝通道${(rate * 100).toFixed(1)}%代收` };
}
