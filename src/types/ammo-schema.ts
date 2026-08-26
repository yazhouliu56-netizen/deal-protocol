/**
 * 声明式弹药 Schema 契约（Declarative Ammo Schema）。
 *
 * 人类创始人注入（2026-08-15）：
 * - 万能物理底座 = 五态原子状态机（绝对封闭），业务子流程以伴生事件插拔。
 * - 每颗弹药 = 一份 IAmmoDefinition（声明式装填：五态钩子 + 定价模型 + 引信策略）。
 * 本文件为底层协议（红线 3：`UI / Ammo ➔ base ➔ types`），只依赖 fuze-policy。
 *
 * 8 维全息弹药契约（2026-08-16 AmmoFactory 工业级装配线）：
 * - IHolographicAmmoConfig = 装配原料（D1 供给准入 / D2 计价与护栏 / D3 引信 /
 *   D4 传感降级 / D5 正向钩子 / D6 逆向违约阶梯 / D7 清算与仲裁 / D8 视界与表单）；
 * - IAmmoDefinition 增补 holographic 运行时镜像（工厂装配弹药直挂全息配置）。
 */

import type { IFuzePolicy } from "./fuze-policy";
import type { ScenarioTheme } from "./ui-viewport";

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
  /**
   * 订单 CAS 乐观锁版本号（mvp 标准表 orders.version 的运行时镜像）。
   * 底座在跃迁点注入的「当前磁盘版本」；与 expectedVersion 双缺省 =
   * 非版本化调用（跳过 CAS 校验，兼容既有零版本调用）。
   */
  currentVersion?: number;
  /** 调用方期望校验的版本号（读-改-写回旋：读取时快照，写前比对）。 */
  expectedVersion?: number;
  /** 弹药自描述负载（如现场增项报价单、AA 分摊明细）。 */
  payload?: Record<string, unknown>;
  /**
   * 在途订单弹药快照（快照冻结机制）：由 AmmoRunner 在装配跃迁上下文时注入
   * （= AdvanceInput.ammoSnapshot）。钩子闭包可读该快照做伴随校验；存在时
   * 状态机一切跃迁与钩子执行严格基于该快照，免疫线上弹药热更新污染。
   * 缺省 = 未启用快照（兼容既有零快照调用）。
   */
  ammoSnapshot?: IAmmoDefinition;
  /**
   * 需求方非标定制要求（阶段3 语义驯化产物）：口语化非标需求（着装/年龄/性别）
   * 经 intent-normalizer 清洗后的中性化契约，随订单流透传至供给端准入与
   * 运行时风控升级。可选字段，缺省 = 无定制（兼容既有调用零破坏）。
   */
  customRequirements?: INormalizedCustomIntent;
}

/** 伴生事件执行结果（ok=false 且 fallback=BLOCK 时底座阻止跃迁）。 */
export interface ISubEventResult {
  ok: boolean;
  reason?: string;
  /** 透传给上层的结果数据（如复核通过的配件清单）。 */
  data?: unknown;
  /** 跃迁成功后的递增版本号（CAS 写回用：调用方以它为 orders.version 新值）。 */
  nextVersion?: number;
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

/* =====================================================================
 * D4 传感降级 · 所需物理传感器清单与降级阶梯（零信任物理感知红线）
 * ===================================================================== */

/** 物理传感器类型（D4 传感维度枚举）。 */
export type SensorKind =
  | "GPS_GEOFENCE" // LBS 电子围栏（到点解锁）
  | "WATERMARK_CAMERA" // 水印相机（时空防伪存证）
  | "NFC_BUMP" // 碰碰核销（完工打卡）
  | "REAL_TIME_AUDIO" // 实时录音（留证/危机联动）
  // 降级阶梯备用位（人类创始人裁决 2026-08-16：三大标杆弹药 8D 全息化
  // 增补；只作传感器失效时的逐级回退位，非独立主传感器）
  | "CELL_TOWER_COARSE_GEO" // 基站粗定位（GPS 围栏失效回退）
  | "MANUAL_BASE_PHOTO_AUDIT" // 人工照片审核兜底（定位不可用）
  | "HTML5_NATIVE_FALLBACK" // 原生摄像头兜底（水印相机不可用）
  | "QR_SCAN_VERIFICATION" // 扫码核验（NFC/围栏失效回退）
  | "PROXIMITY_DEPARTURE_MANUAL_CHECK"; // 离开人工确认（近炸停表兜底）

/**
 * 传感降级阶梯（宪法 #10：降级是设计的一部分）：
 * 主传感器不可用时按阶梯逐级回退到备用传感器，全部失效才降级为
 * 人工确认兜底。如 `{ GPS_GEOFENCE: ["NFC_BUMP"] }` = GPS 围栏失效
 * → 碰碰核销替代到点确认。
 */
export type SensorFallbackLadder = Partial<Record<SensorKind, SensorKind[]>>;

/* =====================================================================
 * D6 逆向违约阶梯（取消/违约分阶段赔付契约）
 * ===================================================================== */

/** 违约发生阶段（逆向违约阶梯的阶梯切点）。 */
export type CancellationStage =
  | "BEFORE_MATCH" // 匹配前取消（雇主零成本撤单）
  | "AFTER_MATCH_EN_ROUTE" // 匹配后·服务者出发途中（车马费补偿）
  | "ON_SITE" // 已到现场（场地/等待成本补偿）
  | "IN_SERVICE"; // 服务中（按已完成比例结算）

/** 逆向违约单阶梯（按阶段声明退款/补偿/扣金三件套）。 */
export interface ICancellationTier {
  /** 违约发生阶段。 */
  stage: CancellationStage;
  /** 雇主退款比例（0.0 ~ 1.0，按已托管总额）。 */
  demanderRefundRatio: number;
  /** 服务者补偿车马费（元，服务方低成本垫资保障）。 */
  providerCompensationYuan: number;
  /** 违约扣除保证金比例（0.0 ~ 1.0，仅违约方责任时扣划）。 */
  deductDepositRatio: number;
}

/* =====================================================================
 * D7 清算与仲裁 · 分账比例契约（资金守恒硬性校验位）
 * ===================================================================== */

/** 终局分账规则：三方比例之和必须严格等于 1.0（资金守恒红线）。 */
export interface ISplitRules {
  /** 服务方净得比例。 */
  providerRatio: number;
  /** 平台分润比例。 */
  platformRatio: number;
  /** 履约险/兜底池计提比例。 */
  insuranceRatio: number;
}

/* =====================================================================
 * D2 计价与护栏 · 计价参数集（公式类定价的附加参数）
 * ===================================================================== */

/** 计价附加参数（formula pricing 的 params 结构化镜像）。 */
export type PricingParams = Record<string, number | string | boolean>;

/* =====================================================================
 * 8 维全息弹药配置契约（IHolographicAmmoConfig → AmmoFactory 装配原料）
 *
 * 单颗弹药以一份声明式 8 维全息配置交付装配线，维度划分：
 *   D1 供给准入   D2 计价与护栏   D3 风控引信   D4 传感降级
 *   D5 正向钩子   D6 逆向违约阶梯 D7 清算与仲裁 D8 视界与表单
 * 装配线（src/ammo/factory.ts）执行静态语义审查 → 沙箱组装 →
 * 不可变发布（Object.freeze 全图冻结），审核不通过拒绝出厂。
 * ===================================================================== */
export interface IHolographicAmmoConfig {
  /* ===== 弹药身份元数据（装配线产物 IAmmoDefinition 的身份三件套） ===== */
  /** 弹药唯一标识（URL 安全短名，如 "car-wash-v1"）。 */
  ammoId: string;
  /** 业务类目名（注册表检索键，对齐 getAmmoDefinition(category)）。 */
  category: string;
  /** 弹药版本（语义化 x.y.z，如 'v1.0.0'）。 */
  version: string;

  /* ===== D1 供给准入（S1 R_AUTH 供给端准入网关） ===== */
  /** 运力池属性聚类（C2_IN_HOME 入户触发安全一票否决）。 */
  supplyCluster: SupplyCluster;
  /** 服务者最低资质门槛（入户类目须过背调红线方可出厂）。 */
  workerRequirement?: IWorkerRequirement;

  /* ===== D2 计价与护栏（价格透明优先 + 防坐地起价） ===== */
  /** 计价模型（固定 / 时薪 / 人均 / 公式引用）。 */
  pricingModel: PricingModel;
  /** 计价附加参数（如里程费、夜间系数）。 */
  pricingParams?: PricingParams;
  /** 地板价（分）：成交价不得低于此价（防低价抢单倾销）。 */
  minFloorPrice?: number;
  /** 天花板价（分）：成交价不得高于此价（防坐地起价）。 */
  maxCeilingPrice?: number;
  /** 现场增项加价上限比例（默认 0.5，装配审查强校验 ≤ 0.5）。 */
  maxSurchargeRatio?: number;
  /** 定向信用折抵规则（信用飞轮兑换闸门）。 */
  creditWaiverRule?: ICreditWaiverRule;

  /* ===== D3 风控引信（💥碰炸 / ⏳延期 / 📡近炸，引信跟弹药走） ===== */
  /** 引信策略（未显式装填 = 零防护兜底，审查器拒绝装配）。 */
  fuzePolicy: IFuzePolicy;

  /* ===== D4 传感降级（零信任物理感知 · 宪法 #10） ===== */
  /** 履约所需物理传感器清单（缺省 = 纯软件履约）。 */
  requiredSensors?: SensorKind[];
  /** 主传感器失效时的逐级回退阶梯。 */
  sensorFallbackLadder?: SensorFallbackLadder;

  /* ===== D5 正向钩子（五态伴生事件插拔清单） ===== */
  /** 引用的标准钩子名称清单（HOOK_OPERATOR_REGISTRY 静态白名单解析）。 */
  forwardHooks?: string[];

  /* ===== D6 逆向违约阶梯（分阶段取消/违约赔付契约） ===== */
  /** 违约阶段阶梯（按阶段声明退款比例/车马费补偿/保证金扣划）。 */
  cancellationTiers?: ICancellationTier[];
  /**
   * D6 · SLA 阶段时间纪律（服务阶段 → 超时秒数）。
   * 键对齐 SERVICE_STAGES 阶段名（如 ACCEPTED / DEPARTED）；合并语义 =
   * 以 base/order/protocol-definitions 的 DEFAULT_SLA_PHASES 为底、弹药声明
   * 逐键覆盖（可只声明部分键）。Microkernel 2.0 战役 1（P1-4）：终结
   * sla-enforcer 全局 30/60 分钟硬编码。
   */
  slaPhases?: Record<string, number>;
  /**
   * 资金模式声明（Microkernel 2.0 战役 1 · P0-1 能力白名单）。
   * 工厂质检期强校验：仅接受 base/money/funding-dispatcher 的
   * SUPPORTED_FUNDING_MODES（full_prepay | commitment | milestone_staged），
   * 未支持模式一票否决拒出厂（UNSUPPORTED_FUNDING_MODE），严禁静默降级。
   * 缺省视为 full_prepay。
   */
  fundingMode?: string;

  /* ===== D7 清算与仲裁（终局分账 + 超时代验收） ===== */
  /** 超时自动代验收时长（小时；缺省 24）。 */
  autoAcceptanceTimeoutHours?: number;
  /** 终局分账规则（三比之和 = 1.0，资金守恒硬校验）。 */
  splitRules?: ISplitRules;

  /* ===== D8 视界与表单（前端视界投影隔离 · 动态视口装载） ===== */
  /** 场景特化微主色令牌（housekeeping/meetup/companion/default）。 */
  theme?: ScenarioTheme;
  /** 发布页动态表单 JSON-Schema（PublishSheet 视界投影用）。 */
  formSchema?: Record<string, unknown>;
  /** 履约座舱场景插槽键（五态视口特化插槽装载位）。 */
  cockpitSlot?: string;
  /**
   * 发布端中文类目检索别名（声明式元数据，非检索硬编码字典）：
   * 动态长尾弹药让前端发布端用口语化中文类目直达本弹（如
   * ["农田无人机植保", "无人机打药"] → drone-crop-spray-v1）。
   * resolveAmmoIdForPublish 按别名遍历仅只读匹配，全图冻结后不可变。
   */
  aliases?: string[];

  /**
   * D5.5 进家词表（Microkernel 2.0 战役 3 · 弹药自包含）：
   * 命中即整表生效（homeAccessKeywordsFor 弹药优先段）；缺省回落存量
   * HOME_ACCESS_KEYWORDS_MAP / 全局引信参数链，零回归。
   */
  homeAccessKeywords?: string[];
  /**
   * D5.6 风控引信声明清单（战役 3 · 弹药自包含）：RiskRuleName 子集，
   * riskRulesFor 将其并入该类目 enabled 集；缺省不改变任何现状。
   */
  declaredRiskRules?: string[];

  /**
   * D4.5 派单规则自包含（战役 3 · 填一张 8D 声明即全自动量产）：
   * 显式声明则出厂直通 ammo.dispatchRule（四表引擎弹药优先段消费）；
   * 缺省由四表聚合/默认兜底，零回归。
   */
  dispatchRule?: IDispatchRule;
  /** D6.7 SOP 覆盖自包含（战役 3）：语义同 IAmmoSopOverrides，缺省回落表行。 */
  sop?: IAmmoSopOverrides;

  /**
   * D9 履约行动契约（Microkernel 2.0 战役 4 · 座舱 Schema 化）：
   * 声明本弹药在履约座舱（C/D 视口）内的原子行动模块装配清单与视口
   * 模板皮肤——座舱据此动态装配交互视口，零品类硬编码分支。
   * 缺省 = 宿主按传感/引信/计价声明自动推导（PROOF_PHOTO ← WATERMARK_CAMERA 等），
   * 存量弹零回归。
   */
  actionSchema?: ICockpitActionSchema;
}

/* ═══════════════════════════════════════════════════════════════════
 * D9 履约行动契约（战役 4 · 履约座舱 Schema 化与动态视口归一）
 * ═══════════════════════════════════════════════════════════════════ */

/**
 * 座舱原子行动模块枚举（六模块 · 与五态钩子/传感声明一一对应）：
 * - ONSITE_QUOTE：现场增项改价确认单（OnsiteQuoteHook 的 UI 形态）；
 * - PROOF_PHOTO：Before/After 双拍存证打卡（WATERMARK_CAMERA / CleaningCheckHook）；
 * - GEOFENCE_ARRIVAL：围栏签到 + 扫码到场验真（GPS_GEOFENCE / ArrivalCheckHook）;
 * - AA_SPLIT：AA 多退少补对账（AASplitSettleHook / PER_SEAT 计价）；
 * - PRIVACY_SHIELD：隐私盾 + 伪装假电话 + 一键拉黑（PrivacyShieldHook / 近炸引信）；
 * - DEPARTURE_STOP：安全距离脱离自动停表指示（高人身风险类目）。
 */
export type CockpitActionModule =
  | "ONSITE_QUOTE"
  | "PROOF_PHOTO"
  | "GEOFENCE_ARRIVAL"
  | "AA_SPLIT"
  | "PRIVACY_SHIELD"
  | "DEPARTURE_STOP";

/**
 * 视口模板皮肤键（锚点前缀）：决定插槽 DOM 锚点层级（data-slot /
 * data-testid / data-action 前缀）。四大标杆弹各自锁定其历史视口模板
 * → E2E 锚点零漂移；长尾动态弹缺省 "dyn"（通用自适应视口）。
 */
export type CockpitSlotVariant = "hk" | "mt" | "cp" | "dyn";

/** 单个原子行动模块声明（文案覆盖等扩展位预留）。 */
export interface ICockpitModuleDecl {
  module: CockpitActionModule;
}

/**
 * D9 行动 Schema：弹药 → 履约座舱视口的唯一装配说明书。
 * DynamicAmmoSlot 宿主按 modules 顺序动态装配原子行动模块；
 * variant 选择预置模板皮肤（官方四弹）或通用 dyn 视口。
 */
export interface ICockpitActionSchema {
  /** 视口模板皮肤（锚点前缀）；缺省按 theme 派生，长尾弹为 "dyn"。 */
  variant: CockpitSlotVariant;
  /** 原子行动模块装配清单（顺序即渲染顺序）。 */
  modules: ICockpitModuleDecl[];
}

/**
 * 非标定制着装类型（语义驯化标准化枚举）：
 * - THEMED_MAID：女仆主题（重二次元角色化着装）；
 * - THEMED_COSPLAY：Cosplay / JK 制服等角色扮演着装；
 * - FORMAL_UNIFORM：正装 / 西装 / 礼服等商务正式着装；
 * - CUSTOM：其余无法归类的指定着装（工装/围裙等）。
 */
export type IDressCodeType =
  | "THEMED_MAID"
  | "THEMED_COSPLAY"
  | "FORMAL_UNIFORM"
  | "CUSTOM";

/**
 * 定制要求契约（阶段3 语义驯化产出 · 中性化参数载体）。
 * 口语非标定制（着装/年龄/性别偏好）经 intent-normalizer 清洗为结构化属性，
 * 由 voiceIntent → Wave / bizParams / ISubEventContext 无损承载。
 * 全部字段可选：缺省 = 无对应定制（零破坏兼容）。
 */
export interface ICustomRequirements {
  /** 指定着装要求（命中着装词时 required=true 并归一为标准化类型）。 */
  dressCode?: {
    required: boolean;
    type: IDressCodeType;
    /** 原始命中关键词（如「女仆装」），供审计追溯。 */
    rawKeyword: string;
  };
  /** 期望服务者年龄区间 [minAge, maxAge]（需求方硬筛选）。 */
  ageRange?: [number, number];
  /** 性别偏好（MALE / FEMALE / ANY；缺省 ANY）。 */
  genderPreference?: "MALE" | "FEMALE" | "ANY";
}

/**
 * 语义驯化完整输出契约（intent-normalizer 纯函数产出）。
 * = ICustomRequirements + 中性化展示文案 + 敏感标记 + 违禁硬阻断标记。
 * - cleanText：脱敏后的中性展示文案（公海/草稿卡展示位，杜绝擦边词直显）；
 * - isSensitiveCustomization：是否包含需升级风控的非标定制（驱动运行时
 *   多因子评分 + 引信自适应升级）；
 * - blockedReason：命中绝对违禁词（涉黄涉赌涉暴，autoFlag 硬阻断）时
 *   返回原因码，null = 未阻断（驯化通道正常）。
 */
export interface INormalizedCustomIntent extends ICustomRequirements {
  /** 清洗后的中性化展示文案（如「要求：指定工作着装(女仆主题) · 期望年龄: 20-30岁」）。 */
  cleanText: string;
  /** 是否包含需升级风控的非标定制（着装/年龄/性别任一命中即 true）。 */
  isSensitiveCustomization: boolean;
  /** 绝对违禁词命中原因（autoFlag 标签；null = 未命中可正常驯化）。 */
  blockedReason: string | null;
}

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
  /**
   * 公安无犯罪核验通行证（C2_IN_HOME 入户一票否决红线关键位）：
   * 入户类目弹药装配时须 `isPoliceVerified === true` 或
   * `minSafetyScore >= 700`（0-1000 综合安全分量表），否则拒绝出厂。
   */
  isPoliceVerified?: boolean;
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
 * 分账重试结果契约（微信/银行分账指数退避 · 确定性纯函数输出，红线 1）。
 * 资金引擎 escrow.calculateSplitRetrySchedule 每次调用产出下一跳重试计划：
 * - 重试阶梯：1 次 → 1min / 2 次 → 5min / 3 次 → 15min / 4 次 → 60min /
 *   5 次 → 120min；
 * - 第 6 次起（retryCount > 5）放弃重试（shouldAbandon）并触发 P0 财务
 *   严重告警（isP0AlertTriggered）——资金链路不得无限重试，人工介入兜底。
 */
export interface ISplitRetrySchedule {
  /** 当前重试序号（1 起；>5 表示已超出重试上限）。 */
  retryCount: number;
  /** 本次重试的等待延时（分钟；放弃态为 0）。 */
  delayMinutes: number;
  /** 下次重试时刻（epoch ms = nowTimestamp + delayMinutes × 60 × 1000）。 */
  nextRetryAt: number;
  /** 是否超过 5 次放弃重试（第 6 次起 true）。 */
  shouldAbandon: boolean;
  /** 是否触发 P0 财务严重报警（第 6 次起 true，需人工介入）。 */
  isP0AlertTriggered: boolean;
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
  /**
   * 服务者实龄（实名档案画像；阶段3 定制年龄硬门禁数据源）。
   * 可选：缺省 = 年龄未知（跳过 AGE_MISMATCH 校验，不误杀未知画像）。
   */
  age?: number;
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
  /**
   * 超时自动代验收时长（小时；缺省 24）。IN_SERVICE 无验收动作超过该
   * 时长后，系统按弹药契约自动代验收（超时自动代验收 SOP：服务完成信号
   * 或截止时刻到达即视为已验收），入库字段同步写入
   * `mvp_core_tables.sql` pricing_configs / orders 的 SOP 装配键。
   */
  autoAcceptanceTimeoutHours?: number;
  /** 运力池属性聚类（C1 移动轻履约 / C2 入户重背调 / C3 技术 B2B；缺省 = 未归类）。 */
  supplyCluster?: SupplyCluster;
  /**
   * 8 维全息配置运行时镜像（AmmoFactory 装配时投影，缺省 = 非工厂装配的
   * 手写弹药）。视界层/履约座舱只读消费 D4/D6/D7/D8 全息数据（传感降级
   * 阶梯、违约阶梯、分账规则、视界令牌），宪法红线 6：前端视界投影隔离。
   */
  holographic?: IHolographicAmmoConfig;
  /**
   * 需求方非标定制要求（阶段3 语义驯化）：弹药级可选透传位，
   * 供准入/风控在缺省订单级 customRequirements 时回落（零破坏）。
   */
  customRequirements?: INormalizedCustomIntent;
}
