/**
 * 第一枚官方标准弹药：housekeeping-v1（家庭深度保洁 · 上门服务）。
 *
 * 存量资产升级仪式（D-7 关闭）：
 *   出处 = `src/lib/protocol/protocols/housekeeping.ts`（250 行垂直 SOP，
 *   仍被 `lib/protocol/registry.ts` 引用，原位保留）+ `docs/contract-engine-state-machine.md`
 *   资金状态机（7 态 16 转换）。本文件以 IAmmoDefinition 声明式装填重新
 *   投影升级，双轨并行不破坏既有引用方。
 *
 * 装填清单（人类创始人注入 Phase 1 MVP）：
 *   - 类目 housekeeping · 挂载 💥 IMPACT_FUZE_TEMPLATE（碰炸引信：进家高财产）。
 *   - 计价 HOURLY 复合（0 门槛 2 小时起，映射存量 funding full_prepay 语义）。
 *   - IN_SERVICE 阶段 BEFORE：OnsiteQuoteHook —— 现场增项报价（BLOCK 未确认）。
 *   - INSPECTED 阶段 AFTER：CleaningCheckHook —— 完工双向拍照与验收（SKIP 证据收集）。
 */

import type {
  IAmmoDefinition,
  ISubEventContext,
  ISubEventHook,
  ISubEventResult,
} from "../types/ammo-schema.ts";
import { IMPACT_FUZE_TEMPLATE } from "../types/fuze-policy.ts";

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
 * 五态伴生钩子
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
 * 弹药定义
 * ===================================================================== */

/** 家庭深度保洁 · 官方标准弹药（Phase 1 MVP）。 */
export const housekeepingAmmo: IAmmoDefinition = {
  ammoId: "housekeeping-v1",
  category: "housekeeping",
  version: "1.0.0",
  fiveStateHooks: [onsiteQuoteHook, cleaningCheckHook],
  pricingModel: { kind: "HOURLY", rateYuan: 60, minHours: 2 },
  fuzePolicy: IMPACT_FUZE_TEMPLATE,
  dispatchRule: {
    weights: { distance: 40, credit: 25, custom: 20, verifiedBonus: 5 },
    hardGates: {
      requiresVerified: ["家政保洁", "上门"],
      banned: true,
      online: true,
    },
  },
  /**
   * S1 供给端准入门槛（R_AUTH）：进家类目强制实名 + 安全背调分门槛 +
   * 健康证（WorkerWorkbench 按此拦截未达标服务者接单）。
   */
  workerRequirement: {
    requiredCertificates: ["HEALTH_CERT"],
    minSafetyScore: 60,
    requiredIdentityLevel: "REAL_NAME",
  },
  /**
   * 定向信用折抵（信用飞轮兑换闸门）：仅允许「安全背调分」维度折抵押金
   * （最高 50%），禁止跨维度通兑（防信用错位套利）。
   */
  creditWaiverRule: {
    allowedCreditDimension: "SAFETY_BACKGROUND",
    maxWaiverPercentage: 0.5,
  },
  /** 防坐地起价：现场增项金额上限 = 订单基础金额的 50%（S2 熔断）。 */
  maxSurchargeRatio: 0.5,
  /** 运力池聚类：入户重背调（强合规引信 + workerRequirement 三闸）。 */
  supplyCluster: "C2_IN_HOME",
  sop: {
    depositDefault: true,
    expiresInMs: 2 * 3600_000,
    capacityDefault: 1,
    maxRounds: 3,
    reviewWindowMs: 48 * 3600_000,
    depositRate: 0.2,
  },
};