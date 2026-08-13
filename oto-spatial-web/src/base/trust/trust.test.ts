import { test } from "node:test";
import assert from "node:assert/strict";
import {
  FREE_CANCEL_MS,
  PARTIAL_RATIO,
  hasUnsettledBreach,
  refundByTier,
  settleGroupFail,
  tierRatio,
} from "./trust.ts";
import { createWave, type Wave } from "../order/wave.ts";
import type { PayOrder } from "../money/pay.ts";

const now = 1_700_000_000_000;

function wave(overrides?: Partial<Wave>): Wave {
  const base: Wave = createWave({
    id: "w1",
    authorId: "me",
    basics: {
      category: "羽毛球",
      time: "周六 14:00",
      area: "体育中心",
      radiusKm: 5,
    },
    budget: 150,
    capacity: 3,
    expiresAt: now + 3600_000,
    createdAt: now,
  });
  return { ...base, ...overrides };
}

function paidOrder(id: string, waveId: string, payerId: string, kind: "seat" | "publish-fee" = "seat"): PayOrder {
  return {
    id,
    waveId,
    payerId,
    amount: 50,
    status: "paid",
    kind,
    createdAt: now,
    paidAt: now,
  };
}

/* ------------------------- ① 成团失败退款 ------------------------- */

test("settleGroupFail: 过期未满员的开放局 → 全部 paid 订单全额退", () => {
  const w = wave({ capacity: 3, expiresAt: now - 1000 });
  const orders = [
    paidOrder("p1", "w1", "me"),
    paidOrder("p2", "w1", "r1"),
    paidOrder("p3", "w1", "r2"),
  ];
  const out = settleGroupFail({ wave: w, orders, now });
  assert.equal(out.settled, true);
  assert.equal(out.refunded.length, 3);
  assert.ok(out.refunded.every((o) => o.status === "refunded"));
  assert.ok(out.refunded.every((o) => o.note?.includes("成团失败")));
  assert.equal(out.refunds["p1"], 50);
  assert.equal(out.refunds["p2"], 50);
});

test("settleGroupFail: 未过期 → 不结算", () => {
  const w = wave({ capacity: 3, expiresAt: now + 3600_000 });
  const out = settleGroupFail({ wave: w, orders: [paidOrder("p1", "w1", "me")], now });
  assert.equal(out.settled, false);
  assert.equal(out.refunded.length, 0);
});

test("settleGroupFail: 1:1 单 / 已成局 / 已关闭 → 不结算", () => {
  const solo = wave({ capacity: 1, expiresAt: now - 1000 });
  assert.equal(settleGroupFail({ wave: solo, orders: [], now }).settled, false);
  const assembled = wave({ capacity: 3, expiresAt: now - 1000, status: "assembled" });
  assert.equal(settleGroupFail({ wave: assembled, orders: [], now }).settled, false);
  const closed = wave({ capacity: 3, expiresAt: now - 1000, status: "closed" });
  assert.equal(settleGroupFail({ wave: closed, orders: [], now }).settled, false);
});

test("settleGroupFail: 只退本局已付单（不含其他局/未付/已退）", () => {
  const w = wave({ expiresAt: now - 1000 });
  const otherWave = paidOrder("p-other", "w9", "r9");
  const unpaid = { ...paidOrder("p-unpaid", "w1", "r1"), status: "unpaid" as const };
  const alreadyRefunded = {
    ...paidOrder("p-ref", "w1", "r1"),
    status: "refunded" as const,
  };
  const mine = paidOrder("p-mine", "w1", "me");
  const out = settleGroupFail({
    wave: w,
    orders: [otherWave, unpaid, alreadyRefunded, mine],
    now,
  });
  assert.equal(out.refunded.length, 1);
  assert.equal(out.refunded[0].id, "p-mine");
});

test("settleGroupFail: 发布费订单不参与成团失败退款（独立不退）", () => {
  const w = wave({ expiresAt: now - 1000 });
  const seat = paidOrder("s1", "w1", "me", "seat");
  const fee = paidOrder("f1", "w1", "me", "publish-fee");
  const out = settleGroupFail({ wave: w, orders: [seat, fee], now });
  assert.equal(out.refunded.length, 1);
  assert.equal(out.refunded[0].id, "s1");
});

/* ------------------------- ② 24h 分级取消 ------------------------- */

test("tierRatio: ≥24h → free 全退", () => {
  const t = tierRatio(now + FREE_CANCEL_MS, now);
  assert.equal(t.tier, "free");
  assert.equal(t.ratio, 1);
});

test("tierRatio: [0,24h) → partial 按比例退", () => {
  const t = tierRatio(now + FREE_CANCEL_MS - 1000, now);
  assert.equal(t.tier, "partial");
  assert.equal(t.ratio, PARTIAL_RATIO);
});

test("tierRatio: 已开始 / 无 startsAt → none 不退", () => {
  assert.equal(tierRatio(now - 1000, now).tier, "none");
  assert.equal(tierRatio(undefined, now).tier, "none");
  assert.equal(tierRatio(undefined, now).ratio, 0);
});

/* ----- refundByTier（B 方案：无 startsAt 老数据按是否成局退） ----- */

test("refundByTier: 无 startsAt 且无人拼位 → 全额退 seat", () => {
  const w = wave({});
  const out = refundByTier({
    waveId: w.id,
    orders: [paidOrder("s1", w.id, "me")],
    startsAt: undefined,
    hasSeats: false,
    now,
  });
  assert.equal(out.refunded.length, 1);
  assert.equal(out.refunds["s1"], 50);
  assert.match(out.refunded[0].note ?? "", /全额退/);
});

test("refundByTier: 无 startsAt 且已成局 → 不退 + 跳过发布费", () => {
  const w = wave({});
  const seat = paidOrder("s", w.id, "me");
  const fee = paidOrder("f", w.id, "me", "publish-fee");
  const out = refundByTier({
    waveId: w.id,
    orders: [seat, fee],
    startsAt: undefined,
    hasSeats: true,
    now,
  });
  assert.equal(out.refunded.length, 0);
  assert.ok(!(fee.id in out.refunds));
});

test("refundByTier: 有 startsAt 走 tierRatio（≥24h 全退）", () => {
  const w = wave({});
  const out = refundByTier({
    waveId: w.id,
    orders: [paidOrder("s", w.id, "me")],
    startsAt: now + FREE_CANCEL_MS,
    hasSeats: true,
    now,
  });
  assert.equal(out.refunds["s"], 50);
});

/* ------------------------- ③ no-show 欠款锁定 ------------------------- */

const mkClaim = (id: string, responderId: string, status: "joined" | "accepted" | "breached", settled?: boolean) => ({
  id,
  waveId: "w1",
  responderId,
  status,
  rounds: 0,
  createdAt: now,
  settled,
});

test("hasUnsettledBreach: breached 且未 settle → 锁定", () => {
  const claims = [mkClaim("c1", "r1", "breached")];
  assert.equal(hasUnsettledBreach(claims, "r1"), true);
  assert.equal(hasUnsettledBreach(claims, "r2"), false);
});

test("hasUnsettledBreach: 已 settle / 未 breached → 不锁定", () => {
  const settled = [mkClaim("c1", "r1", "breached", true)];
  assert.equal(hasUnsettledBreach(settled, "r1"), false);
  const normal = [mkClaim("c2", "r1", "accepted")];
  assert.equal(hasUnsettledBreach(normal, "r1"), false);
});
