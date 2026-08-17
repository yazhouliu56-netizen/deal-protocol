/**
 * S3 SAFE_MONITOR 运行时安全监控总线 · 安全信号聚合器（纯函数，无头适配器）。
 *
 * 商业防脆弱升级（2026-08-15）：在 IN_SERVICE 履约期间统一聚合多维安全信号
 * （LBS 围栏漂移 / 敏感词违规文本 / 虚拟隐私号保护状态），输出统一安全报告，
 * 供前端安全守护徽标（FulfillmentCockpit.securityPillStatus）与运营看板消费。
 *
 * 红线 1：全部判定为确定性计算（Haversine 距离 + 正则敏感词库 + 布尔保护态），
 * 严禁引入任何概率性 LLM 判断；红线 3：本模块为纯函数层，零 UI / Store 依赖。
 */

import {
  checkGeofenceArrival,
  type Coordinates,
} from "../geo/geofence-watcher.ts";
import { autoFlag } from "../risk/moderation.ts";
import type { INormalizedCustomIntent } from "../../types/ammo-schema.ts";

/** 运行时安全输入（IN_SERVICE 期间由上层装配的各路信号）。 */
export interface RuntimeSafetyInput {
  /** 弹药唯一标识（对齐 IAmmoDefinition.ammoId）。 */
  ammoId: string;
  /** 业务单号（wave id / order id）。 */
  orderId: string;
  /** LBS 围栏信号（当前设备坐标 + 履约目标点；缺省 = 无定位信号）。 */
  coords?: {
    current: Coordinates;
    target: Coordinates;
    /** 围栏半径（米；缺省走 geofence-watcher 默认 50m）。 */
    thresholdMeters?: number;
  };
  /** 待检文本（聊天记录 / 备注 / 评论；缺省 = 无文本信号）。 */
  chatText?: string;
  /** 虚拟隐私号保护状态（S1 隐私链路是否武装）。 */
  privacyArmed?: boolean;
  /** 当前时刻（epoch ms；注入化便于测试与事件流回放）。 */
  now?: number;
  /**
   * 需求方非标定制要求（阶段3 语义驯化产物）。存在且 isSensitiveCustomization
   * = true（着装/年龄/性别定制或违禁命中）→ 风险分 +30。
   */
  customRequirements?: INormalizedCustomIntent;
  /**
   * 履约发生的小时数（0-23；缺省 = 未知，不判定夜间加成）。
   * 夜间时段（22:00 - 05:59）风险分 +20。
   */
  hourOfDay?: number;
  /** 双方信用分（demander 需求方 / provider 服务者；缺省 = 未知，不判定）。 */
  creditScores?: { demander: number; provider: number };
  /** 基础风险分（0-100；缺省 0。入户保洁等高风险物理形态由上层注入，如 20）。 */
  baseRiskScore?: number;
}

/** 运行时安全报告（统一输出形态）。 */
export interface IRuntimeSafetyReport {
  ammoId: string;
  orderId: string;
  /** 全维度是否零威胁（isGuarded = activeThreats 为空）。 */
  isGuarded: boolean;
  /** 活跃威胁清单（稳定原因码，供上层 i18n 与运营告警）。 */
  activeThreats: string[];
  /**
   * 安全守护徽标状态（前端三态）：
   * - GUARDED：全维度零威胁，绿色「🛡️ 安全守护中」；
   * - ATTENTION：存在低危告警（如定位漂移 / 隐私未武装），琥珀色提示；
   * - THREAT：存在高危威胁（如敏感词命中），红色警示并联动风控。
   */
  securityPillStatus: "GUARDED" | "ATTENTION" | "THREAT";
  /**
   * 多因子动态综合风险指数（0-100 整数，确定性加权）：
   * 基础分（baseRiskScore，入户保洁 20）+ 敏感定制 +30 + 夜间时段 +20
   * + 任一信用分 < 70 +20；clamp 0-100。
   */
  riskScore: number;
  /**
   * 自适应安全级别（阶段3 引信自适应升级）：
   * - STANDARD：风险分 < 50，维持既有防护；
   * - PROXIMITY_ENHANCED：风险分 ≥ 50 自动升级（即便家政品类），
   *   强制开启虚拟号保护 / 行程守护 / 会话敏感词实时拦截。
   */
  safetyLevel: "STANDARD" | "PROXIMITY_ENHANCED";
  /** 升级后强制武装位（PROXIMITY_ENHANCED 恒 true；STANDARD 反映输入侧缺省 false）。 */
  forceArmed: {
    virtualNumberActive: boolean;
    tripGuardActive: boolean;
    chatModerationActive: boolean;
  };
  /** 履约座舱安全徽标文案（升级态：「🛡️ 强化安全守护中（虚拟号+实时存证）」）。 */
  safetyBadge: string;
  /** 各维度明细（供看板/审计展示）。 */
  details: {
    geofence: {
      isArrived: boolean;
      distanceMeters: number;
      accuracyWarning: boolean;
    } | null;
    textFlag: string | null;
    privacyArmed: boolean | null;
  };
}

/** 稳定威胁原因码常量（上层消费侧直接引用）。 */
export const SAFE_MONITOR_THREAT_CODES = {
  GEOFENCE_NOT_ARRIVED: "geofence-not-arrived",
  GEOFENCE_DRIFT: "geofence-drift",
  SENSITIVE_CONTENT: "sensitive-content",
  PRIVACY_NOT_ARMED: "privacy-not-armed",
} as const;

/** 阶段3 多因子动态风险阈值：综合风险分 ≥ 50 → 自适应升级 PROXIMITY_ENHANCED。 */
export const PROXIMITY_ENHANCED_THRESHOLD = 50;

/** 夜间时段定义（22:00 - 05:59；闭开区间，确定性判定）。 */
export const NIGHT_HOUR_MIN = 22;
export const NIGHT_HOUR_MAX = 5;

/** 信用分警戒线（任一 < 70 → 风险 +20）。 */
export const RISK_LOW_CREDIT_THRESHOLD = 70;

/** 各风险因子权重（任务书口径：基础 20 / 敏感定制 30 / 夜间 20 / 信用 20）。 */
export const RISK_FACTOR_WEIGHTS = {
  SENSITIVE_CUSTOMIZATION: 30,
  NIGHTTIME: 20,
  LOW_CREDIT: 20,
} as const;

/** 判定某小时是否属夜间时段（22:00-05:59，纯函数）。 */
export function isNighttimeHour(hour: number): boolean {
  if (!Number.isInteger(hour) || hour < 0 || hour > 23) return false;
  return hour >= NIGHT_HOUR_MIN || hour <= NIGHT_HOUR_MAX;
}

/** 多因子动态风险评分（纯函数，确定性加权，clamp 0-100）。 */
export function computeRiskScore(input: {
  baseRiskScore?: number;
  customRequirements?: INormalizedCustomIntent;
  hourOfDay?: number;
  creditScores?: { demander: number; provider: number };
}): number {
  const base =
    Number.isFinite(input.baseRiskScore) && (input.baseRiskScore ?? 0) > 0
      ? Math.min(100, Math.max(0, Math.round(input.baseRiskScore ?? 0)))
      : 0;
  let score = base;
  if (input.customRequirements?.isSensitiveCustomization) {
    score += RISK_FACTOR_WEIGHTS.SENSITIVE_CUSTOMIZATION;
  }
  if (typeof input.hourOfDay === "number" && isNighttimeHour(input.hourOfDay)) {
    score += RISK_FACTOR_WEIGHTS.NIGHTTIME;
  }
  const c = input.creditScores;
  if (c && (c.demander < RISK_LOW_CREDIT_THRESHOLD || c.provider < RISK_LOW_CREDIT_THRESHOLD)) {
    score += RISK_FACTOR_WEIGHTS.LOW_CREDIT;
  }
  return Math.min(100, Math.max(0, score));
}

/** 强化守护徽标文案（升级态统一口径）。 */
export const ENHANCED_SAFETY_BADGE = "🛡️ 强化安全守护中（虚拟号+实时存证）";
/** 常规守护徽标文案。 */
export const STANDARD_SAFETY_BADGE = "🛡️ 安全守护中";

/**
 * 运行时安全聚合评估（S3 SAFE_MONITOR 核心纯函数）。
 *
 * 聚合规则（各维度独立判定，威胁逐条入列，全确定性）：
 * - LBS 围栏：未到达 → geofence-not-arrived；精度漂移警告 → geofence-drift
 *   （两者可并存；无坐标输入 → 不判定，不入威胁）；
 * - 文本：autoFlag 命中敏感词 → sensitive-content:<tag>；
 * - 隐私：privacyArmed === false → privacy-not-armed（缺省未知 = 不判定）。
 *
 * 状态映射：威胁数 = 0 → GUARDED；1 个（且非敏感词）→ ATTENTION；
 * 含敏感词命中 或 威胁数 ≥ 2 → THREAT（高危优先）。
 */
export function evaluateRuntimeSafety(
  input: RuntimeSafetyInput,
): IRuntimeSafetyReport {
  const threats: string[] = [];
  const details: IRuntimeSafetyReport["details"] = {
    geofence: null,
    textFlag: null,
    privacyArmed: null,
  };

  if (input.coords) {
    const result = checkGeofenceArrival(
      input.coords.current,
      input.coords.target,
      input.coords.thresholdMeters,
    );
    details.geofence = {
      isArrived: result.isArrived,
      distanceMeters: result.distanceMeters,
      accuracyWarning: result.accuracyWarning,
    };
    if (!result.isArrived) {
      threats.push(SAFE_MONITOR_THREAT_CODES.GEOFENCE_NOT_ARRIVED);
    }
    if (result.accuracyWarning) {
      threats.push(SAFE_MONITOR_THREAT_CODES.GEOFENCE_DRIFT);
    }
  }

  if (typeof input.chatText === "string" && input.chatText.length > 0) {
    const flag = autoFlag(input.chatText);
    if (flag) {
      details.textFlag = flag;
      threats.push(`${SAFE_MONITOR_THREAT_CODES.SENSITIVE_CONTENT}:${flag}`);
    }
  }

  if (typeof input.privacyArmed === "boolean") {
    details.privacyArmed = input.privacyArmed;
    if (!input.privacyArmed) {
      threats.push(SAFE_MONITOR_THREAT_CODES.PRIVACY_NOT_ARMED);
    }
  }

  const hasSensitive = threats.some((t) =>
    t.startsWith(SAFE_MONITOR_THREAT_CODES.SENSITIVE_CONTENT)
  );
  const securityPillStatus =
    threats.length === 0
      ? "GUARDED"
      : hasSensitive || threats.length >= 2
        ? "THREAT"
        : "ATTENTION";

  // 阶段3：多因子动态风险评分 + 引信自适应升级（纯函数确定性）
  const riskScore = computeRiskScore({
    baseRiskScore: input.baseRiskScore,
    customRequirements: input.customRequirements,
    hourOfDay: input.hourOfDay,
    creditScores: input.creditScores,
  });
  const escalated = riskScore >= PROXIMITY_ENHANCED_THRESHOLD;
  const safetyLevel = escalated ? "PROXIMITY_ENHANCED" : "STANDARD";
  const forceArmed = escalated
    ? { virtualNumberActive: true, tripGuardActive: true, chatModerationActive: true }
    : { virtualNumberActive: false, tripGuardActive: false, chatModerationActive: false };
  const safetyBadge = escalated ? ENHANCED_SAFETY_BADGE : STANDARD_SAFETY_BADGE;

  return {
    ammoId: input.ammoId,
    orderId: input.orderId,
    isGuarded: threats.length === 0,
    activeThreats: threats,
    securityPillStatus,
    riskScore,
    safetyLevel,
    forceArmed,
    safetyBadge,
    details,
  };
}
