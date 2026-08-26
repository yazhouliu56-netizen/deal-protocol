/**
 * D-5 Phase E · 协议资产归位 Base 考卷（原 lib/protocol/registry.test.ts 平移转制）：
 * 三协议 ammo 投影契约锁定（注册面 / 7 态 17 转换 / 金额时机与 ammo 一致 /
 * 阶梯退款经 Base calcContractRefund 权威求值）。
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { protocolRegistry, getProtocol, PROTOCOLS } from "./protocol-definitions.ts";
import { calcContractRefund } from "./contract-engine.ts";

test("三协议注册 + base 不对外注册 + PROTOCOLS/getProtocol 契约", () => {
  assert.deepEqual(Object.keys(PROTOCOLS).sort(), [
    "protocol_dating",
    "protocol_housekeeping",
    "protocol_meetup",
  ]);
  assert.equal(getProtocol("protocol_base"), undefined);
  assert.equal(getProtocol("protocol_housekeeping"), PROTOCOLS.protocol_housekeeping);
});

test("housekeeping 投影：7 态 17 转换 + 金额/时机与 ammo 一致", () => {
  const d = protocolRegistry.get("protocol_housekeeping")!;
  assert.deepEqual(
    d.states.map((s) => s.name),
    ["PENDING_HELD", "HELD", "COMPLETED", "DISPUTED", "CANCELLED", "SATISFACTION_HELD", "SETTLED"],
  );
  assert.equal(d.transitions.length, 17);
  assert.equal(d.serviceStages?.length, 6);
  assert.equal(d.funding.fees.platform_commission, 0.15);
  assert.equal(d.funding.fees.satisfaction_hold, 0.1);
  assert.equal(d.completion.autoTimeoutSeconds, 24 * 3600);
  assert.equal(d.refundRules?.length, 6);
  // 退款计算权威在 Base 合同引擎（旧 engine.calcRefund 语义等价）
  assert.deepEqual(calcContractRefund(d, 5, 100), { provider: 50, customer: 50 });
  assert.deepEqual(calcContractRefund(d, 0, 100), { provider: 0, customer: 100 });
});

test("dating 投影：6 态 + commitment + companion 超时 2h", () => {
  const d = protocolRegistry.get("protocol_dating")!;
  assert.deepEqual(
    d.states.map((s) => s.name),
    ["PENDING", "HELD", "COMPLETED", "CANCELLED", "DISPUTED", "SETTLED"],
  );
  assert.equal(d.funding.mode, "commitment");
  assert.equal(d.completion.autoTimeoutSeconds, 2 * 3600);
  assert.match(JSON.stringify(d.refundRules?.[0]), /"stage":0/);
  assert.equal(d.refundRules?.[0].customerGets, "all");
});

test("meetup 投影：6h 超时 + 分账 0.88 → 佣金 0.12", () => {
  const d = protocolRegistry.get("protocol_meetup")!;
  assert.equal(d.completion.autoTimeoutSeconds, 6 * 3600);
  assert.ok(Math.abs(d.funding.fees.platform_commission - 0.12) < 1e-5);
  assert.equal(d.refundRules?.length, 6);
});
