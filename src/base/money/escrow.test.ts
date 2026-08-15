/**
 * L2-M4 资金引擎深水区收敛 · escrow 统一托管引擎测试：
 * 六模式托管冻结 → 三阶段阶梯退款与违约罚金 → AA 多方分账 →
 * 资金安全底线防御 → AmmoRunner 五态资金挂接（四大弹药 MATCHED 托管校验 /
 * SETTLED 清结算对账清单装配）。
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  BREACH_PENALTY_RATE,
  DEFAULT_DEPOSIT_RATE,
  DEFAULT_PLATFORM_RATE,
  ESCROW_MODES,
  SPLIT_RETRY_LADDER_MINUTES,
  SPLIT_RETRY_MAX_ATTEMPTS,
  calculateEscrowHold,
  calculateMultiPartySplit,
  calculateProviderSettlement,
  calculateSplitRetrySchedule,
  calculateTieredRefund,
  generateComplianceSplitInstruction,
  verifyFundSafetyGuard,
} from "./escrow.ts";
import {
  advanceLifecycle,
  buildSettlementLedger,
} from "../ammo/runner.ts";
import { housekeepingAmmo } from "../../ammo/housekeeping.ammo.ts";
import { meetupAmmo } from "../../ammo/meetup.ammo.ts";
import { companionAmmo } from "../../ammo/companion.ammo.ts";
import { DEFAULT_AMMO } from "../../ammo/registry.ts";

/* =====================================================================
 * 1. 六模式托管金额与保证金冻结计算
 * ===================================================================== */

test("六模式托管矩阵：full_prepay 全款托管（held = 全款，payable = 0）", () => {
  const r = calculateEscrowHold(500, ESCROW_MODES.full_prepay);
  assert.deepEqual(r, { totalAmount: 500, heldDeposit: 500, payableAmount: 0 });
});

test("六模式托管矩阵：deposit_only 保证金冻结（默认 0.3）", () => {
  const r = calculateEscrowHold(500, ESCROW_MODES.deposit_only);
  assert.deepEqual(r, { totalAmount: 500, heldDeposit: 150, payableAmount: 350 });
  assert.equal(DEFAULT_DEPOSIT_RATE, 0.3);
});

test("六模式托管矩阵：commitment 承诺金 / milestone / split 全托管 / pay_later 与 none 不托管", () => {
  assert.deepEqual(calculateEscrowHold(500, ESCROW_MODES.commitment), {
    totalAmount: 500,
    heldDeposit: 25,
    payableAmount: 475,
  });
  assert.deepEqual(calculateEscrowHold(500, ESCROW_MODES.milestone_staged), {
    totalAmount: 500,
    heldDeposit: 500,
    payableAmount: 0,
  });
  assert.deepEqual(calculateEscrowHold(500, ESCROW_MODES.split_revenue), {
    totalAmount: 500,
    heldDeposit: 500,
    payableAmount: 0,
  });
  assert.deepEqual(calculateEscrowHold(500, ESCROW_MODES.pay_later), {
    totalAmount: 500,
    heldDeposit: 0,
    payableAmount: 500,
  });
  assert.deepEqual(calculateEscrowHold(500, ESCROW_MODES.none), {
    totalAmount: 500,
    heldDeposit: 0,
    payableAmount: 500,
  });
});

test("托管默认语义：未传 rate 按全款托管（m13 full_prepay 缺省）", () => {
  assert.deepEqual(calculateEscrowHold(328), {
    totalAmount: 328,
    heldDeposit: 328,
    payableAmount: 0,
  });
});

test("托管精度：两位小数四舍五入", () => {
  assert.deepEqual(calculateEscrowHold(99.99, 0.3), {
    totalAmount: 99.99,
    heldDeposit: 30,
    payableAmount: 69.99,
  });
});

/* =====================================================================
 * 2. 三阶段退款与违约罚金分配
 * ===================================================================== */

test("服务前（ratio 0）：需求方全退，provider 0，平台不抽成", () => {
  const r = calculateTieredRefund(500, 0, false);
  assert.deepEqual(r, { refundToDemander: 500, payToProvider: 0, platformFee: 0 });
});

test("服务后（ratio 1）：provider 全得（扣平台 10% 抽成）", () => {
  const r = calculateTieredRefund(500, 1, false);
  assert.deepEqual(r, { refundToDemander: 0, payToProvider: 450, platformFee: 50 });
});

test("服务中（ratio 0.4）：按完成比例分配，平台按同比例抽成", () => {
  const r = calculateTieredRefund(500, 0.4, false);
  assert.deepEqual(r, {
    refundToDemander: 288,
    payToProvider: 192,
    platformFee: 20,
  });
});

test("守恒律：三阶段任一 ratio 下 refund + pay + fee ≡ total（浮点容差 0.01）", () => {
  for (const ratio of [0, 0.1, 0.3, 0.5, 0.7, 1]) {
    const r = calculateTieredRefund(777, ratio, false);
    const sum = r.refundToDemander + r.payToProvider + r.platformFee;
    assert.ok(Math.abs(sum - 777) < 0.01, `ratio=${ratio} sum=${sum}`);
  }
});

test("违约罚金：provider 应得部分扣 20%，罚金归需求方抵扣（守恒）", () => {
  const normal = calculateTieredRefund(500, 1, false);
  const breached = calculateTieredRefund(500, 1, true);
  assert.equal(breached.payToProvider, 360);
  assert.equal(
    breached.payToProvider,
    Math.round(normal.payToProvider * (1 - BREACH_PENALTY_RATE) * 100) / 100,
  );
  assert.equal(breached.refundToDemander + breached.payToProvider + breached.platformFee, 500);
  assert.equal(BREACH_PENALTY_RATE, 0.2);
});

test("退款防御：ratio 越界钳制到 [0,1]，脏金额归 0", () => {
  assert.deepEqual(calculateTieredRefund(100, -0.5, false), {
    refundToDemander: 100,
    payToProvider: 0,
    platformFee: 0,
  });
  assert.deepEqual(calculateTieredRefund(100, 3, false), {
    refundToDemander: 0,
    payToProvider: 90,
    platformFee: 10,
  });
  assert.deepEqual(calculateTieredRefund(-50, 0.5, false), {
    refundToDemander: 0,
    payToProvider: 0,
    platformFee: 0,
  });
});

/* =====================================================================
 * 3. AA 组局人均分账与平台抽成
 * ===================================================================== */

test("AA 分账：3 人组局 ¥240 → 人均 80，平台 24，场地方净得 216", () => {
  const r = calculateMultiPartySplit(240, DEFAULT_PLATFORM_RATE, 3);
  assert.deepEqual(r, { perSeatCost: 80, platformIncome: 24, providerIncome: 216 });
});

test("AA 分账：除不尽人均按两位小数取整（人均 × 人数 ≈ 总额）", () => {
  const r = calculateMultiPartySplit(100, 0, 3);
  assert.equal(r.perSeatCost, 33.33);
  assert.equal(r.providerIncome, 100);
  assert.ok(Math.abs(r.perSeatCost * 3 - 100) < 0.02);
});

test("AA 分账防御：participants 非法（0/负数/小数）回退 1", () => {
  assert.deepEqual(calculateMultiPartySplit(100, 0.1, 0), {
    perSeatCost: 100,
    platformIncome: 10,
    providerIncome: 90,
  });
  assert.deepEqual(calculateMultiPartySplit(100, 0.1, 2.5), {
    perSeatCost: 100,
    platformIncome: 10,
    providerIncome: 90,
  });
});

test("平台抽成率钳制：负数归 0，超 1 压到 1", () => {
  assert.equal(calculateMultiPartySplit(100, -0.2, 1).platformIncome, 0);
  assert.equal(calculateMultiPartySplit(100, 2, 1).platformIncome, 100);
});

/* =====================================================================
 * 4. 资金安全底线与防御断言
 * ===================================================================== */

test("资金安全底线：余额充足放行 / 不足拦截 / 负数与 NaN 拦截", () => {
  assert.equal(verifyFundSafetyGuard(200, 150), true);
  assert.equal(verifyFundSafetyGuard(149.99, 150), false);
  assert.equal(verifyFundSafetyGuard(-1, 0), false);
  assert.equal(verifyFundSafetyGuard(100, -5), false);
  assert.equal(verifyFundSafetyGuard(NaN, 50), false);
  assert.equal(verifyFundSafetyGuard(100, NaN), false);
});

test("负数/NaN 托管输入防御：一律归 0 不抛异常", () => {
  assert.deepEqual(calculateEscrowHold(-100, 0.3), {
    totalAmount: 0,
    heldDeposit: 0,
    payableAmount: 0,
  });
  assert.deepEqual(calculateEscrowHold(NaN, 0.3), {
    totalAmount: 0,
    heldDeposit: 0,
    payableAmount: 0,
  });
  assert.deepEqual(calculateEscrowHold(100, NaN), {
    totalAmount: 100,
    heldDeposit: 0,
    payableAmount: 100,
  });
});

/* =====================================================================
 * 5. 单提供者结算放款（api/payment/release 收敛语义）
 * ===================================================================== */

test("release 收敛：¥500 → 平台抽 50，provider 净得 450（与路由原内联一致）", () => {
  const r = calculateProviderSettlement(500);
  assert.deepEqual(r, { platformFee: 50, providerNet: 450 });
});

test("release 收敛：零金额与自定义抽成率", () => {
  assert.deepEqual(calculateProviderSettlement(0), { platformFee: 0, providerNet: 0 });
  assert.deepEqual(calculateProviderSettlement(1000, 0.05), {
    platformFee: 50,
    providerNet: 950,
  });
});

/* =====================================================================
 * 5.1 分账指数退避重试调度（微信/银行分账通道）
 * ===================================================================== */

test("重试阶梯：1~5 次延时分别为 1/5/15/60/120 分钟且未放弃", () => {
  const expected = [1, 5, 15, 60, 120];
  for (let retryCount = 1; retryCount <= SPLIT_RETRY_MAX_ATTEMPTS; retryCount += 1) {
    const s = calculateSplitRetrySchedule(retryCount, 1_700_000_000_000);
    assert.equal(s.retryCount, retryCount);
    assert.equal(s.delayMinutes, expected[retryCount - 1]);
    assert.equal(s.shouldAbandon, false);
    assert.equal(s.isP0AlertTriggered, false);
  }
  assert.deepEqual([...SPLIT_RETRY_LADDER_MINUTES], expected);
  assert.equal(SPLIT_RETRY_MAX_ATTEMPTS, 5);
});

test("重试时刻：nextRetryAt = now + delayMinutes × 60 × 1000", () => {
  const now = 1_700_000_000_000;
  const s = calculateSplitRetrySchedule(3, now);
  assert.equal(s.nextRetryAt, now + 15 * 60 * 1000);
  const first = calculateSplitRetrySchedule(1, now);
  assert.equal(first.nextRetryAt, now + 60 * 1000);
  const fifth = calculateSplitRetrySchedule(5, now);
  assert.equal(fifth.nextRetryAt, now + 120 * 60 * 1000);
});

test("第 6 次重试：放弃重试 + 触发 P0 财务严重告警（delayMinutes 归 0）", () => {
  const s = calculateSplitRetrySchedule(6, 1_700_000_000_000);
  assert.equal(s.shouldAbandon, true);
  assert.equal(s.isP0AlertTriggered, true);
  assert.equal(s.delayMinutes, 0);
  assert.equal(s.nextRetryAt, 1_700_000_000_000);
});

test("超上限重试：第 99 次同样放弃 + P0 告警（不无限重试）", () => {
  const s = calculateSplitRetrySchedule(99, 42);
  assert.equal(s.shouldAbandon, true);
  assert.equal(s.isP0AlertTriggered, true);
  assert.equal(s.retryCount, 99);
});

test("重试防御：retryCount 非法（0/负数/NaN/小数）钳制为第 1 次重试", () => {
  for (const bad of [0, -3, NaN, 2.5]) {
    const s = calculateSplitRetrySchedule(bad, 1_700_000_000_000);
    assert.equal(s.retryCount, 1);
    assert.equal(s.delayMinutes, 1);
    assert.equal(s.shouldAbandon, false);
  }
});

test("重试时刻防御：nowTimestamp 非法回退 Date.now()（恒有有限时刻）", () => {
  const s = calculateSplitRetrySchedule(2, NaN);
  assert.equal(Number.isFinite(s.nextRetryAt), true);
  assert.ok(s.nextRetryAt > 0);
});

/* =====================================================================
 * 6. AmmoRunner 五态资金挂接（L2-M4 → 状态机闭环）
 * ===================================================================== */

test("MATCHED 托管校验：全款托管载荷装配进 afterData", async () => {
  const r = await advanceLifecycle({
    ammo: housekeepingAmmo,
    orderId: "esc-1",
    from: "PUBLISHED",
    to: "MATCHED",
    payload: { escrowPayload: { amount: 500, depositRate: 0.3 } },
  });
  assert.equal(r.ok, true);
  assert.equal(r.state, "MATCHED");
  const escrow = r.afterData[r.afterData.length - 1] as {
    escrow?: { totalAmount: number; heldDeposit: number; payableAmount: number };
  };
  assert.deepEqual(escrow.escrow, { totalAmount: 500, heldDeposit: 150, payableAmount: 350 });
});

test("MATCHED 托管校验：余额不足 → BLOCK 回退并报资金安全底线", async () => {
  const r = await advanceLifecycle({
    ammo: companionAmmo,
    orderId: "esc-2",
    from: "PUBLISHED",
    to: "MATCHED",
    payload: { escrowPayload: { amount: 500, depositRate: 1, balance: 300 } },
  });
  assert.equal(r.ok, false);
  assert.equal(r.state, "PUBLISHED");
  assert.ok(r.reason?.includes("escrow-fund-safety-guard"));
});

test("MATCHED 托管校验：非法金额 → BLOCK（负数不得流入资金链）", async () => {
  const r = await advanceLifecycle({
    ammo: meetupAmmo,
    orderId: "esc-3",
    from: "PUBLISHED",
    to: "MATCHED",
    payload: { escrowPayload: { amount: -50 } },
  });
  assert.equal(r.ok, false);
  assert.equal(r.state, "PUBLISHED");
  assert.ok(r.reason?.includes("escrow-hold-invalid"));
});

test("SETTLED 清结算：家政（HOURLY 单方）正常放款对账清单", async () => {
  const r = await advanceLifecycle({
    ammo: housekeepingAmmo,
    orderId: "esc-4",
    from: "INSPECTED",
    to: "SETTLED",
    payload: {
      escrowPayload: { amount: 300, depositRate: 1 },
      photos: { before: ["a.jpg"], after: ["b.jpg"] },
    },
  });
  assert.equal(r.ok, true);
  assert.equal(r.state, "SETTLED");
  const ledger = r.afterData[r.afterData.length - 1] as {
    settlementLedger?: { ammoId: string; providerIncome: number; platformIncome: number };
  };
  assert.equal(ledger.settlementLedger?.ammoId, "housekeeping-v1");
  assert.equal(ledger.settlementLedger?.providerIncome, 270);
  assert.equal(ledger.settlementLedger?.platformIncome, 30);
});

test("SETTLED 清结算：组局（PER_SEAT AA 3 人）人均分账对账清单", async () => {
  const r = await advanceLifecycle({
    ammo: meetupAmmo,
    orderId: "esc-5",
    from: "INSPECTED",
    to: "SETTLED",
    payload: {
      escrowPayload: { amount: 240, depositRate: 0.3, participants: 3 },
      settlement: { venueCostYuan: 180, seats: [{ userId: "u1", paidYuan: 80, present: true }] },
    },
  });
  assert.equal(r.ok, true);
  const ledger = r.afterData[r.afterData.length - 1] as {
    settlementLedger?: { split: { perSeatCost: number }; providerIncome: number };
  };
  assert.equal(ledger.settlementLedger?.split?.perSeatCost, 80);
  assert.equal(ledger.settlementLedger?.providerIncome, 216);
});

test("SETTLED 清结算：陪玩（BREACH 违约终止）阶梯退款对账清单", async () => {
  const r = await advanceLifecycle({
    ammo: companionAmmo,
    orderId: "esc-6",
    from: "IN_SERVICE",
    to: "SETTLED",
    termination: { kind: "BREACH_SETTLED" },
    payload: {
      escrowPayload: { amount: 500, depositRate: 0.3, refund: { elapsedRatio: 0.5, isBreach: true } },
    },
  });
  assert.equal(r.ok, true);
  assert.equal(r.state, "SETTLED");
  const ledger = r.afterData[r.afterData.length - 1] as {
    settlementLedger?: {
      refund: { refundToDemander: number; payToProvider: number; platformFee: number };
    };
  };
  const refund = ledger.settlementLedger?.refund;
  assert.ok(refund);
  assert.equal(refund.refundToDemander + refund.payToProvider + refund.platformFee, 500);
});

test("SETTLED 清结算：默认弹药（FIXED 零防护）同样产出对账清单", async () => {
  const r = await advanceLifecycle({
    ammo: DEFAULT_AMMO,
    orderId: "esc-7",
    from: "INSPECTED",
    to: "SETTLED",
    payload: { escrowPayload: { amount: 120, depositRate: 1 } },
  });
  assert.equal(r.ok, true);
  const ledger = r.afterData[r.afterData.length - 1] as {
    settlementLedger?: { ammoId: string; providerIncome: number; demanderRefund: number };
  };
  assert.equal(ledger.settlementLedger?.ammoId, "default-ammo");
  assert.equal(ledger.settlementLedger?.providerIncome, 108);
  assert.equal(ledger.settlementLedger?.demanderRefund, 0);
});

test("零 escrowPayload 完全透传：既有跃迁行为不变（无对账清单装配）", async () => {
  const r = await advanceLifecycle({
    ammo: housekeepingAmmo,
    orderId: "esc-8",
    from: "INSPECTED",
    to: "SETTLED",
  });
  assert.equal(r.ok, true);
  assert.equal(r.state, "SETTLED");
  assert.equal(
    r.afterData.some((d) => (d as { settlementLedger?: unknown }).settlementLedger !== undefined),
    false,
  );
});

/* =====================================================================
 * 7. buildSettlementLedger 纯函数直测
 * ===================================================================== */

test("buildSettlementLedger：违约退款路径与正常分账路径字段齐备", () => {
  const refundLedger = buildSettlementLedger({
    ammo: companionAmmo,
    orderId: "esc-9",
    amount: 200,
    depositRate: 0.3,
    refund: { elapsedRatio: 0.25, isBreach: true },
  });
  assert.equal(refundLedger.status, "SETTLED");
  assert.ok(refundLedger.refund);
  assert.equal(refundLedger.hold.heldDeposit, 60);

  const splitLedger = buildSettlementLedger({
    ammo: meetupAmmo,
    orderId: "esc-10",
    amount: 300,
    participants: 3,
    platformRate: 0.1,
  });
  assert.equal(splitLedger.split?.perSeatCost, 100);
  assert.equal(splitLedger.split?.platformIncome, 30);
  assert.equal(splitLedger.split?.providerIncome, 270);
  assert.equal(splitLedger.demanderRefund, 0);
});

/* ============ S4 合规分账指令路由（防二清） ============ */

test("S4：微信分账指令生成（服务商商户号 + 幂等指令号 + 金额守恒）", () => {
  const s = calculateProviderSettlement(200, 0.1);
  assert.equal(s.platformFee, 20);
  assert.equal(s.providerNet, 180);
  const ins = generateComplianceSplitInstruction(s, "WECHAT_PAY", {
    orderId: "esc-11",
    receiverAccountId: "provider-1",
  });
  assert.equal(ins.instructionId, "split-esc-11-WECHAT_PAY");
  assert.equal(ins.channel, "WECHAT_PAY");
  assert.equal(ins.merchantId, "1900000109");
  assert.equal(ins.receiverAccountId, "provider-1");
  assert.equal(ins.splitAmountYuan, 180);
  assert.equal(ins.platformFeeYuan, 20);
  assert.equal(ins.demanderRefundYuan, 0);
  assert.equal(ins.currency, "CNY");
  assert.ok(Number.isFinite(ins.createdAt));
  // 守恒：split + fee + refund ≡ total
  assert.equal(ins.splitAmountYuan + ins.platformFeeYuan + ins.demanderRefundYuan, 200);
});

test("S4：Stripe Connect 分账指令（渠道商户号映射 + 自定义覆盖）", () => {
  const ins = generateComplianceSplitInstruction(
    { platformFee: 15, providerNet: 135, demanderRefund: 0 },
    "STRIPE_CONNECT",
    { orderId: "esc-12", receiverAccountId: "acct_provider_9" },
  );
  assert.equal(ins.merchantId, "acct_connect_standard");
  const custom = generateComplianceSplitInstruction(
    { platformFee: 1, providerNet: 99 },
    "STRIPE_CONNECT",
    { orderId: "esc-13", receiverAccountId: "p2", merchantId: "acct_connect_custom" },
  );
  assert.equal(custom.merchantId, "acct_connect_custom");
});

test("S4：银行托管分账（退款场景原路退回 + 幂等键渠道隔离）", () => {
  const ins = generateComplianceSplitInstruction(
    { platformFee: 5, payToProvider: 40, refundToDemander: 155 },
    "BANK_ESCROW",
    { orderId: "esc-14", receiverAccountId: "provider-2" },
  );
  assert.equal(ins.splitAmountYuan, 40);
  assert.equal(ins.demanderRefundYuan, 155);
  assert.equal(ins.platformFeeYuan, 5);
  assert.equal(ins.splitAmountYuan + ins.platformFeeYuan + ins.demanderRefundYuan, 200);
  // 同订单不同渠道 → 指令号不同（幂等键含渠道）
  const wechat = generateComplianceSplitInstruction(
    { platformFee: 5, payToProvider: 40, refundToDemander: 155 },
    "WECHAT_PAY",
    { orderId: "esc-14", receiverAccountId: "provider-2" },
  );
  assert.notEqual(wechat.instructionId, ins.instructionId);
});

test("S4：buildSettlementLedger 挂载合规分账指令（缺省不产出，兼容既有）", () => {
  const noCompliance = buildSettlementLedger({
    ammo: meetupAmmo,
    orderId: "esc-15",
    amount: 300,
    participants: 3,
    platformRate: 0.1,
  });
  assert.equal(noCompliance.compliance, undefined);

  const withCompliance = buildSettlementLedger({
    ammo: meetupAmmo,
    orderId: "esc-16",
    amount: 300,
    participants: 3,
    platformRate: 0.1,
    compliance: { channel: "WECHAT_PAY", receiverAccountId: "provider-3" },
  });
  assert.ok(withCompliance.compliance);
  assert.equal(withCompliance.compliance.instructionId, "split-esc-16-WECHAT_PAY");
  assert.equal(withCompliance.compliance.splitAmountYuan, 270);
  assert.equal(withCompliance.compliance.platformFeeYuan, 30);
  assert.equal(withCompliance.compliance.receiverAccountId, "provider-3");
});

/* ============ 漏洞四：二级虚拟子账户 + 指令签名 ============ */

test("漏洞四：分账指令携带存管大账户/二级子账户/签名/镜像声明", () => {
  const ins = generateComplianceSplitInstruction(
    { platformFee: 20, providerNet: 180 },
    "WECHAT_PAY",
    { orderId: "esc-20", receiverAccountId: "provider-1" },
  );
  assert.equal(ins.masterAccountId, "master-wechat-escrow-0001");
  assert.equal(ins.providerSubWalletId, "sub-provider-1");
  assert.match(ins.instructionSignature, /^sig-[0-9a-f]{8}$/);
  assert.equal(ins.isMirrorLedgerOnly, true);
});

test("漏洞四：签名确定性（同输入同签名，篡改金额即变）", () => {
  const base = { platformFee: 10, providerNet: 90 };
  const opts = { orderId: "esc-21", receiverAccountId: "p1" };
  const a = generateComplianceSplitInstruction(base, "BANK_ESCROW", opts);
  const b = generateComplianceSplitInstruction(base, "BANK_ESCROW", opts);
  assert.equal(a.instructionSignature, b.instructionSignature);
  const tampered = generateComplianceSplitInstruction(
    { platformFee: 10, providerNet: 91 },
    "BANK_ESCROW",
    opts,
  );
  assert.notEqual(tampered.instructionSignature, a.instructionSignature);
});

test("漏洞四：自定义存管大账户/子账户/签名密钥可注入", () => {
  const ins = generateComplianceSplitInstruction(
    { platformFee: 5, payToProvider: 45, refundToDemander: 50 },
    "STRIPE_CONNECT",
    {
      orderId: "esc-22",
      receiverAccountId: "acct_p",
      masterAccountId: "master-custom-001",
      providerSubWalletId: "sub-custom-002",
      signatureSecret: "test-secret",
    },
  );
  assert.equal(ins.masterAccountId, "master-custom-001");
  assert.equal(ins.providerSubWalletId, "sub-custom-002");
  assert.equal(ins.splitAmountYuan, 45);
  assert.equal(ins.demanderRefundYuan, 50);
});
