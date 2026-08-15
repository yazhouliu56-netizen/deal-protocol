/**
 * 第三枚官方标准弹药：companion-v1（同城陪玩 / 交友 · 高人身风险）。
 *
 * 三大标杆弹药大满贯收官弹：纯 📡 近炸引信（PROXIMITY_FUZE_TEMPLATE），
 * 与前端 `CompanionSlot.tsx`（隐私盾 / 伪装假电话 / 300m 离开距离 / 一键拉黑）
 * 达成 100% 契约闭环——白皮书 §5.7 陪玩列（高人身风险 · 夜幕紫）。
 *
 * 装填清单（人类创始人注入 Phase 3）：
 *   - 类目 companion（注册表直挂键：companion / dating / escort）。
 *   - 挂载 📡 近炸引信模板：STANDARD 背调 + 虚拟号掩码 + 模糊定位 +
 *     AI 敏感词干预 + 一键 SOS 四联动（防护随弹药走，宪法 #4/#8）。
 *   - 计价 HOURLY（默认 ¥100/h，起步 1 小时；超时系数 1.2）。
 *   - IN_SERVICE 阶段 BEFORE：PrivacyShieldHook —— 隐私盾三闸校验
 *     （虚拟号绑定 / 行程守护 / 敏感词监听），未就绪 BLOCK 阻止进入服务。
 *   - SETTLED 阶段 AFTER：DepartureFinishHook —— 核验双方离开 300m
 *     安全距离，自动结账停表（含超时 ×1.2）并发放守约信用分奖励。
 */

import type {
  IAmmoDefinition,
  ISubEventContext,
  ISubEventHook,
  ISubEventResult,
} from "../types/ammo-schema.ts";
import { PROXIMITY_FUZE_TEMPLATE } from "../types/fuze-policy.ts";

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
 * 五态伴生钩子
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
 * 弹药定义
 * ===================================================================== */

/** 同城陪玩 · 官方标准弹药（Phase 3 收官，纯 📡 近炸引信）。 */
export const companionAmmo: IAmmoDefinition = {
  ammoId: "companion-v1",
  category: "companion",
  version: "1.0.0",
  fiveStateHooks: [privacyShieldHook, departureFinishHook],
  pricingModel: { kind: "HOURLY", rateYuan: COMPANION_HOURLY_RATE, minHours: COMPANION_MIN_HOURS },
  fuzePolicy: PROXIMITY_FUZE_TEMPLATE,
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
};
