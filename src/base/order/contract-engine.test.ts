/**
 * D-5 Phase B · Base 合同引擎纯函数核考卷：
 * 目标态谓词与 action 双入口跃迁校验（合法/非法/角色守卫/服务阶段前置）→ 状态推导
 * （getNextFundStatus/getNextServiceStage/isServiceStageOnlyAction/deriveNextActions）→
 * 阶梯退款（封顶/比例/回落/全退）→ 双映射桥（fundStatus 7 态 ➔ AtomicFiveState 五态投影
 * 与 milestone-escrow 托管五态，裁决 #2：SATISFACTION_HELD 严格映射 SUBMITTED/INSPECTED）。
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  CONTRACT_FUND_STATUSES,
  calcContractRefund,
  deriveNextActions,
  getNextFundStatus,
  getNextServiceStage,
  isServiceStageOnlyAction,
  mapFundStatusToAtomicState,
  mapFundStatusToMilestonePhase,
  validateContractAction,
  validateContractTransition,
} from "./contract-engine.ts";
import type { IContractProtocolDef } from "./contract-engine.ts";

/** 迷你协议定义：复刻内置合同域主链（托管→服务阶段推进→完成→满意放款/争议）。 */
const DEF: IContractProtocolDef = {
  states: [
    { name: "PENDING_HELD" },
    { name: "HELD" },
    { name: "COMPLETED" },
    { name: "DISPUTED" },
    { name: "CANCELLED", terminal: true },
    { name: "SATISFACTION_HELD" },
    { name: "SETTLED", terminal: true },
  ],
  transitions: [
    { action: "publish", from: "PENDING_HELD", to: "HELD", allowedRoles: ["customer"] },
    { action: "cancel_pending", from: "PENDING_HELD", to: "CANCELLED", allowedRoles: ["customer"] },
    { action: "accept", from: "HELD", to: "HELD", allowedRoles: ["provider"], serviceStage: { from: 0, to: 1 } },
    { action: "depart", from: "HELD", to: "HELD", allowedRoles: ["provider"], serviceStage: { from: 1, to: 2 } },
    { action: "arrive", from: "HELD", to: "HELD", allowedRoles: ["provider"], serviceStage: { from: 2, to: 3 } },
    { action: "start_work", from: "HELD", to: "HELD", allowedRoles: ["provider"], serviceStage: { from: 3, to: 4 } },
    { action: "auto_complete", from: "HELD", to: "COMPLETED", allowedRoles: ["system"], serviceStage: { from: 4, to: 5 } },
    { action: "rate_satisfied", from: "COMPLETED", to: "SATISFACTION_HELD", allowedRoles: ["customer"] },
    { action: "release_satisfaction", from: "SATISFACTION_HELD", to: "SETTLED", allowedRoles: ["system", "customer"] },
    { action: "open_dispute", from: "HELD", to: "DISPUTED", allowedRoles: ["customer", "provider"] },
    { action: "resolve_refund", from: "DISPUTED", to: "CANCELLED", allowedRoles: ["admin"] },
  ],
  serviceStages: ["NOT_ACCEPTED", "ACCEPTED", "DEPARTED", "ARRIVED", "IN_PROGRESS", "DONE"],
  refundRules: [
    { stage: 0, customerGets: "all" },
    { stage: 1, providerMax: 30, customerGets: "rest" },
    { stage: 4, providerRatio: 0.5, customerGets: "rest" },
    { stage: 5, providerRatio: 1.0, customerGets: "rest" },
  ],
};

test("目标态谓词校验：合法跃迁返回 null", () => {
  assert.equal(validateContractTransition(DEF, "PENDING_HELD", "HELD", 0, 0, "customer"), null);
  assert.equal(validateContractTransition(DEF, "SATISFACTION_HELD", "SETTLED", 5, 5, "customer"), null);
});

test("目标态谓词校验：无此跃迁返回拒绝原因字符串", () => {
  const reason = validateContractTransition(DEF, "PENDING_HELD", "SETTLED", 0, 5, "customer");
  assert.equal(typeof reason, "string");
  assert.match(reason!, /无合法跃迁/);
});

test("目标态谓词校验：角色不在 allowedRoles 即拒绝", () => {
  assert.notEqual(validateContractTransition(DEF, "DISPUTED", "CANCELLED", 4, 4, "provider"), null);
  assert.equal(validateContractTransition(DEF, "DISPUTED", "CANCELLED", 4, 4, "admin"), null);
});

test("目标态谓词校验：服务阶段前置约束", () => {
  assert.equal(validateContractTransition(DEF, "HELD", "HELD", 0, 1, "provider"), null);
  // (1→2)=depart 合法；谓词形按「存在匹配跃迁」判定，跨阶段跳变 (0→2) 无跃迁覆盖即拒绝
  assert.equal(validateContractTransition(DEF, "HELD", "HELD", 1, 2, "provider"), null);
  assert.match(
    validateContractTransition(DEF, "HELD", "HELD", 0, 2, "provider")!,
    /无合法跃迁/,
  );
});

test("action 形校验：未知操作 / 阶段前置 / 角色无权 / 大小写放行", () => {
  assert.match(validateContractAction(DEF, "nonexistent", { fundStatus: "HELD", serviceStage: 0, role: "customer" })!, /未知操作/);
  // HELD@stage2 对 auto_complete：资金状态匹配但阶段前置不符（from 定义为 4）
  assert.match(
    validateContractAction(DEF, "auto_complete", { fundStatus: "HELD", serviceStage: 2, role: "system" })!,
    /当前服务阶段不允许执行/,
  );
  assert.match(
    validateContractAction(DEF, "publish", { fundStatus: "PENDING_HELD", serviceStage: 0, role: "provider" })!,
    /角色无权执行此操作/,
  );
  // 角色大小写不敏感（旧轨语义保持）
  assert.equal(
    validateContractAction(DEF, "publish", { fundStatus: "PENDING_HELD", serviceStage: 0, role: "Customer" }),
    null,
  );
});

test("action 形校验：阶段前置人话报错含阶段名", () => {
  const reason = validateContractAction(DEF, "depart", { fundStatus: "HELD", serviceStage: 0, role: "provider" });
  assert.match(reason!, /需要处于 ACCEPTED/);
});

test("getNextFundStatus：按 action 推导下一资金状态", () => {
  assert.equal(getNextFundStatus(DEF, "auto_complete"), "COMPLETED");
  assert.equal(getNextFundStatus(DEF, "release_satisfaction"), "SETTLED");
  assert.equal(getNextFundStatus(DEF, "nonexistent"), null);
});

test("getNextServiceStage：有推进返回数字，无推进返回 null", () => {
  assert.equal(getNextServiceStage(DEF, "accept"), 1);
  assert.equal(getNextServiceStage(DEF, "start_work"), 4);
  assert.equal(getNextServiceStage(DEF, "rate_satisfied"), null);
  assert.equal(getNextServiceStage(DEF, "nonexistent"), null);
});

test("isServiceStageOnlyAction：资金不变仅推阶段的动作判定", () => {
  assert.equal(isServiceStageOnlyAction(DEF, "accept"), true);
  assert.equal(isServiceStageOnlyAction(DEF, "auto_complete"), false);
  assert.equal(isServiceStageOnlyAction(DEF, "nonexistent"), false);
});

test("deriveNextActions：复合状态派生可执行动作表", () => {
  // HELD@stage2 @provider：可出发（仅推阶段）+ 可开争议（跨资金态）——多动作按定义序
  const actions = deriveNextActions(DEF, "HELD", 2, "provider");
  assert.deepEqual(actions, [
    { action: "arrive", toFundStatus: undefined, toStage: 3 },
    { action: "open_dispute", toFundStatus: "DISPUTED", toStage: undefined },
  ]);
  // 同一 fundStatus 不同角色派生不同动作集
  const customerActions = deriveNextActions(DEF, "HELD", 0, "customer").map((a) => a.action);
  assert.ok(customerActions.includes("open_dispute"));
  assert.ok(!customerActions.includes("accept"));
});

test("阶梯退款：amount≤0 与无规则全退兜底", () => {
  assert.deepEqual(calcContractRefund(DEF, 4, 0), { provider: 0, customer: 0 });
  assert.deepEqual(calcContractRefund({ states: [], transitions: [] }, 4, 1000), {
    provider: 0,
    customer: 1000,
  });
});

test("阶梯退款：stage1 上门费封顶（providerMax=30）", () => {
  assert.deepEqual(calcContractRefund(DEF, 1, 1000), { provider: 30, customer: 970 });
});

test("阶梯退款：stage4 服务中五五分（providerRatio=0.5）", () => {
  assert.deepEqual(calcContractRefund(DEF, 4, 1000), { provider: 500, customer: 500 });
});

test("阶梯退款：stage5 完工后比例 1.0 = 服务者全额", () => {
  assert.deepEqual(calcContractRefund(DEF, 5, 800), { provider: 800, customer: 0 });
});

test("阶梯退款：无精确匹配时回落最近较低阶段规则", () => {
  // stage2 无专属规则 → 回落 stage1 封顶 30
  assert.deepEqual(calcContractRefund(DEF, 2, 1000), { provider: 30, customer: 970 });
});

test("阶梯退款：ratio+max 组合取小（min 语义钉死）", () => {
  const def: IContractProtocolDef = {
    states: [],
    transitions: [],
    refundRules: [{ stage: 3, providerRatio: 0.8, providerMax: 100, customerGets: "rest" }],
  };
  assert.deepEqual(calcContractRefund(def, 3, 1000), { provider: 100, customer: 900 });
});

test("五态映射桥：7 态全覆盖投影", () => {
  const F = CONTRACT_FUND_STATUSES;
  assert.equal(mapFundStatusToAtomicState(F.PENDING_HELD), "PUBLISHED");
  assert.equal(mapFundStatusToAtomicState(F.COMPLETED), "INSPECTED");
  assert.equal(mapFundStatusToAtomicState(F.SATISFACTION_HELD), "INSPECTED");
  assert.equal(mapFundStatusToAtomicState(F.CANCELLED), "SETTLED");
  assert.equal(mapFundStatusToAtomicState(F.SETTLED), "SETTLED");
  assert.equal(mapFundStatusToAtomicState("UNKNOWN_FUND"), "PUBLISHED");
});

test("五态映射桥：HELD/DISPUTED 阶段敏感消歧", () => {
  const F = CONTRACT_FUND_STATUSES;
  assert.equal(mapFundStatusToAtomicState(F.HELD, 0), "MATCHED");
  assert.equal(mapFundStatusToAtomicState(F.HELD, 1), "IN_SERVICE");
  assert.equal(mapFundStatusToAtomicState(F.HELD), "MATCHED");
  assert.equal(mapFundStatusToAtomicState(F.DISPUTED, 2), "IN_SERVICE");
  assert.equal(mapFundStatusToAtomicState(F.DISPUTED, 5), "INSPECTED");
  assert.equal(mapFundStatusToAtomicState(F.DISPUTED), "INSPECTED");
});

test("托管阶段映射桥：裁决 #2 —— SATISFACTION_HELD 严格映射 SUBMITTED", () => {
  const F = CONTRACT_FUND_STATUSES;
  assert.equal(mapFundStatusToMilestonePhase(F.PENDING_HELD), "PENDING");
  assert.equal(mapFundStatusToMilestonePhase(F.HELD), "HELD");
  assert.equal(mapFundStatusToMilestonePhase(F.COMPLETED), "SUBMITTED");
  assert.equal(mapFundStatusToMilestonePhase(F.SATISFACTION_HELD), "SUBMITTED");
  assert.equal(mapFundStatusToMilestonePhase(F.DISPUTED), "HELD");
  assert.equal(mapFundStatusToMilestonePhase(F.CANCELLED), "REFUNDED");
  assert.equal(mapFundStatusToMilestonePhase(F.SETTLED), "RELEASED");
});
