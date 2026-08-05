import { test } from "node:test";
import assert from "node:assert/strict";
import {
  createPayOrder,
  capturePayOrder,
  releasePayOrder,
  decideRefund,
  refundAmount,
  splitNoShow,
} from "./pay.ts";

test("随单支付：unpaid → paid → released 状态链", () => {
  const o = createPayOrder({
    id: "p1",
    waveId: "w1",
    payerId: "u1",
    amount: 150,
  });
  assert.equal(o.status, "unpaid");
  const paid = capturePayOrder(o);
  assert.equal(paid.status, "paid");
  assert.ok(paid.paidAt);
  const released = releasePayOrder(paid, "验收通过放款");
  assert.equal(released.status, "released");
  assert.equal(released.note, "验收通过放款");
});

test("放款/退款只允许在已支付单上操作", () => {
  const unpaid = createPayOrder({
    id: "p2",
    waveId: "w1",
    payerId: "u1",
    amount: 50,
  });
  assert.throws(() => releasePayOrder(unpaid), /pay\.not-paid/);
  assert.throws(
    () => decideRefund(unpaid, { ratio: 1, target: "original", note: "" }),
    /pay\.not-paid/
  );
});

test("退款：全额原路退回 && 差额进钱包", () => {
  const paid = capturePayOrder(
    createPayOrder({ id: "p3", waveId: "w1", payerId: "u1", amount: 100 })
  );
  // 全额原路
  const full = decideRefund(paid, {
    ratio: 1,
    target: "original",
    note: "成团失败全退",
  });
  assert.equal(full.order.status, "refunded");
  assert.equal(refundAmount(paid, full), 100);
  assert.equal(full.target, "original");
  // 7 折进钱包（质量扣费示例）
  const part = decideRefund(paid, {
    ratio: 0.7,
    target: "wallet",
    note: "质量不达标退 70%",
  });
  assert.equal(refundAmount(paid, part), 70);
  assert.equal(part.target, "wallet");
});

test("no-show 爽约金不回退款，摊给在场玩家", () => {
  const noShow = capturePayOrder(
    createPayOrder({ id: "p4", waveId: "w1", payerId: "u2", amount: 80 })
  );
  const perSeat = splitNoShow(noShow, 3); // 补给另外 3 位
  assert.equal(perSeat, 26); // floor(80/3)
  assert.equal(noShow.status, "paid"); // 单子本身不再 refunded
});

test("溢出比例被夹在 0..1", () => {
  const paid = capturePayOrder(
    createPayOrder({ id: "p5", waveId: "w1", payerId: "u1", amount: 60 })
  );
  const over = decideRefund(paid, { ratio: 3, target: "wallet", note: "" });
  assert.equal(refundAmount(paid, over), 60);
});