/**
 * 第一枚官方标准弹药：housekeeping-v1（家庭深度保洁 · 上门服务）。
 *
 * 存量资产升级仪式（D-7 关闭）：
 *   出处 = `src/lib/protocol/protocols/housekeeping.ts`（250 行垂直 SOP，
 *   仍被 `lib/protocol/registry.ts` 引用，原位保留）+ `docs/contract-engine-state-machine.md`
 *   资金状态机（7 态 16 转换）。本文件以 8 维全息配置（IHolographicAmmoConfig）
 *   交付 AmmoFactory 流水线出厂，双轨并行不破坏既有引用方。
 *
 * 8D 全息化（人类创始人注入 2026-08-16 · 方案 A 三大标杆弹药全量流水线化归一）：
 *   - D1 供给准入：C2_IN_HOME 入户重背调（公安核验 isPoliceVerified 一票否决）。
 *   - D2 计价与护栏：HOURLY ¥60/h 起步 2h；地板 120 元 / 天花板 2000 元
 *     （12000/200000 分）；加价熔断 ≤50%；安全分定向折抵 ≤50%。
 *   - D3 风控引信：💥 IMPACT_FUZE_TEMPLATE（碰炸引信：进家高财产）。
 *   - D4 传感降级：GPS 围栏 + 水印相机；失效逐级回退基站粗定位/人工照片
 *     审核/原生摄像头。
 *   - D5 正向钩子：OnsiteQuoteHook + CleaningCheckHook（识别白名单算子出厂）。
 *   - D6 逆向违约阶梯：匹配前 100% 退 → 途退 80%+20 元车马费 →
 *     现场退 50% → 服务中 0% 退扣全额。
 *   - D7 清算与仲裁：24h 超时代验收；分账三比 0.85/0.10/0.05（资金守恒）。
 *   - D8 视界与表单：housekeeping 主题 + HousekeepingSlot 履约座舱插槽。
 */

import type {
  IAmmoDefinition,
  IHolographicAmmoConfig,
  ISubEventContext,
  ISubEventHook,
  ISubEventResult,
} from "../types/ammo-schema.ts";
import { IMPACT_FUZE_TEMPLATE } from "../types/fuze-policy.ts";
import { assembleAmmo, deepFreeze } from "./factory.ts";

/* =====================================================================
 * 存量协议资产投影升级（出处：protocols/housekeeping.ts）
 * ===================================================================== */

/** 服务阶段六态（存量 STAGE 0-5，索引即序号）。 */
export const HOUSEKEEPING_STAGES = [
  "NOT_ACCEPTED",
  "ACCEPTED",
  "DEPARTED",
  "ARRIVED",
  "IN_PROGRESS",
  "DONE",
] as const;
export type HousekeepingStage = (typeof HOUSEKEEPING_STAGES)[number];

/** 按服务阶段分级取消退款规则（存量 refundRules 投影：stage → 师傅拿/客户退）。 */
export const HOUSEKEEPING_REFUND_RULES = [
  { stage: 0, customerGets: "all" },
  { stage: 1, customerGets: "all" },
  { stage: 2, providerRatio: 0.1, providerMax: 30, customerGets: "rest" },
  { stage: 3, providerRatio: 0.15, providerMax: 50, customerGets: "rest" },
  { stage: 4, providerRatio: 0.5, customerGets: "rest" },
  { stage: 5, providerRatio: 0.5, customerGets: "rest" },
] as const;

/** 完工验收证据契约（存量 evidence 投影：before/after 照片必填，maxCount 5）。 */
export const HOUSEKEEPING_EVIDENCE = {
  beforePhoto: { label: "服务前照片", required: true, maxCount: 5 },
  afterPhoto: { label: "服务后照片", required: true, maxCount: 5 },
} as const;

/* =====================================================================
 * 存量领域钩子（富语义实现，保留导出供直接调用与直测）
 *
 * 8D 全息化后弹药本体（fiveStateHooks）改由 AmmoFactory 算子白名单解析
 * （红线 1：D5 forwardHooks 仅允许从 HOOK_OPERATOR_REGISTRY 静态解析）。
 * 本组富钩子（三闸校验 / 证据契约透传）作为领域语义库保留，旧调用方与
 * 直测仍可引用；引擎级流转已由算子接管（算子契约精简、降级语义一致）。
 * ===================================================================== */

export const ONSITE_QUOTE_HOOK_ID = "housekeeping.onsite-quote";
export const CLEANING_CHECK_HOOK_ID = "housekeeping.cleaning-check";

/**
 * 现场增项报价钩子（MATCHED → IN_SERVICE 前置校验，BLOCK 降级）。
 *
 * 语义（价格透明优先，对齐存量 review 维度 price_clarity 0.15）：
 *   - 无增项（payload 无 onsiteQuote）→ 直接放行；
 *   - 有增项且需求方已确认（onsiteQuote.approved === true）→ 放行，
 *     透传确认金额；
 *   - 有增项未确认 → BLOCK 阻止进入服务（禁止「先干后说价」）。
 * 确认载荷：payload.onsiteQuote = { items: string[], totalYuan: number, approved: boolean }。
 */
export const onsiteQuoteHook: ISubEventHook = {
  hookId: ONSITE_QUOTE_HOOK_ID,
  on: { to: "IN_SERVICE" },
  phase: "BEFORE",
  fallback: "BLOCK",
  run: (ctx: ISubEventContext): ISubEventResult => {
    const quote = ctx.payload?.onsiteQuote as
      | { items?: string[]; totalYuan?: number; approved?: boolean }
      | undefined;
    if (!quote) return { ok: true };
    if (quote.approved !== true) {
      return { ok: false, reason: "onsite-quote-pending" };
    }
    return { ok: true, data: { quoteTotalYuan: quote.totalYuan ?? 0 } };
  },
};

/**
 * 完工双向拍照与验收钩子（→ INSPECTED 后置证据收集，SKIP 降级）。
 *
 * 映射存量 completion.requiredEvidence: ["after_photo"] + evidence before/after。
 * 验收达成后把「服务前/后照片」证据清单透传上层（存证链/争议复核用）；
 * 相机不可用等软失败不影响验收（AFTER 副作用，状态已推进）。
 * 载荷：payload.photos = { before: string[], after: string[] }。
 */
export const cleaningCheckHook: ISubEventHook = {
  hookId: CLEANING_CHECK_HOOK_ID,
  on: { to: "INSPECTED" },
  phase: "AFTER",
  fallback: "SKIP",
  run: (ctx: ISubEventContext): ISubEventResult => {
    const photos = ctx.payload?.photos as
      | { before?: string[]; after?: string[] }
      | undefined;
    const before = photos?.before ?? [];
    const after = photos?.after ?? [];
    if (before.length === 0 || after.length === 0) {
      return { ok: false, reason: "evidence-photos-required" };
    }
    return {
      ok: true,
      data: {
        evidence: { before, after },
        contract: HOUSEKEEPING_EVIDENCE,
        requiredMet: before.length <= HOUSEKEEPING_EVIDENCE.beforePhoto.maxCount
          && after.length <= HOUSEKEEPING_EVIDENCE.afterPhoto.maxCount,
      },
    };
  },
};

/* =====================================================================
 * 8 维全息配置（AmmoFactory 装配原料 · 静态审查出厂）
 * ===================================================================== */

/** 家庭深度保洁 · 8 维全息声明（D1~D8，资金守恒/入户背调/加价熔断出厂硬检）。 */
export const HOUSEKEEPING_HOLOGRAPHIC_CONFIG: IHolographicAmmoConfig = {
  ammoId: "housekeeping-v1",
  category: "housekeeping",
  version: "1.0.0",

  /* D1 供给准入（S1 R_AUTH 供给端准入网关） */
  supplyCluster: "C2_IN_HOME",
  workerRequirement: {
    requiredCertificates: ["HEALTH_CERT"],
    minSafetyScore: 60,
    requiredIdentityLevel: "REAL_NAME",
    isPoliceVerified: true,
  },

  /* D2 计价与护栏（价格透明优先 + 防坐地起价） */
  pricingModel: { kind: "HOURLY", rateYuan: 60, minHours: 2 },
  pricingParams: { baseRate: 60, minHours: 2 },
  minFloorPrice: 12000,
  maxCeilingPrice: 200000,
  maxSurchargeRatio: 0.5,
  creditWaiverRule: {
    allowedCreditDimension: "SAFETY_BACKGROUND",
    maxWaiverPercentage: 0.5,
  },

  /* D3 风控引信（💥 碰炸：进家高财产） */
  fuzePolicy: IMPACT_FUZE_TEMPLATE,

  /* D4 传感降级（零信任物理感知 · 宪法 #10） */
  requiredSensors: ["GPS_GEOFENCE", "WATERMARK_CAMERA"],
  sensorFallbackLadder: {
    GPS_GEOFENCE: ["CELL_TOWER_COARSE_GEO", "MANUAL_BASE_PHOTO_AUDIT"],
    WATERMARK_CAMERA: ["HTML5_NATIVE_FALLBACK"],
  },

  /* D5 正向钩子（HOOK_OPERATOR_REGISTRY 静态白名单解析） */
  forwardHooks: ["OnsiteQuoteHook", "CleaningCheckHook"],

  /* D6 逆向违约阶梯（分阶段退款/车马费/保证金扣划） */
  cancellationTiers: [
    { stage: "BEFORE_MATCH", demanderRefundRatio: 1, providerCompensationYuan: 0, deductDepositRatio: 0 },
    { stage: "AFTER_MATCH_EN_ROUTE", demanderRefundRatio: 0.8, providerCompensationYuan: 20, deductDepositRatio: 0.2 },
    { stage: "ON_SITE", demanderRefundRatio: 0.5, providerCompensationYuan: 0, deductDepositRatio: 0.5 },
    { stage: "IN_SERVICE", demanderRefundRatio: 0, providerCompensationYuan: 0, deductDepositRatio: 1 },
  ],

  /* D7 清算与仲裁（24h 超时代验收 + 分账资金守恒 0.85+0.10+0.05=1.0） */
  autoAcceptanceTimeoutHours: 24,
  splitRules: { providerRatio: 0.85, platformRatio: 0.1, insuranceRatio: 0.05 },

  /* D8 视界与表单（housekeeping 主题 + HousekeepingSlot 座舱插槽） */
  theme: "housekeeping",
  cockpitSlot: "HousekeepingSlot",
};

/* =====================================================================
 * 弹药定义（AmmoFactory 流水线出厂 · 全图冻结不可变发布）
 * ===================================================================== */

/**
 * 家庭深度保洁 · 官方标准弹药（Phase 1 MVP · 8D 全息装配出厂）。
 *
 * 出厂门禁（模块加载期强制）：资金守恒（split 三比合成 1.0 ±1e-9）、
 * C2_IN_HOME 入户一票否决（isPoliceVerified === true）、加价熔断 ≤0.5、
 * 计价护栏 / 违约阶梯 / 钩子白名单——任一不通过即抛错拒绝出厂。
 *
 * 注：AmmoFactory 投影字段（身份/定价/引信/准入/折抵/全息镜像）；派单规则
 * （dispatchRule）与 SOP 覆盖（sop）为工厂投影之外的存量字段，此处显式写入
 * 完整保留（入户实名关键词硬门槛与发布页 SOP 预填语义不因全息化丢失），
 * 再整体 deepFreeze 冻结发布。
 */
const _housekeepingAssembled = assembleAmmo(HOUSEKEEPING_HOLOGRAPHIC_CONFIG);
if (!_housekeepingAssembled.ok) {
  throw new Error(
    `[AmmoFactory] housekeeping-v1 出厂被拒: ${_housekeepingAssembled.errors.join("; ")}`
  );
}

export const housekeepingAmmo: Readonly<IAmmoDefinition> = deepFreeze({
  ..._housekeepingAssembled.ammo,
  dispatchRule: {
    weights: { distance: 40, credit: 25, custom: 20, verifiedBonus: 5 },
    hardGates: {
      requiresVerified: ["家政保洁", "上门"],
      banned: true,
      online: true,
    },
  },
  sop: {
    depositDefault: true,
    expiresInMs: 2 * 3600_000,
    capacityDefault: 1,
    maxRounds: 3,
    reviewWindowMs: 48 * 3600_000,
    depositRate: 0.2,
  },
});