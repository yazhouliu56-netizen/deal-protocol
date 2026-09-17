/**
 * Type1 结算真相源考卷（P0 治本收敛 · 用户裁决 2026-09-16）。
 * 锁：守恒方程 providerNet + qualityFee + channelFee ≡ total（全组合 fuzz）+
 * 默认全返 + 三勾等权 + 通道费 + 窗常量跨锁 review.ts。
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  TYPE1_CONFIRM_TIMEOUT_MS,
  TYPE1_REVIEW_WINDOW_MS,
  qualityHoldCents,
  satisfactionReleaseDue,
  settleType1,
  splitType1Shares,
  type1ConfirmDeadline,
  type1ReviewDeadline,
} from "./type1-settlement.ts";
import { REVIEW_WINDOW_MS } from "../trust/review.ts";

const ALL = { attitude: true, appearance: true, restoration: true };

function assertConservation(
  total: number,
  pass: { attitude: boolean; appearance: boolean; restoration: boolean } | null,
  fee: number,
): void {
  const r = settleType1(total, pass, fee);
  assert.equal(r.providerNetCents + r.qualityFeeCents + r.channelFeeCents, total);
}

test("整百金额：全勾全返，通道费从服务者侧扣除", () => {
  const r = settleType1(10000, ALL, 60);
  assert.deepEqual(
    [r.baseCents, r.holdReleasedCents, r.qualityFeeCents],
    [8500, 1500, 0],
  );
  assert.equal(r.providerNetCents, 9940);
});

test("等权：每落一勾扣 5% 总额（10000 单落一勾扣 500）", () => {
  const r = settleType1(10000, { ...ALL, attitude: false }, 0);
  assert.equal(r.holdReleasedCents, 1000);
  assert.equal(r.qualityFeeCents, 500);
  assert.equal(r.providerNetCents, 9500);
});

test("零勾：15% 全进质量管理费", () => {
  const r = settleType1(10000, { attitude: false, appearance: false, restoration: false }, 0);
  assert.equal(r.holdReleasedCents, 0);
  assert.equal(r.qualityFeeCents, 1500);
  assert.equal(r.providerNetCents, 8500);
});

test("窗内无评价（null）= 默认全返", () => {
  const r = settleType1(10000, null, 0);
  assert.equal(r.holdReleasedCents, 1500);
  assert.equal(r.qualityFeeCents, 0);
  assert.equal(r.providerNetCents, 10000);
});

test("1 分极端：最大余数法仍守恒（base 得 1，勾份额 0）", () => {
  const s = splitType1Shares(1);
  assert.equal(s.baseCents + s.attitudeCents + s.appearanceCents + s.restorationCents, 1);
  assertConservation(1, ALL, 0);
  assertConservation(1, null, 0);
});

test("非整百金额全组合 fuzz 守恒", () => {
  const totals = [3, 7, 99, 101, 333, 999, 12345, 99999];
  const passes = [
    ALL,
    { ...ALL, attitude: false },
    { ...ALL, appearance: false },
    { ...ALL, restoration: false },
    { attitude: false, appearance: false, restoration: false },
    null,
  ];
  for (const total of totals) {
    for (const pass of passes) {
      assertConservation(total, pass, 0);
      assertConservation(total, pass, 1);
    }
  }
});

test("非法输入 fail-fast：总额非正整数 / 通道费为负 / 通道费超毛额", () => {
  assert.throws(() => settleType1(0, ALL), /INVALID_TOTAL/);
  assert.throws(() => settleType1(-100, ALL), /INVALID_TOTAL/);
  assert.throws(() => settleType1(10.5, ALL), /INVALID_TOTAL/);
  assert.throws(() => settleType1(100, ALL, -1), /INVALID_CHANNEL_FEE/);
  // 总额 1 分毛额 1 分，通道费 2 分超毛额 → 拒绝
  assert.throws(() => settleType1(1, ALL, 2), /INVALID_CHANNEL_FEE/);
});

test("窗常量：确认 24h / 评价 72h 且与 review.ts 同值跨锁", () => {
  assert.equal(TYPE1_CONFIRM_TIMEOUT_MS, 24 * 3600_000);
  assert.equal(TYPE1_REVIEW_WINDOW_MS, 72 * 3600_000);
  assert.equal(TYPE1_REVIEW_WINDOW_MS, REVIEW_WINDOW_MS);
  assert.equal(type1ConfirmDeadline(1000), 1000 + 24 * 3600_000);
  assert.equal(type1ReviewDeadline(2000), 2000 + 72 * 3600_000);
});

test("差分锁定：qualityHoldCents = 标准四舍五入（2026-09-17 委托单源）", () => {
  // 整数神谕：round_half_up(cents*p/q) = floor((2*cents*p + q) / (2*q))，零浮点
  const oracle = (cents: number, p: number, q: number) =>
    Math.floor((2 * cents * p + q) / (2 * q));
  const legacy = (amountYuan: number, rate: number) =>
    Math.round(amountYuan * rate * 100) / 100;
  const wired = (amountYuan: number, rate: number) =>
    qualityHoldCents(Math.round(amountYuan * 100), rate) / 100;
  const cases: [number, number][] = [
    [1, 10],
    [3, 20],
  ]; // [p, q] = 0.10 / 0.15
  for (const [p, q] of cases) {
    const rate = p / q;
    let legacyDrifts = 0;
    for (let cents = 1; cents <= 500000; cents++) {
      const yuan = cents / 100;
      // 新口径恒等于整数神谕（含半分位向上）
      assert.equal(qualityHoldCents(cents, rate), oracle(cents, p, q), `cents=${cents}`);
      // 老公式只允许在精确半分位（真值恰 x.xx5）差 1 分：错→对修正
      const l = legacy(yuan, rate);
      const w = wired(yuan, rate);
      if (l !== w) {
        legacyDrifts += 1;
        assert.equal((2 * cents * p) % (2 * q), q, `漂移须在精确半分位 cents=${cents}`);
        assert.equal(w, (Math.floor((2 * cents * p) / (2 * q)) + 1) / 100);
      }
    }
    assert.ok(legacyDrifts > 0, "老公式半分位尘埃须被复现（否则本断言空转）");
  }
  // 经典浮点陷阱位：新口径给正确值
  assert.equal(qualityHoldCents(35, 0.1), 4); // ¥0.35×10% = 3.5分 → 4分
  assert.equal(qualityHoldCents(150, 0.15), 23); // ¥1.50×15% = 22.5分 → 23分
});

test("单单释放到期：held_at+72h 到即释，未到不释，非法时钟不释（R5）", () => {
  const held = 1_000_000;
  assert.equal(satisfactionReleaseDue(held, held + 72 * 3600_000), true); // 恰 72h 整算到期
  assert.equal(satisfactionReleaseDue(held, held + 72 * 3600_000 - 1), false);
  assert.equal(satisfactionReleaseDue(held, held + 30 * 24 * 3600_000), true); // 旧批 30 天线早已过
  assert.equal(satisfactionReleaseDue(NaN, held), false); // 无 held_at（老脏行）不释
  assert.equal(satisfactionReleaseDue(held, NaN), false);
});
