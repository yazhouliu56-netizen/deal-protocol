/**
 * D-5 状态机双轨收敛 · Base 合同引擎纯函数核（参谋部裁决 2026-08-26）：
 * 旧轨 lib/protocol/engine.ts 的校验内核上收 Base，lib 侧降级为数据+薄壳；
 * 本模块是 contracts 域 fundStatus(7 态) × serviceStage(0-5) 的唯一权威求值器。
 *
 * 红线 1：100% 确定性——协议定义为纯入参（结构化数据），零时钟读取、零概率。
 * 红线 3：底座纯净——零 Supabase / UI / Store / lib 反向依赖（类型结构化自持，
 *          与 lib/protocol/types.ts 的 ProtocolDef 鸭子兼容，依赖方向 lib→base 单向）。
 * 宪法收敛：条文 #1（底座优先）/ #3（单一真理源：跃迁合法性只此一处求值）。
 */

/** AtomicFiveState 自 src/types/ammo-schema.ts（runner 同款引用先例，共享契约层）。 */
import type { AtomicFiveState } from "../../types/ammo-schema.ts";
import type { MilestoneStatus } from "../money/milestone-escrow";

/* =====================================================================
 * 合同域状态常量（与旧轨 contract-machine.ts 字节级对齐，存量行数据兼容）
 * ===================================================================== */

export const CONTRACT_FUND_STATUSES = {
  PENDING_HELD: "PENDING_HELD",
  HELD: "HELD",
  COMPLETED: "COMPLETED",
  DISPUTED: "DISPUTED",
  CANCELLED: "CANCELLED",
  SATISFACTION_HELD: "SATISFACTION_HELD",
  SETTLED: "SETTLED",
} as const;

export type ContractFundStatus =
  (typeof CONTRACT_FUND_STATUSES)[keyof typeof CONTRACT_FUND_STATUSES];

export const CONTRACT_SERVICE_STAGES = {
  NOT_ACCEPTED: 0,
  ACCEPTED: 1,
  DEPARTED: 2,
  ARRIVED: 3,
  IN_PROGRESS: 4,
  DONE: 5,
} as const;

/* =====================================================================
 * 协议定义结构化类型（鸭子兼容 lib/protocol/types.ts，不反向 import）
 * ===================================================================== */

export interface IContractTransitionDef {
  action: string;
  from: string;
  to: string;
  allowedRoles: readonly string[];
  /** 服务阶段前置/推进约束；from 缺省=任意阶段，to 缺省=阶段不变 */
  serviceStage?: { from?: number; to?: number };
  /** 自定义守卫（确定性纯函数；返回 null=放行，string=拒绝原因） */
  guard?: (ctx: IContractTransitionCtx) => string | null;
}

export interface IContractTransitionCtx {
  contract: {
    id: string;
    fundStatus: string;
    disputeStatus: string | null;
    serviceStage: number;
    providerId: string;
    customerId: string;
    amount: number;
    completedAt: Date | null;
    autoCompleteAt: Date | null;
  };
  actor: { id: string; role: string };
  payload?: Record<string, unknown>;
}

export interface IContractRefundRule {
  stage: number;
  providerMax?: number;
  providerRatio?: number;
  customerGets: "rest" | "all";
}

export interface IContractProtocolDef {
  states: ReadonlyArray<{ name: string; terminal?: boolean }>;
  transitions: readonly IContractTransitionDef[];
  serviceStages?: readonly string[];
  refundRules?: readonly IContractRefundRule[];
}

/* =====================================================================
 * 跃迁校验（Spec 目标态谓词形 + 旧轨 action 形双入口，语义同源）
 * ===================================================================== */

function findTransition(
  def: IContractProtocolDef,
  action: string,
): IContractTransitionDef | undefined {
  return def.transitions.find((t) => t.action === action);
}

function roleAllowed(t: IContractTransitionDef, role: string): boolean {
  return t.allowedRoles.some((r) => r.toLowerCase() === role.toLowerCase());
}

/**
 * 目标态谓词校验（Spec 签名）：判定 fromFund→toFund / fromStage→toStage @role
 * 是否为协议定义内的合法跃迁。返回 null=合法，string=拒绝原因（与旧轨约定一致）。
 */
export function validateContractTransition(
  protocolDef: IContractProtocolDef,
  fromFund: string,
  toFund: string,
  fromStage: number,
  toStage: number,
  role: string,
): string | null {
  const match = protocolDef.transitions.find(
    (t) =>
      t.from === fromFund &&
      t.to === toFund &&
      roleAllowed(t, role) &&
      (t.serviceStage?.from === undefined || t.serviceStage.from === fromStage) &&
      (t.serviceStage?.to === undefined ? true : t.serviceStage.to === toStage),
  );
  if (!match) {
    return `无合法跃迁: ${fromFund}(stage ${fromStage}) → ${toFund}(stage ${toStage}) @${role}`;
  }
  return null;
}

export interface IContractActionContext {
  fundStatus: string;
  serviceStage: number;
  role: string;
}

/**
 * action 形校验（旧轨 engine.validateTransition 忠实移植，存量调用零破坏）：
 * 按 action 定位跃迁 → 校验资金状态 → 角色权限（大小写不敏感）→ 服务阶段前置 → guard。
 * 返回 null=合法，string=拒绝原因。
 */
export function validateContractAction(
  protocolDef: IContractProtocolDef,
  action: string,
  ctx: IContractActionContext,
  fullCtx?: IContractTransitionCtx,
): string | null {
  const t = findTransition(protocolDef, action);
  if (!t) return `未知操作: ${action}`;
  if (t.from !== ctx.fundStatus) {
    return `当前状态 ${ctx.fundStatus} 不允许执行 ${action}`;
  }
  if (!roleAllowed(t, ctx.role)) {
    return `${ctx.role} 角色无权执行此操作`;
  }
  if (t.serviceStage?.from !== undefined && t.serviceStage.from !== ctx.serviceStage) {
    const stageName = protocolDef.serviceStages?.[t.serviceStage.from] ?? `阶段 ${t.serviceStage.from}`;
    return `当前服务阶段不允许执行 ${action}，需要处于 ${stageName}`;
  }
  if (t.guard && fullCtx) {
    return t.guard(fullCtx);
  }
  return null;
}

/* =====================================================================
 * 状态推导
 * ===================================================================== */

/** action 执行后的下一个资金状态；未知 action 返回 null。 */
export function getNextFundStatus(
  protocolDef: IContractProtocolDef,
  action: string,
): string | null {
  return findTransition(protocolDef, action)?.to ?? null;
}

/** action 执行后的下一个服务阶段；无阶段推进或未知 action 返回 null。 */
export function getNextServiceStage(
  protocolDef: IContractProtocolDef,
  action: string,
): number | null {
  const t = findTransition(protocolDef, action);
  if (!t?.serviceStage?.to) return null;
  return t.serviceStage.to;
}

/** 判断 action 是否为「资金状态不变、仅推进服务阶段」的动作。 */
export function isServiceStageOnlyAction(
  protocolDef: IContractProtocolDef,
  action: string,
): boolean {
  const t = findTransition(protocolDef, action);
  return t !== undefined && t.from === t.to;
}

/** 派生动作表：复合状态（fundStatus + serviceStage + role）下的可执行动作清单。 */
export function deriveNextActions(
  protocolDef: IContractProtocolDef,
  fundStatus: string,
  serviceStage: number,
  role: string,
): Array<{ action: string; toFundStatus?: string; toStage?: number }> {
  return protocolDef.transitions
    .filter((t) => {
      if (t.from !== fundStatus) return false;
      if (!roleAllowed(t, role)) return false;
      if (t.serviceStage?.from !== undefined && t.serviceStage.from !== serviceStage) return false;
      return true;
    })
    .map((t) => ({
      action: t.action,
      toFundStatus: t.from !== t.to ? t.to : undefined,
      toStage: t.serviceStage?.to,
    }));
}

/* =====================================================================
 * 阶梯退款计算（旧轨 calcRefund 忠实移植：规则精确匹配 → 最近较低阶段回落）
 * ===================================================================== */

export function calcContractRefund(
  protocolDef: IContractProtocolDef,
  serviceStage: number,
  amount: number,
): { provider: number; customer: number } {
  if (amount <= 0) return { provider: 0, customer: 0 };

  const rules = protocolDef.refundRules;
  if (!rules || rules.length === 0) {
    // 无退款规则：默认全退
    return { provider: 0, customer: amount };
  }

  let rule = rules.find((r) => r.stage === serviceStage);
  if (!rule) {
    const sorted = [...rules].sort((a, b) => b.stage - a.stage);
    rule = sorted.find((r) => r.stage <= serviceStage);
  }
  if (!rule) {
    return { provider: 0, customer: amount };
  }

  if (rule.customerGets === "all") {
    return { provider: 0, customer: amount };
  }

  let providerAmount = 0;
  if (rule.providerRatio !== undefined) {
    providerAmount = Math.round(amount * rule.providerRatio * 10000) / 10000;
  }
  if (rule.providerMax !== undefined) {
    providerAmount = Math.min(providerAmount, rule.providerMax);
  }
  if (rule.providerRatio === undefined && rule.providerMax !== undefined) {
    providerAmount = Math.min(rule.providerMax, amount);
  }

  return { provider: providerAmount, customer: Math.max(0, amount - providerAmount) };
}

/* =====================================================================
 * 双映射桥（参谋部裁决 #2：SATISFACTION_HELD ➔ SUBMITTED/INSPECTED）
 * ===================================================================== */

/**
 * 桥一：fundStatus(7 态) → AtomicFiveState 五态投影（服务视角）。
 * 可选 serviceStage 用于 HELD/DISPUTED 的阶段敏感消歧：
 * - HELD：stage 0（未接单）= MATCHED 锁定；stage ≥1（已启动）= IN_SERVICE；
 * - DISPUTED：交付前争议（stage <5）叠加于履约中；交付后争议（stage 5）叠加于验收位。
 * 未知状态保守兜底 PUBLISHED（与 toAtomicFiveState 未终止兜底语义一致）。
 */
export function mapFundStatusToAtomicState(
  fundStatus: string,
  serviceStage?: number,
): AtomicFiveState {
  switch (fundStatus) {
    case "PENDING_HELD":
      return "PUBLISHED";
    case "HELD":
      return (serviceStage ?? 0) >= 1 ? "IN_SERVICE" : "MATCHED";
    case "COMPLETED":
      return "INSPECTED";
    case "SATISFACTION_HELD":
      return "INSPECTED";
    case "DISPUTED":
      return (serviceStage ?? 5) < 5 ? "IN_SERVICE" : "INSPECTED";
    case "CANCELLED":
      return "SETTLED";
    case "SETTLED":
      return "SETTLED";
    default:
      return "PUBLISHED";
  }
}

/**
 * 桥二：fundStatus(7 态) → milestone-escrow MilestonePhase（资金托管视角）。
 * 裁决 #2 核心：SATISFACTION_HELD（满意后放款观察期）严格映射 SUBMITTED，
 * 放款统一走 milestone-escrow 的 SUBMITTED ➔ RELEASED 链路。
 */
export function mapFundStatusToMilestonePhase(fundStatus: string): MilestoneStatus {
  switch (fundStatus) {
    case "PENDING_HELD":
      return "PENDING";
    case "HELD":
      return "HELD";
    case "COMPLETED":
      return "SUBMITTED";
    case "SATISFACTION_HELD":
      return "SUBMITTED";
    case "DISPUTED":
      return "HELD";
    case "CANCELLED":
      return "REFUNDED";
    case "SETTLED":
      return "RELEASED";
    default:
      return "PENDING";
  }
}
