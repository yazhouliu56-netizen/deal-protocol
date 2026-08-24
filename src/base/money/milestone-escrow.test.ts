/**
 * 批次 3a · 里程碑分期托管纯函数引擎考卷：
 * 最大余数法整数分守恒（乱序/病理浮点/平局固定序）→ 单轨状态机流转（HELD→SUBMITTED→RELEASED，
 * HELD 直跳=免验收刻意放款）→ 时钟注入超时决策（仅扫 SUBMITTED、边界等值含）→ 终止退款清算
 * （违约金超冻结强拒绝 INSUFFICIENT_FUNDS_FOR_PENALTY）→ milestoneId 粒度幂等。
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  createMilestonePlan,
  evaluateMilestoneTimeout,
  frozenRemainingCents,
  refundRemainingMilestones,
  releaseMilestone,
  releasedTotalCents,
  submitMilestoneCheckpoint,
} from "./milestone-escrow.ts";

const CRITERIA = [{ title: "阶段一" }, { title: "阶段二" }, { title: "阶段三" }];
const T0 = "2026-08-23T00:00:00.000Z";

/* =====================================================================
 * 1. createMilestonePlan：最大余数法整数分无损分配
 * ===================================================================== */

test("资金守恒与精确分配：10000 分按 0.5/0.3/0.2 → 5000/3000/2000，sum ≡ total", () => {
  const plan = createMilestonePlan(10000, [0.5, 0.3, 0.2], CRITERIA);
  const amounts = plan.milestones.map((m) => m.amountCents);
  assert.deepEqual(amounts, [5000, 3000, 2000]);
  assert.equal(
    amounts.reduce((s, a) => s + a, 0),
    plan.totalAmountCents,
  );
});

test("最大余数法平局：1000 分三等分 → 334/333/333，余数分落固定遍历序首位", () => {
  const plan = createMilestonePlan(1000, [1, 1, 1], CRITERIA);
  assert.deepEqual(plan.milestones.map((m) => m.amountCents), [334, 333, 333]);
});

test("病理浮点防御：0.1/0.2/0.7 权重 ×1000 分 → 100/200/700（epsilon 抵消浮点表示误差）", () => {
  const plan = createMilestonePlan(1000, [0.1, 0.2, 0.7], CRITERIA);
  assert.deepEqual(plan.milestones.map((m) => m.amountCents), [100, 200, 700]);
});

test("余数分落小数部分更大者：10 分按 0.33/0.34/0.33 → 3/4/3", () => {
  const plan = createMilestonePlan(10, [0.33, 0.34, 0.33], CRITERIA);
  assert.deepEqual(plan.milestones.map((m) => m.amountCents), [3, 4, 3]);
});

test("非法比例拦截：负数 / 全零 / NaN / 空数组 一律 INVALID_RATIOS", () => {
  assert.throws(() => createMilestonePlan(100, [-0.5, 1.5], [{ title: "a" }, { title: "b" }]), /INVALID_RATIOS/);
  assert.throws(() => createMilestonePlan(100, [0, 0], [{ title: "a" }, { title: "b" }]), /INVALID_RATIOS/);
  assert.throws(() => createMilestonePlan(100, [Number.NaN, 1], [{ title: "a" }, { title: "b" }]), /INVALID_RATIOS/);
  assert.throws(() => createMilestonePlan(100, [], []), /INVALID_RATIOS/);
});

test("契约完整性拦截：criteria 数量错位 / 总额非整数分 / 总额非正", () => {
  assert.throws(() => createMilestonePlan(100, [0.5, 0.5], [{ title: "only-one" }]), /INVALID_CRITERIA/);
  assert.throws(() => createMilestonePlan(100.5, [1], [{ title: "a" }]), /INVALID_TOTAL_AMOUNT/);
  assert.throws(() => createMilestonePlan(0, [1], [{ title: "a" }]), /INVALID_TOTAL_AMOUNT/);
});

test("创建即托管：全部里程碑直入 HELD（PENDING 为预留枚举不产出），id/stepNumber 确定性生成", () => {
  const plan = createMilestonePlan(3000, [1, 1, 1], CRITERIA);
  for (const [i, m] of plan.milestones.entries()) {
    assert.equal(m.status, "HELD");
    assert.equal(m.id, `milestone-${i + 1}`);
    assert.equal(m.stepNumber, i + 1);
  }
});

/* =====================================================================
 * 2. submitMilestoneCheckpoint：HELD ➔ SUBMITTED
 * ===================================================================== */

test("提交验收成功：HELD ➔ SUBMITTED，submittedAt 注入落位，其余里程碑不受扰", () => {
  const plan = createMilestonePlan(10000, [0.5, 0.3, 0.2], CRITERIA);
  const { plan: next, milestone } = submitMilestoneCheckpoint(plan, "milestone-2", {
    submittedAt: T0,
    proofUri: "https://cdn.example.com/proof.jpg",
  });
  assert.equal(milestone.status, "SUBMITTED");
  assert.equal(milestone.submittedAt, T0);
  assert.equal(next.milestones[0].status, "HELD");
  assert.equal(next.milestones[2].status, "HELD");
  assert.equal(frozenRemainingCents(plan), 10000);
  assert.equal(frozenRemainingCents(next), 10000);
});

test("重复提交拒绝：SUBMITTED 再提交抛 INVALID_MILESTONE_STATE", () => {
  const plan = createMilestonePlan(10000, [0.5, 0.3, 0.2], CRITERIA);
  const once = submitMilestoneCheckpoint(plan, "milestone-1", { submittedAt: T0 });
  assert.throws(() => submitMilestoneCheckpoint(once.plan, "milestone-1", { submittedAt: T0 }), /INVALID_MILESTONE_STATE/);
});

test("不存在里程碑：未知 id 抛 MILESTONE_NOT_FOUND；非法时间串抛 INVALID_TIMESTAMP", () => {
  const plan = createMilestonePlan(10000, [0.5, 0.3, 0.2], CRITERIA);
  assert.throws(() => submitMilestoneCheckpoint(plan, "ghost", { submittedAt: T0 }), /MILESTONE_NOT_FOUND/);
  assert.throws(() => submitMilestoneCheckpoint(plan, "milestone-1", { submittedAt: "not-a-time" }), /INVALID_TIMESTAMP/);
});

/* =====================================================================
 * 3. releaseMilestone：双入口放款 + milestoneId 粒度幂等
 * ===================================================================== */

test("正常验收放款：SUBMITTED ➔ RELEASED，流水金额与剩余冻结精确", () => {
  let plan = createMilestonePlan(10000, [0.5, 0.3, 0.2], CRITERIA);
  plan = submitMilestoneCheckpoint(plan, "milestone-1", { submittedAt: T0 }).plan;
  const result = releaseMilestone(plan, "milestone-1");
  assert.equal(result.alreadyReleased, false);
  assert.equal(result.releasedCents, 5000);
  assert.deepEqual(result.ledgerEntry, {
    kind: "MILESTONE_RELEASE",
    milestoneId: "milestone-1",
    stepNumber: 1,
    title: "阶段一",
    amountCents: 5000,
    skippedAcceptance: false,
  });
  assert.equal(result.plan.milestones[0].status, "RELEASED");
  assert.equal(releasedTotalCents(result.plan), 5000);
  assert.equal(frozenRemainingCents(result.plan), 5000);
});

test("免验收即时刻意放款：HELD 直跳 RELEASED 合法，流水标记 skippedAcceptance=true", () => {
  const plan = createMilestonePlan(10000, [0.5, 0.3, 0.2], CRITERIA);
  const result = releaseMilestone(plan, "milestone-3");
  assert.equal(result.releasedCents, 2000);
  assert.equal(result.ledgerEntry?.skippedAcceptance, true);
  assert.equal(result.plan.milestones[2].status, "RELEASED");
});

test("幂等根治旧缺陷：已 RELEASED 重复放款为 no-op（零二次入账），plan 引用不变", () => {
  let plan = createMilestonePlan(10000, [0.5, 0.3, 0.2], CRITERIA);
  plan = submitMilestoneCheckpoint(plan, "milestone-1", { submittedAt: T0 }).plan;
  const first = releaseMilestone(plan, "milestone-1");
  const again = releaseMilestone(first.plan, "milestone-1");
  assert.equal(again.alreadyReleased, true);
  assert.equal(again.releasedCents, 0);
  assert.equal(again.ledgerEntry, null);
  assert.strictEqual(again.plan, first.plan);
  assert.equal(releasedTotalCents(again.plan), 5000);
});

test("REFUNDED 不可放款：终止清算后放款请求抛 INVALID_MILESTONE_STATE", () => {
  const plan = createMilestonePlan(10000, [0.5, 0.3, 0.2], CRITERIA);
  const cleared = refundRemainingMilestones(plan, 0).plan;
  assert.throws(() => releaseMilestone(cleared, "milestone-2"), /INVALID_MILESTONE_STATE/);
});

/* =====================================================================
 * 4. evaluateMilestoneTimeout：时钟注入 + 仅扫 SUBMITTED（决策/执行分离）
 * ===================================================================== */

test("超时判定边界：now < 截止不入清单；now == 截止（等值含）；now > 截止入清单", () => {
  let plan = createMilestonePlan(10000, [0.5, 0.3, 0.2], CRITERIA, { defaultTimeoutHours: 24 });
  plan = submitMilestoneCheckpoint(plan, "milestone-1", { submittedAt: T0 }).plan;
  const before = evaluateMilestoneTimeout(plan, "2026-08-23T23:59:59.999Z");
  assert.deepEqual(before.timedOutMilestoneIds, []);
  const exact = evaluateMilestoneTimeout(plan, "2026-08-24T00:00:00.000Z");
  assert.deepEqual(exact.timedOutMilestoneIds, ["milestone-1"]);
  const after = evaluateMilestoneTimeout(plan, "2026-08-25T00:00:00.000Z");
  assert.deepEqual(after.timedOutMilestoneIds, ["milestone-1"]);
});

test("HELD 不参与超时扫描：未提交的里程碑即便时间远超也绝不出清单", () => {
  let plan = createMilestonePlan(10000, [0.5, 0.3, 0.2], CRITERIA, { defaultTimeoutHours: 24 });
  plan = submitMilestoneCheckpoint(plan, "milestone-1", { submittedAt: T0 }).plan;
  const result = evaluateMilestoneTimeout(plan, "2026-09-30T00:00:00.000Z");
  assert.deepEqual(result.timedOutMilestoneIds, ["milestone-1"]);
});

test("无超时配置永不超时：单里程碑与 plan 级皆缺省 timeoutHours → 恒空清单", () => {
  const plan = createMilestonePlan(10000, [0.5, 0.3, 0.2], CRITERIA);
  const submitted = submitMilestoneCheckpoint(plan, "milestone-1", { submittedAt: T0 }).plan;
  const result = evaluateMilestoneTimeout(submitted, "2030-01-01T00:00:00.000Z");
  assert.deepEqual(result.timedOutMilestoneIds, []);
});

test("单里程碑 timeoutHours 覆盖 plan 级缺省：以更短窗口先行超时", () => {
  const criteria = [{ title: "快检", timeoutHours: 1 }, { title: "慢检", timeoutHours: 48 }, { title: "默认" }];
  let plan = createMilestonePlan(900, [1, 1, 1], criteria, { defaultTimeoutHours: 24 });
  plan = submitMilestoneCheckpoint(plan, "milestone-1", { submittedAt: T0 }).plan;
  plan = submitMilestoneCheckpoint(plan, "milestone-2", { submittedAt: T0 }).plan;
  plan = submitMilestoneCheckpoint(plan, "milestone-3", { submittedAt: T0 }).plan;
  const result = evaluateMilestoneTimeout(plan, "2026-08-23T02:00:00.000Z");
  assert.deepEqual(result.timedOutMilestoneIds, ["milestone-1"]);
});

test("非法时钟注入：evaluateMilestoneTimeout 收到非 ISO now 抛 INVALID_TIMESTAMP", () => {
  const plan = createMilestonePlan(10000, [1], [{ title: "a" }]);
  assert.throws(() => evaluateMilestoneTimeout(plan, "yesterday"), /INVALID_TIMESTAMP/);
});

/* =====================================================================
 * 5. refundRemainingMilestones：终止退款清算 + 违约金超限强拒绝
 * ===================================================================== */

test("正常清算守恒：penalty ≤ 剩余冻结 → refunded = remaining − penalty，RELEASED 不动", () => {
  let plan = createMilestonePlan(10000, [0.5, 0.3, 0.2], CRITERIA);
  plan = releaseMilestone(plan, "milestone-1").plan;
  const result = refundRemainingMilestones(plan, 500);
  assert.equal(result.penaltyCents, 500);
  assert.equal(result.refundedCents, 4500);
  assert.deepEqual(result.clearedMilestoneIds, ["milestone-2", "milestone-3"]);
  assert.equal(result.plan.milestones[1].status, "REFUNDED");
  assert.equal(result.plan.milestones[2].status, "REFUNDED");
  assert.equal(result.plan.milestones[0].status, "RELEASED");
  assert.equal(frozenRemainingCents(result.plan), 0);
  assert.equal(releasedTotalCents(result.plan) + result.refundedCents + result.penaltyCents, 10000);
});

test("违约金超限强拒绝：penalty > 剩余冻结总额抛 INSUFFICIENT_FUNDS_FOR_PENALTY，计划原样不动", () => {
  const plan = createMilestonePlan(10000, [0.5, 0.3, 0.2], CRITERIA);
  assert.throws(() => refundRemainingMilestones(plan, 99999), /INSUFFICIENT_FUNDS_FOR_PENALTY/);
  assert.equal(frozenRemainingCents(plan), 10000);
});

test("清算幂等：全清后再清算 penalty=0 为零额 no-op；penalty>0 则因无冻结可扣强拒绝", () => {
  const plan = createMilestonePlan(10000, [0.5, 0.3, 0.2], CRITERIA);
  const once = refundRemainingMilestones(plan, 500);
  const twiceZeroPenalty = refundRemainingMilestones(once.plan, 0);
  assert.deepEqual(twiceZeroPenalty.clearedMilestoneIds, []);
  assert.equal(twiceZeroPenalty.refundedCents, 0);
  assert.throws(() => refundRemainingMilestones(once.plan, 500), /INSUFFICIENT_FUNDS_FOR_PENALTY/);
});

test("非法违约金拦截：负数与小数一律 INVALID_PENALTY", () => {
  const plan = createMilestonePlan(10000, [1], [{ title: "a" }]);
  assert.throws(() => refundRemainingMilestones(plan, -5), /INVALID_PENALTY/);
  assert.throws(() => refundRemainingMilestones(plan, 10.5), /INVALID_PENALTY/);
});
