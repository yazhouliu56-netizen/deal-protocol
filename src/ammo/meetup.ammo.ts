/**
 * 第二枚官方标准弹药：meetup-social-v1（组局社交 · 同城搭子 / 麻将组局）。
 *
 * 存量资产升级仪式（D-7 关闭）：
 *   出处 = `src/lib/protocol/protocols/dating.ts`（202 行垂直 SOP：commitment
 *   双押金模式 / dualDeposit 1:1 双方全额押金 / confirm_arrival 到场确认 /
 *   gps_track 定位证据 / 4 维主观评价 / 三级争议通道）。该协议仍被
 *   `lib/protocol/registry.ts` 引用，原位保留，双轨并行不破坏引用方。
 *
 * 装填清单（人类创始人注入 Phase 2）：
 *   - 类目 social · 挂载 ⏳ DELAY + 📡 PROXIMITY 双引信并联：
 *       ⏳ 延期引信：30% 预付定金冻结（AA 保障金）+ 500m LBS 电子围栏到场
 *         解锁 + 反赌反诈过滤（映射存量 dualDeposit 双押金 / confirm_arrival）；
 *       📡 近炸引信：虚拟号脱敏 + 模糊定位 + AI 敏感词干预 + 一键 SOS 联动。
 *   - 计价 PER_SEAT（按人头人均 AA 分摊，映射存量 commitment 押金语义）。
 *   - 防鸽子（拼单锁定前置）：MATCHED 前由调用方执行引信核验
 *     （evaluateAmmoFuze：advanceFreeze 未到账 → 阻断进入 MATCHED）。
 *   - IN_SERVICE 阶段 BEFORE：ArrivalCheckHook —— 到场验真钩子
 *     （LBS 围栏命中 / 双方扫码确认到场），解除延期引信定金冻结（BLOCK）。
 *   - SETTLED 阶段 AFTER：AASplitSettleHook —— AA 动态结算钩子
 *     （自动分账放款给场地方/组织者，守约记录回写信用引擎 L2-M6 飞轮）。
 */

import type {
  IAmmoDefinition,
  ISubEventContext,
  ISubEventHook,
  ISubEventResult,
} from "../types/ammo-schema.ts";
import type { IFuzePolicy } from "../types/fuze-policy.ts";
import { DELAY_FUZE_TEMPLATE, PROXIMITY_FUZE_TEMPLATE } from "../types/fuze-policy.ts";

/* =====================================================================
 * 存量协议资产投影升级（出处：protocols/dating.ts）
 * ===================================================================== */

/** 组局服务阶段六态（与家政先例同构，索引即序号；ARRIVED 对接围栏解锁）。 */
export const MEETUP_STAGES = [
  "NOT_ACCEPTED",
  "ACCEPTED",
  "DEPARTED",
  "ARRIVED",
  "IN_PROGRESS",
  "DONE",
] as const;
export type MeetupStage = (typeof MEETUP_STAGES)[number];

/**
 * 组局退款规则（存量 dualDeposit 双押金 1:1 语义投影：
 * 未成局全退 / 爽约方押金全失归守约方 / 到场后互不罚）。
 */
export const MEETUP_REFUND_RULES = [
  { stage: 0, policy: "full-refund", note: "未成局：全员 AA 保障金原路退回" },
  { stage: 1, policy: "full-refund", note: "成局未出发：参与方可无损退（24h 外）" },
  { stage: 2, policy: "no-show-penalty", note: "已出发：爽约方保障金全失，归守约方" },
  { stage: 3, policy: "arrived-refund", note: "已到场：各自保障金解冻，取消互不罚" },
  { stage: 4, policy: "arrived-refund", note: "进行中：按 AA 结算，到场双方按责分摊" },
  { stage: 5, policy: "settle", note: "已完成：AA 分账放款给场地方/组织者" },
] as const;

/** 到场验真证据契约（存量 evidence gps_track + photo 投影）。 */
export const MEETUP_EVIDENCE = {
  arrivalGps: { label: "到场定位（LBS 围栏命中）", required: true },
  arrivalScan: { label: "双方扫码确认到场", required: false, maxCount: 1 },
  activityPhoto: { label: "活动现场照片", required: false, maxCount: 3 },
} as const;

/* =====================================================================
 * 双引信并联（⏳ 延期 + 📡 近炸，防护等级取最高）
 * ===================================================================== */

/**
 * meetup 专属双引信策略：⏳ 延期（DELAY 模板：预付冻结 0.3 + 500m 围栏 +
 * 反赌反诈）与 📡 近炸（PROXIMITY 模板：STANDARD 背调 + 虚拟号 + 模糊定位 +
 * 敏感词干预 + SOS 全联动）并集装填，fuzeTypes 双类型并联、防护等级取最高。
 * 注意：两模板均为完整策略对象，逐段取字段，不可直接整体 spread 后者
 * （PROXIMITY 模板会把 DELAY 段的 advanceFreeze/geoFence 覆盖为默认关）。
 */
export const MEETUP_DUAL_FUZE: IFuzePolicy = {
  ...DELAY_FUZE_TEMPLATE,
  ...PROXIMITY_FUZE_TEMPLATE,
  advanceFreeze: DELAY_FUZE_TEMPLATE.advanceFreeze,
  geoFence: DELAY_FUZE_TEMPLATE.geoFence,
  antiFraudFilter: DELAY_FUZE_TEMPLATE.antiFraudFilter,
  fuzeId: "fuze-meetup-dual",
  fuzeTypes: ["DELAY", "PROXIMITY"],
};

/* =====================================================================
 * 五态伴生钩子
 * ===================================================================== */

export const ARRIVAL_CHECK_HOOK_ID = "meetup.arrival-check";
export const AA_SPLIT_SETTLE_HOOK_ID = "meetup.aa-split-settle";

/** 到场验真载荷（payload.arrival）。 */
export interface MeetupArrivalPayload {
  /** LBS 围栏命中（设备进 500m 半径）。 */
  viaGps?: boolean;
  /** 双方扫码确认码（≥8 位视为有效确认）。 */
  scanCode?: string;
  /** 已到场并签到的参与人数。 */
  checkedInSeats?: number;
}

/** AA 结算载荷（payload.settlement）。 */
export interface MeetupSettlement {
  /** 场地/组织方总成本（¥）。 */
  venueCostYuan: number;
  /** 每个座位：支付情况 + 是否到场。 */
  seats: { userId: string; paidYuan: number; present: boolean }[];
  /** 违约赔付（爽约场景：breacher 押金 forfeitYuan 转 receiver）。 */
  penalty?: { breacherId: string; forfeitYuan: number; receiverId: string };
}

/**
 * 到场验真钩子（MATCHED → IN_SERVICE 前置校验，BLOCK 降级）。
 *
 * 语义（对齐存量 confirm_arrival + gps_track）：
 *   - LBS 围栏命中（arrival.viaGps === true）或双方扫码确认（scanCode
 *     ≥8 位）任一成立 → 验真通过，解除延期引信定金冻结（透传解锁结果）；
 *   - 均未验真 → BLOCK 阻止进入服务（未到场不得开始履约）；
 *   - 超时爽约由上层转 BREACH_SETTLED 终止事件（本钩子不判定时间）。
 */
export const arrivalCheckHook: ISubEventHook = {
  hookId: ARRIVAL_CHECK_HOOK_ID,
  on: { to: "IN_SERVICE" },
  phase: "BEFORE",
  fallback: "BLOCK",
  run: (ctx: ISubEventContext): ISubEventResult => {
    const arrival = ctx.payload?.arrival as MeetupArrivalPayload | undefined;
    if (!arrival) return { ok: false, reason: "arrival-verification-required" };
    const gpsHit = arrival.viaGps === true;
    const scanHit =
      typeof arrival.scanCode === "string" && arrival.scanCode.length >= 8;
    if (!gpsHit && !scanHit) {
      return { ok: false, reason: "arrival-not-verified" };
    }
    return {
      ok: true,
      data: {
        unlocked: true,
        checkedInSeats: arrival.checkedInSeats ?? 1,
        method: gpsHit ? "gps" : "scan",
      },
    };
  },
};

/**
 * AA 动态结算钩子（→ SETTLED 后置分账，SKIP 降级）。
 *
 * 语义（对齐存量 commitment 双押金 + 分账语义）：
 *   - 到场者按 venueCostYuan / 实到人数均摊（settleYuan = 已付 - 应摊，
 *     正为退款、负为补缴）；
 *   - 违约场景（BREACH_SETTLED 终止事件载荷带 penalty）：
 *     爽约方 forfeitYuan 归守约方，同时生成守约/违约信用回写记录
 *     （data.credit，供上层接入 m07 信用引擎，L2-M6 飞轮）。
 * 载荷：payload.settlement = MeetupSettlement。
 */
export const aaSplitSettleHook: ISubEventHook = {
  hookId: AA_SPLIT_SETTLE_HOOK_ID,
  on: { to: "SETTLED" },
  phase: "AFTER",
  fallback: "SKIP",
  run: (ctx: ISubEventContext): ISubEventResult => {
    const settlement = ctx.payload?.settlement as MeetupSettlement | undefined;
    if (!settlement || settlement.venueCostYuan <= 0) {
      return { ok: false, reason: "settlement-required" };
    }
    const present = settlement.seats.filter((s) => s.present !== false);
    const perHead = settlement.venueCostYuan / Math.max(1, present.length);
    const aa = present.map((s) => ({
      userId: s.userId,
      paidYuan: s.paidYuan,
      shareYuan: perHead,
      settleYuan: Math.round((s.paidYuan - perHead) * 100) / 100,
    }));
    const penalty = settlement.penalty;
    return {
      ok: true,
      data: {
        aa,
        penalty: penalty ?? null,
        credit: penalty
          ? {
              honored: [{ userId: penalty.receiverId, note: "守约获偿" }],
              breached: [{ userId: penalty.breacherId, forfeitYuan: penalty.forfeitYuan }],
            }
          : {
              honored: present.map((s) => ({ userId: s.userId, note: "到场守约" })),
              breached: [],
            },
      },
    };
  },
};

/* =====================================================================
 * 弹药定义
 * ===================================================================== */

/** 组局社交 · 官方标准弹药（Phase 2 标杆，⏳ 延期 + 📡 近炸双引信）。 */
export const meetupAmmo: IAmmoDefinition = {
  ammoId: "meetup-social-v1",
  category: "social",
  version: "1.0.0",
  fiveStateHooks: [arrivalCheckHook, aaSplitSettleHook],
  pricingModel: { kind: "PER_SEAT", perSeatYuan: 80, minSeats: 2 },
  fuzePolicy: MEETUP_DUAL_FUZE,
  dispatchRule: {
    weights: { distance: 30, credit: 35, custom: 25, verifiedBonus: 10 },
    hardGates: {
      requiresVerified: ["社交", "约会", "组局"],
      banned: true,
      online: true,
    },
    starBonus: { starMin: 4, completionMin: 0.7, bonus: 10 },
  },
  /**
   * 定向信用折抵（信用飞轮兑换闸门）：仅允许「守时分」维度折抵预付定金
   * （最高 50%，如 30% 预付金可折 15%，剩余仍资金锁定）——守约资产
   * 定向兑现，禁止跨维度通兑（防信用错位套利）。
   */
  creditWaiverRule: {
    allowedCreditDimension: "PUNCTUALITY",
    maxWaiverPercentage: 0.5,
  },
  /** 运力池聚类：同城移动轻履约（LBS 围栏到场解锁）。 */
  supplyCluster: "C1_MOBILITY",
  sop: {
    depositDefault: true,
    expiresInMs: 24 * 3600_000,
    capacityDefault: 4,
    buffSeats: 1,
    maxRounds: 2,
    reviewWindowMs: 24 * 3600_000,
    depositRate: 0.3,
  },
};
