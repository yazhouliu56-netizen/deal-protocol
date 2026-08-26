/**
 * 第三枚官方标准弹药：companion-v1（同城陪玩 / 交友 · 高人身风险）。
 *
 * 三大标杆弹药大满贯收官弹：纯 📡 近炸引信（PROXIMITY_FUZE_TEMPLATE），
 * 与前端 `CompanionSlot.tsx`（隐私盾 / 伪装假电话 / 300m 离开距离 / 一键拉黑）
 * 达成 100% 契约闭环——白皮书 §5.7 陪玩列（高人身风险 · 夜幕紫）。
 *
 * 8D 全息化（人类创始人注入 2026-08-16 · 方案 A 三大标杆弹药全量流水线化归一）：
 *   - D1 供给准入：C1_MOBILITY 同城移动轻履约（实名 + 安全背调分 ≥65）。
 *   - D2 计价与护栏：HOURLY ¥100/h 起步 1h 超时 ×1.2；地板 100 元 /
 *     天花板 3000 元（10000/300000 分）。
 *   - D3 风控引信：📡 PROXIMITY_FUZE_TEMPLATE（近炸：STANDARD 背调 +
 *     虚拟号 + 模糊定位 + 敏感词干预 + SOS 四联动）。
 *   - D4 传感降级：GPS 围栏 + 实时录音；围栏失效回退离开人工确认。
 *   - D5 正向钩子：PrivacyShieldHook + DepartureFinishHook（白名单算子出厂）。
 *   - D6 逆向违约阶梯：匹配前 100% 退；途中退 85% 扣 15% 补偿。
 *   - D7 清算与仲裁：2h 超时自动代结；分账三比 0.85/0.12/0.03（守恒）。
 *   - D8 视界与表单：companion 主题 + CompanionSlot 履约座舱插槽。
 */

import type {
  IAmmoDefinition,
  IHolographicAmmoConfig,
  ISubEventContext,
  ISubEventHook,
  ISubEventResult,
} from "../types/ammo-schema.ts";
import { PROXIMITY_FUZE_TEMPLATE } from "../types/fuze-policy.ts";
import { assembleAmmo, deepFreeze } from "./factory.ts";

/* =====================================================================
 * 弹药领域常量（与前端 CompanionSlot 契约对齐，白皮书 §5.7 陪玩列）
 * ===================================================================== */

/** 默认时薪（¥100/h）与起步时长（1 小时）。 */
export const COMPANION_HOURLY_RATE = 100;
export const COMPANION_MIN_HOURS = 1;

/** 超时计费系数（超出起步时长的部分 ×1.2）。 */
export const COMPANION_OVERTIME_RATE = 1.2;

/**
 * 离开安全距离（米）：双方离开 300m 视为服务安全结束，
 * 触发自动结账停表（CompanionSlot 默认 departureDistanceMeters = 300 闭环）。
 */
export const COMPANION_DEPARTURE_METERS = 300;

/** 隐私盾三闸检查清单（PrivacyShieldHook 逐闸校验）。 */
export const COMPANION_SAFETY_GATES = [
  { gate: "virtualNumberBound", label: "虚拟号已绑定（48h 会话）" },
  { gate: "journeyGuardArmed", label: "实时行程守护已开启" },
  { gate: "sensitiveWordListening", label: "敏感词 AI 监听就绪" },
] as const;

/* =====================================================================
 * 存量领域钩子（富语义实现，保留导出供直接调用与直测）
 *
 * 8D 全息化后弹药本体（fiveStateHooks）改由 AmmoFactory 算子白名单解析
 * （红线 1：D5 forwardHooks 仅允许从 HOOK_OPERATOR_REGISTRY 静态解析）。
 * 本组富钩子（隐私盾三闸明细、300m 停表计费与信用奖励）作为领域语义库
 * 保留，引擎级流转已由算子接管。
 * ===================================================================== */

export const PRIVACY_SHIELD_HOOK_ID = "companion.privacy-shield";
export const DEPARTURE_FINISH_HOOK_ID = "companion.departure-finish";

/** 隐私盾就绪载荷（payload.privacyShield，与 COMPANION_SAFETY_GATES 对齐）。 */
export interface CompanionPrivacyShieldPayload {
  /** 虚拟号已绑定（base/comm/privacyNumber 48h 会话）。 */
  virtualNumberBound?: boolean;
  /** 实时行程守护已开启（位置共享给紧急联系人）。 */
  journeyGuardArmed?: boolean;
  /** 敏感词 AI 监听就绪（对话鉴言降级链就位）。 */
  sensitiveWordListening?: boolean;
}

/** 离开停表载荷（payload.departure，DepartureFinishHook 输入）。 */
export interface CompanionDeparturePayload {
  /** 双方当前距离（米）。 */
  distanceMeters: number;
  /** 服务开始时刻（epoch ms，停表计费用）。 */
  startedAt: number;
  /** 服务结束时刻（epoch ms，缺省 = 跃迁时）。 */
  endedAt?: number;
  /** 实际时薪覆盖（缺省 = COMPANION_HOURLY_RATE）。 */
  rateYuan?: number;
  /** 超时系数覆盖（缺省 = COMPANION_OVERTIME_RATE）。 */
  overtimeRate?: number;
}

/**
 * 隐私盾三闸校验钩子（MATCHED → IN_SERVICE 前置校验，BLOCK 降级）。
 *
 * 语义（宪法 #4 引信跟弹药走 + #8 隐私血液规则）：
 *   - 无载荷或载荷缺失 → 校验失败（防护未确认不得开始陪玩服务）；
 *   - 三闸任一未就绪 → 校验失败并列出缺项闸名（禁止裸奔履约）；
 *   - 三闸全就绪 → 放行，透传隐私盾武装确认（驱动前端 CompanionSlot
 *     的 isPrivacyShieldArmed = true 显式闭环）。
 */
export const privacyShieldHook: ISubEventHook = {
  hookId: PRIVACY_SHIELD_HOOK_ID,
  on: { to: "IN_SERVICE" },
  phase: "BEFORE",
  fallback: "BLOCK",
  run: (ctx: ISubEventContext): ISubEventResult => {
    const shield = ctx.payload?.privacyShield as CompanionPrivacyShieldPayload | undefined;
    if (!shield) return { ok: false, reason: "privacy-shield-required" };
    const missing = COMPANION_SAFETY_GATES.filter((g) => shield[g.gate] !== true);
    if (missing.length > 0) {
      return {
        ok: false,
        reason: `privacy-shield-not-armed: ${missing.map((m) => m.gate).join(",")}`,
      };
    }
    return {
      ok: true,
      data: {
        armed: true,
        gates: COMPANION_SAFETY_GATES.map((g) => g.gate),
        journeyGuard: shield.journeyGuardArmed === true,
      },
    };
  },
};

/**
 * 离开停表结算钩子（→ SETTLED 后置结算，SKIP 降级）。
 *
 * 语义（白皮书 §5.7 陪玩列 5：300m 脱离安全距离自动停表）：
 *   - 核验双方离开 COMPANION_DEPARTURE_METERS 安全距离：不满足 → 记
 *     reason（AFTER 副作用不阻断终局，资金仍可结算，违规留痕待争议）；
 *   - 满足 → 自动结账停表：起步时长按时薪计费，超出部分 ×超时系数，
 *     生成守约信用分奖励载荷（credit.bonus，L2-M6 飞轮）。
 * 载荷：payload.departure = CompanionDeparturePayload。
 */
export const departureFinishHook: ISubEventHook = {
  hookId: DEPARTURE_FINISH_HOOK_ID,
  on: { to: "SETTLED" },
  phase: "AFTER",
  fallback: "SKIP",
  run: (ctx: ISubEventContext): ISubEventResult => {
    const departure = ctx.payload?.departure as CompanionDeparturePayload | undefined;
    if (!departure || typeof departure.distanceMeters !== "number") {
      return { ok: false, reason: "departure-data-required" };
    }
    if (departure.distanceMeters < COMPANION_DEPARTURE_METERS) {
      return {
        ok: false,
        reason: `departure-within-safe-radius: ${departure.distanceMeters}m < ${COMPANION_DEPARTURE_METERS}m`,
      };
    }
    const rate = departure.rateYuan ?? COMPANION_HOURLY_RATE;
    const overtimeRate = departure.overtimeRate ?? COMPANION_OVERTIME_RATE;
    const startedAt = departure.startedAt;
    const fallbackAt = typeof ctx.payload?.at === "number" ? ctx.payload.at : Date.now();
    const endedAt = departure.endedAt ?? fallbackAt;
    const elapsedMinutes = Math.max(0, Math.round((endedAt - startedAt) / 60_000));
    const elapsedHours = elapsedMinutes / 60;
    const baseYuan = COMPANION_MIN_HOURS * rate;
    const overtimeHours = Math.max(0, elapsedHours - COMPANION_MIN_HOURS);
    const billedYuan = Math.round((baseYuan + overtimeHours * rate * overtimeRate) * 100) / 100;
    return {
      ok: true,
      data: {
        stoppedAt: endedAt,
        elapsedMinutes,
        safeDistanceMeters: departure.distanceMeters,
        billedYuan,
        rateYuan: rate,
        overtimeRate,
        credit: { bonus: 5, note: "安全结束 · 守信奖励（L2-M6 飞轮）" },
      },
    };
  },
};

/* =====================================================================
 * 8 维全息配置（AmmoFactory 装配原料 · 静态审查出厂）
 * ===================================================================== */

/** 同城陪玩 · 8 维全息声明（D1~D8，资金守恒/加价熔断出厂硬检）。 */
export const COMPANION_HOLOGRAPHIC_CONFIG: IHolographicAmmoConfig = {
  ammoId: "companion-v1",
  category: "companion",
  version: "1.0.0",

  /* D1 供给准入（同城移动轻履约 · 实名 + 安全分 0-100 量表 65） */
  supplyCluster: "C1_MOBILITY",
  workerRequirement: {
    requiredIdentityLevel: "REAL_NAME",
    minSafetyScore: 65,
  },

  /* D2 计价与护栏（HOURLY ¥100/h 起步 1h 超时 ×1.2 · 地板 100 / 天花板 3000 元） */
  pricingModel: { kind: "HOURLY", rateYuan: COMPANION_HOURLY_RATE, minHours: COMPANION_MIN_HOURS },
  pricingParams: {
    baseRate: COMPANION_HOURLY_RATE,
    minHours: COMPANION_MIN_HOURS,
    overtimeMultiplier: COMPANION_OVERTIME_RATE,
  },
  minFloorPrice: 10000,
  maxCeilingPrice: 300000,

  /* D3 风控引信（纯 📡 近炸：STANDARD 背调 + 虚拟号 + 模糊定位 + SOS） */
  fuzePolicy: PROXIMITY_FUZE_TEMPLATE,

  /* D4 传感降级（GPS 围栏 + 实时录音；围栏失效回退离开人工确认） */
  requiredSensors: ["GPS_GEOFENCE", "REAL_TIME_AUDIO"],
  sensorFallbackLadder: {
    GPS_GEOFENCE: ["PROXIMITY_DEPARTURE_MANUAL_CHECK"],
  },

  /* D5 正向钩子（HOOK_OPERATOR_REGISTRY 静态白名单解析） */
  forwardHooks: ["PrivacyShieldHook", "DepartureFinishHook"],

  /* D6 逆向违约阶梯（匹配前全退；途中退 85% 扣 15% 补偿） */
  cancellationTiers: [
    { stage: "BEFORE_MATCH", demanderRefundRatio: 1, providerCompensationYuan: 0, deductDepositRatio: 0 },
    { stage: "AFTER_MATCH_EN_ROUTE", demanderRefundRatio: 0.85, providerCompensationYuan: 0, deductDepositRatio: 0.15 },
  ],

  /* D6.5 SLA 阶段时间纪律（Microkernel 2.0 战役 1 · 陪玩轻履约：接单20min/出发40min） */
  slaPhases: {
    ACCEPTED: 1200,
    DEPARTED: 2400,
  },
  fundingMode: "commitment",
  /* D7 清算与仲裁（2h 超时自动代结 + 分账 0.85+0.12+0.03=1.0） */
  autoAcceptanceTimeoutHours: 2,
  splitRules: { providerRatio: 0.85, platformRatio: 0.12, insuranceRatio: 0.03 },

  /* D8 视界与表单（companion 主题 + CompanionSlot 座舱插槽） */
  theme: "companion",
  cockpitSlot: "CompanionSlot",
};

/* =====================================================================
 * 弹药定义（AmmoFactory 流水线出厂 · 全图冻结不可变发布）
 * ===================================================================== */

/**
 * 同城陪玩 · 官方标准弹药（Phase 3 收官 · 8D 全息装配出厂）。
 *
 * 出厂门禁（模块加载期强制）：资金守恒（0.85+0.12+0.03=1.0 ±1e-9）、
 * 计价护栏 / 违约阶梯 / 钩子白名单——任一不通过即抛错拒绝出厂。
 *
 * 注：派单规则（dispatchRule）与 SOP 覆盖（sop）为工厂投影之外的存量
 * 字段，此处显式写入完整保留（陪玩/交友/约会实名关键词硬门槛与轻履约
 * SOP 语义不因全息化丢失），再整体 deepFreeze 冻结发布。
 */
const _companionAssembled = assembleAmmo(COMPANION_HOLOGRAPHIC_CONFIG);
if (!_companionAssembled.ok) {
  throw new Error(
    `[AmmoFactory] companion-v1 出厂被拒: ${_companionAssembled.errors.join("; ")}`
  );
}

export const companionAmmo: Readonly<IAmmoDefinition> = deepFreeze({
  ..._companionAssembled.ammo,
  dispatchRule: {
    weights: { distance: 25, credit: 40, custom: 25, verifiedBonus: 10 },
    hardGates: {
      requiresVerified: ["陪玩", "交友", "约会"],
      banned: true,
      online: true,
    },
    starBonus: { starMin: 4.2, completionMin: 0.75, bonus: 10 },
  },
  sop: {
    depositDefault: false,
    expiresInMs: 4 * 3600_000,
    capacityDefault: 1,
    maxRounds: 3,
    reviewWindowMs: 24 * 3600_000,
    depositRate: 0,
  },
});