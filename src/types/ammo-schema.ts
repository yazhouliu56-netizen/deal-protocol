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
  maxRounds?: number;
  reviewWindowMs?: number;
  depositRate?: number;
}

/**
 * 弹药定义（每颗弹药 = 一张声明式清单，填表即新弹药）：
 * `ammoId + category + 五态钩子 + 定价模型 + 引信策略`。
 * 底座通用 AmmoRunner 按此清单装载执行（红线 2：声明式弹药规范）。
 */
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
  /** SOP 覆盖项（缺省走 ammo/sop 类目表）。 */
  sop?: IAmmoSopOverrides;
}
