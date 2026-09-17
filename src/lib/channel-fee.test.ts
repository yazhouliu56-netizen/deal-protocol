import { describe, it, expect } from "vitest";
import { receiveChannelFee, withdrawFee } from "./channel-fee";

const RATES = { wechat: 0.006, alipay: 0.006, stripe: 0.029 };

describe("P8 通道费纯核（平台零垫付）", () => {
  it("收款：300 元支付宝 0.6% = 1.8", () => {
    expect(receiveChannelFee("alipay", 300, RATES)).toEqual({ fee: 1.8, rate: 0.006 });
  });

  it("收款：未知通道回落 0", () => {
    expect(receiveChannelFee("paypal", 300, RATES)).toEqual({ fee: 0, rate: 0 });
  });

  it("提现：支付宝 100 元 0.6% = 0.6，到账 99.4（从到账扣）", () => {
    const r = withdrawFee("ALIPAY", 100, 0.006, 2);
    expect(r.fee).toBe(0.6);
    expect(r.net).toBe(99.4);
  });

  it("提现：银行卡固定 2 元/笔，到账 98", () => {
    const r = withdrawFee("BANK", 100, 0.006, 2);
    expect(r.fee).toBe(2);
    expect(r.net).toBe(98);
  });

  it("提现：金额小于固定费时 fee 钳制不超本金", () => {
    const r = withdrawFee("BANK", 1, 0.006, 2);
    expect(r.fee).toBe(1);
    expect(r.net).toBe(0);
  });
});
