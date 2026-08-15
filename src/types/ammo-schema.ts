/**
 * 声明式弹药 Schema 契约（Declarative Ammo Schema）。
 *
 * 人类创始人注入（2026-08-15）：
 * - 万能物理底座 = 五态原子状态机（绝对封闭），业务子流程以伴生事件插拔。
 * - 每颗弹药 = 一份 IAmmoDefinition（声明式装填：五态钩子 + 定价模型 + 引信策略）。
 * 本文件为底层协议（红线 3：`UI / Ammo ➔ base ➔ types`），只依赖 fuze-policy。
 */

import type { IFuzePolicy } from "./fuze-policy";

/**
 * 五态原子生命周期（Atomic Five-State Lifecycle）：
 * `PUBLISHED（已发布）➔ MATCHED（已匹配）➔ IN_SERVICE（服务中）
 *  ➔ INSPECTED（已验收）➔ SETTLED（已结算）`。
 *
 * 底座主状态机对五态保持**绝对封闭**（宪法 #2：接口保守，只可增补不可改义）；
 * 任何业务子流程（现场增项报价 / AA 分摊确认 / 配件复核…）一律以伴生事件
 * 插拔，不得改变五态本身。
 */
export type AtomicFiveState =
  | "PUBLISHED"
  | "MATCHED"
  | "IN_SERVICE"
  | "INSPECTED"
  | "SETTLED";

/** 五态跃迁矩阵（唯一合法流向；横向 = 目标态）。 */
export const FIVE_STATE_TRANSITIONS: Record<AtomicFiveState, AtomicFiveState[]> = {
  PUBLISHED: ["MATCHED"],
  MATCHED: ["IN_SERVICE"],
  IN_SERVICE: ["INSPECTED"],
  INSPECTED: ["SETTLED"],
  SETTLED: [],
};

/** 伴生事件执行上下文（底座在跃迁点构造，弹药闭包只读）。 */
export interface ISubEventContext {
  ammoId: string;
  /** 业务单号（wave id / order id）。 */
  orderId: string;
  from: AtomicFiveState;
  to: AtomicFiveState;
  /** 弹药自描述负载（如现场增项报价单、AA 分摊明细）。 */
  payload?: Record<string, unknown>;
}

/** 伴生事件执行结果（ok=false 且 fallback=BLOCK 时底座阻止跃迁）。 */
export interface ISubEventResult {
  ok: boolean;
  reason?: string;
  /** 透传给上层的结果数据（如复核通过的配件清单）。 */
  data?: unknown;
}

/** 伴生事件钩子（Sub-Event Hook）：插拔在五态跃迁上的业务子流程。 */
export interface ISubEventHook {
  hookId: string;
  /** 挂载点：目标态或跃迁（from → to）；缺省 = 任意跃迁。 */
  on: { to: AtomicFiveState } | { from: AtomicFiveState; to: AtomicFiveState };
  /** 触发时机：跃迁前（校验）或跃迁后（副作用）。 */
  phase: "BEFORE" | "AFTER";
  /** 弹药侧业务闭包（底座不感知实现，只保证在跃迁点调用）。 */
  run(ctx: ISubEventContext): ISubEventResult | Promise<ISubEventResult>;
  /**
   * 确定性降级（宪法 #10：降级是设计的一部分）：
   * - SKIP：钩子失败不影响主状态机（如展示性事件）。
   * - BLOCK：钩子失败阻止跃迁（如资金/准入类校验）。
   * - DEFER：暂存待重试（弱网队列语义）。
   */
  fallback: "SKIP" | "BLOCK" | "DEFER";
}

/**
 * 插件微工作流机制（漏洞一闭环 · 微状态机固化）：
 * 单钩子 = 最小原子微工作流（校验 → 执行 → 降级），底座只负责在跃迁点
 * 按 `phase` 调度与按 `fallback` 降级，不感知钩子内部实现——业务子流程
 * 因此获得与五态主状态机同构的确定性：**每个钩子要么产出一个明确结果
 * （ok + reason + data），要么按声明降级，绝不静默失效**。钩子链即
 * 微工作流编排层（如 onsiteQuoteHook → cleaningCheckHook 构成
 * 「增项确认 → 双拍验收」两段式现场微流程），上承五态、下接弹药闭包。
 */

/** 计价模型（对齐 ammo/pricing-formula 表：固定 / 时薪 / 人均 / 公式引用）。 */
export type PricingModel =
  | { kind: "FIXED"; amountYuan: number }
  | { kind: "HOURLY"; rateYuan: number; minHours: number }
  | { kind: "PER_SEAT"; perSeatYuan: number; minSeats: number }
  | { kind: "FORMULA"; formulaId: string; params?: Record<string, number> };

/** 弹药 SOP 覆盖项（对齐 ammo/sop.ts 的 SopParams，弹药表默认值优先）。 */
export interface IAmmoSopOverrides {
  depositDefault?: boolean;
  expiresInMs?: number;
  capacityDefault?: number;
  /** 拼位缓冲名额（发起人 no-show buff 默认值；增补对齐 SopParams）。 */
  buffSeats?: number;
  /** 磋商轮次上限（增补对齐 SopParams）。 */
  maxRounds?: number;
  reviewWindowMs?: number;
  depositRate?: number;
}

/**
 * 派单规则契约（对齐 ammo/dispatch-rule 表；人类创始人裁决 2：弹药可声明
 * 派单/抢单打分规则，未声明时底座按全局默认分发）。
 */
export interface IDispatchRule {
  /** 打分权重（距离/信用/定制覆盖/验证加分）。 */
  weights: {
    distance: number;
    credit: number;
    custom: number;
    verifiedBonus: number;
  };
  /** 硬门槛（进家实名 / 黑名单 / 在线要求）。 */
  hardGates?: {
    requiresVerified?: string[];
    banned?: boolean;
    online?: boolean;
  };
  /** 星级加成：★≥x 且完成率≥y 时加分。 */
  starBonus?: { starMin: number; completionMin: number; bonus: number };
}

/**
 * 终止事件（人类创始人裁决 1：分支终态以伴生终止事件承载——
 * 取消 / 超时关闭 / 违约结算，携带结算载荷流转至 SETTLED）。
 * 五态主状态机保持绝对封闭，终止路径不新增五态成员。
 */
export type TerminationKind = "CANCELLED" | "EXPIRED" | "BREACH_SETTLED";

export interface ITerminationEvent {
  /** 终止类型：取消 / 超时关闭 / 违约结算。 */
  kind: TerminationKind;
  /** 触发时刻（epoch ms）。 */
  at: number;
  /** 业务单号（wave id / order id）。 */
  orderId: string;
  /** 终止前所处五态。 */
  from: AtomicFiveState;
  /** 结算载荷（如违约赔付金额、退款比例、裁决记录）。 */
  payload?: Record<string, unknown>;
}

/**
 * 弹药定义（每颗弹药 = 一张声明式清单，填表即新弹药）：
 * `ammoId + category + 五态钩子 + 定价模型 + 引信策略`。
 * 底座通用 AmmoRunner 按此清单装载执行（红线 2：声明式弹药规范）。
 */

/**
 * 供给端准入要求（S1 R_AUTH 供给端准入网关 · 动态资质拦截）。
 * 弹药声明服务者进入该类目履约所需的最低资质门槛，WorkerWorkbench /
 * 接单链路按此拦截未达标服务者（补齐资质后方可接该类目订单）。
 */
export interface IWorkerRequirement {
  /** 必需资格证书（如 ['HEALTH_CERT', 'ELECTRICIAN_CERT']）。 */
  requiredCertificates?: string[];
  /** 最低安全背调分（0-100；低于该分禁止承接高风险入户类目）。 */
  minSafetyScore?: number;
  /** 最低实名等级（BASIC 注册 / REAL_NAME 实名 / POLICE_VERIFIED 公安核验）。 */
  requiredIdentityLevel?: "BASIC" | "REAL_NAME" | "POLICE_VERIFIED";
}

/**
 * 定向信用折抵规则（分维度信用折抵 · 防信用错位）。
 * 数字人格信用飞轮的兑换闸门：仅允许指定信用维度折抵指定资金门槛
 * （如「安全分 → 押金」/「守时分 → 预付定金」），禁止跨维度通兑
 * （防高安全分用户用错维度套利）。
 */
export interface ICreditWaiverRule {
  /** 允许折抵的信用维度（单维度定向，禁止多维度叠加通兑）。 */
  allowedCreditDimension:
    | "SAFETY_BACKGROUND"
    | "PUNCTUALITY"
    | "SKILL_LEVEL"
    | "ASSET_REPUTATION";
  /** 最高允许折抵比例（如 0.5 = 押金最多折抵 50%，其余仍需资金锁定）。 */
  maxWaiverPercentage: number;
}

/**
 * 运力池属性聚类（漏洞三闭环 · SupplyCluster）：
 * 供给端运力按履约物理形态聚类，弹药声明所属运力池，
 * 供派单/风控/准入按聚类差异化路由（如 C2_IN_HOME 需强背调）。
 */
export type SupplyCluster = "C1_MOBILITY" | "C2_IN_HOME" | "C3_TECH_B2B";

/**
 * 三维解耦信用契约（漏洞二闭环 · BCS/PQS/ESF 三维雷达）。
 * 与既有单维信用分（trustScore）解耦并存：三维分各自独立评定，
 * 垂直技能分按类目隔离，杜绝「全能通才」式跨类目信用套利。
 */
export interface ITriDimensionalCredit {
  /** 通用履约信用分（Base Compliance Score，0-100，全类目通用）。 */
  bcsScore: number;
  /** 垂直专业技能分（Professional Qualification Score，按类目隔离，如 { housekeeping: 85 }）。 */
  pqsScores: Record<string, number>;
  /** 道德与人身安全分（Ethics & Safety Factor，0-100，入户/密闭空间一票否决维度）。 */
  esfScore: number;
  /** 是否通过公安无犯罪核验（入户/密闭空间类目强制要求）。 */
  isPoliceVerified: boolean;
}

export interface IAmmoDefinition {
  /** 弹药唯一标识（URL 安全短名，如 "housekeeping-v1"）。 */
  ammoId: string;
  /** 业务类目名（对齐 ammo 四表的 category 键）。 */
  category: string;
  /** 弹药版本（语义化 x.y.z）。 */
  version: string;
  /** 伴生事件钩子清单（插拔在五态跃迁上）。 */
  fiveStateHooks: ISubEventHook[];
  /** 计价模型。 */
  pricingModel: PricingModel;
  /** 风控引信策略（三类引信模板或弹药专属配置）。 */
  fuzePolicy: IFuzePolicy;
  /** 派单规则（可选；缺省走 base/dispatch 全局默认）。 */
  dispatchRule?: IDispatchRule;
  /** SOP 覆盖项（缺省走 ammo/sop 类目表）。 */
  sop?: IAmmoSopOverrides;
  /** 供给端准入门槛（S1 R_AUTH；缺省 = 无额外要求）。 */
  workerRequirement?: IWorkerRequirement;
  /** 定向信用折抵规则（信用飞轮兑换闸门；缺省 = 不开放折抵）。 */
  creditWaiverRule?: ICreditWaiverRule;
  /** 现场加价上限比例（防坐地起价：增项金额 ≤ 初始基准价 × 此比例；缺省 0.5）。 */
  maxSurchargeRatio?: number;
  /** 运力池属性聚类（C1 移动轻履约 / C2 入户重背调 / C3 技术 B2B；缺省 = 未归类）。 */
  supplyCluster?: SupplyCluster;
}
