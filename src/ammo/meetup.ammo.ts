/**
 * 第二枚官方标准弹药：meetup-social-v1（组局社交 · 同城搭子 / 麻将组局）。
 *
 * 存量资产升级仪式（D-7 关闭）：
 *   出处 = `src/lib/protocol/protocols/dating.ts`（202 行垂直 SOP：commitment
 *   双押金模式 / dualDeposit 1:1 双方全额押金 / confirm_arrival 到场确认 /
 *   gps_track 定位证据 / 4 维主观评价 / 三级争议通道）。该协议仍被
 *   `lib/protocol/registry.ts` 引用，原位保留，双轨并行不破坏引用方。
 *
 * 8D 全息化（人类创始人注入 2026-08-16 · 方案 A 三大标杆弹药全量流水线化归一）：
 *   - D1 供给准入：C1_MOBILITY 同城移动轻履约（BASIC 实名即可成局）。
 *   - D2 计价与护栏：PER_SEAT 人均 AA（80 元/座，至少 2 人）；地板 30 元 /
 *     天花板 1000 元（3000/100000 分）；守时分定向折抵 ≤50%。
 *   - D3 风控引信：⏳ 延期 + 📡 近炸双引信并联（MEETUP_DUAL_FUZE）。
 *   - D4 传感降级：GPS 围栏 + NFC 碰碰；围栏失效回退扫码核验。
 *   - D5 正向钩子：ArrivalCheckHook + AASplitSettleHook（白名单算子出厂）。
 *   - D6 逆向违约阶梯：匹配前 100% 退；服务中爽约扣 30% 补偿守约方。
 *   - D7 清算与仲裁：6h 超时自动成局/关闭；分账三比 0.88/0.10/0.02（守恒）。
 *   - D8 视界与表单：meetup 主题 + MeetupSlot 履约座舱插槽。
 */

import type {
  IAmmoDefinition,
  IHolographicAmmoConfig,
  ISubEventContext,
  ISubEventHook,
  ISubEventResult,
} from "../types/ammo-schema.ts";
import type { IFuzePolicy } from "../types/fuze-policy.ts";
import { DELAY_FUZE_TEMPLATE, PROXIMITY_FUZE_TEMPLATE } from "../types/fuze-policy.ts";
import { assembleAmmo, deepFreeze } from "./factory.ts";

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
 * 存量领域钩子（富语义实现，保留导出供直接调用与直测）
 *
 * 8D 全息化后弹药本体（fiveStateHooks）改由 AmmoFactory 算子白名单解析
 * （红线 1：D5 forwardHooks 仅允许从 HOOK_OPERATOR_REGISTRY 静态解析）。
 * 本组富钩子（围栏/扫码验真、AA 多退少补与违约赔付）作为领域语义库保留，
 * 引擎级流转已由算子接管。
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
 * 8 维全息配置（AmmoFactory 装配原料 · 静态审查出厂）
 * ===================================================================== */

/** 组局社交 · 8 维全息声明（D1~D8，资金守恒/加价熔断出厂硬检）。 */
export const MEETUP_HOLOGRAPHIC_CONFIG: IHolographicAmmoConfig = {
  ammoId: "meetup-social-v1",
  category: "social",
  version: "1.0.0",

  /* D1 供给准入（同城移动轻履约，BASIC 实名即可） */
  supplyCluster: "C1_MOBILITY",
  workerRequirement: {
    requiredIdentityLevel: "BASIC",
  },

  /* D2 计价与护栏（PER_SEAT 人均 AA · 地板 30 元 / 天花板 1000 元） */
  pricingModel: { kind: "PER_SEAT", perSeatYuan: 80, minSeats: 2 },
  pricingParams: { perSeatCost: 80 },
  minFloorPrice: 3000,
  maxCeilingPrice: 100000,
  creditWaiverRule: {
    allowedCreditDimension: "PUNCTUALITY",
    maxWaiverPercentage: 0.5,
  },

  /* D3 风控引信（⏳ 延期 + 📡 近炸双引信并联） */
  fuzePolicy: MEETUP_DUAL_FUZE,

  /* D4 传感降级（GPS 围栏 + NFC 碰碰；围栏失效回退扫码核验） */
  requiredSensors: ["GPS_GEOFENCE", "NFC_BUMP"],
  sensorFallbackLadder: {
    GPS_GEOFENCE: ["QR_SCAN_VERIFICATION"],
  },

  /* D5 正向钩子（HOOK_OPERATOR_REGISTRY 静态白名单解析） */
  forwardHooks: ["ArrivalCheckHook", "AASplitSettleHook"],

  /* D6 逆向违约阶梯（匹配前全退；服务中爽约扣 30% 补守约方） */
  cancellationTiers: [
    { stage: "BEFORE_MATCH", demanderRefundRatio: 1, providerCompensationYuan: 0, deductDepositRatio: 0 },
    { stage: "IN_SERVICE", demanderRefundRatio: 0.7, providerCompensationYuan: 0, deductDepositRatio: 0.3 },
  ],

  /* D7 清算与仲裁（6h 超时自动成局/关闭 + 分账 0.88+0.10+0.02=1.0） */
  autoAcceptanceTimeoutHours: 6,
  splitRules: { providerRatio: 0.88, platformRatio: 0.1, insuranceRatio: 0.02 },

  /* D8 视界与表单（meetup 主题 + MeetupSlot 座舱插槽） */
  theme: "meetup",
  cockpitSlot: "MeetupSlot",
};

/* =====================================================================
 * 弹药定义（AmmoFactory 流水线出厂 · 全图冻结不可变发布）
 * ===================================================================== */

/**
 * 组局社交 · 官方标准弹药（Phase 2 标杆 · 8D 全息装配出厂）。
 *
 * 出厂门禁（模块加载期强制）：资金守恒（0.88+0.10+0.02=1.0 ±1e-9）、
 * 计价护栏 / 违约阶梯 / 钩子白名单——任一不通过即抛错拒绝出厂。
 *
 * 注：派单规则（dispatchRule）与 SOP 覆盖（sop）为工厂投影之外的存量
 * 字段，此处显式写入完整保留（社交/约会/组局实名关键词硬门槛与拼位
 * SOP 语义不因全息化丢失），再整体 deepFreeze 冻结发布。
 */
const _meetupAssembled = assembleAmmo(MEETUP_HOLOGRAPHIC_CONFIG);
if (!_meetupAssembled.ok) {
  throw new Error(
    `[AmmoFactory] meetup-social-v1 出厂被拒: ${_meetupAssembled.errors.join("; ")}`
  );
}

export const meetupAmmo: Readonly<IAmmoDefinition> = deepFreeze({
  ..._meetupAssembled.ammo,
  dispatchRule: {
    weights: { distance: 30, credit: 35, custom: 25, verifiedBonus: 10 },
    hardGates: {
      requiresVerified: ["社交", "约会", "组局"],
      banned: true,
      online: true,
    },
    starBonus: { starMin: 4, completionMin: 0.7, bonus: 10 },
  },
  sop: {
    depositDefault: true,
    expiresInMs: 24 * 3600_000,
    capacityDefault: 4,
    buffSeats: 1,
    maxRounds: 2,
    reviewWindowMs: 24 * 3600_000,
    depositRate: 0.3,
  },
});