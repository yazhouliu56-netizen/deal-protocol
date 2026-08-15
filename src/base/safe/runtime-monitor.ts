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

  return {
    ammoId: input.ammoId,
    orderId: input.orderId,
    isGuarded: threats.length === 0,
    activeThreats: threats,
    securityPillStatus,
    details,
  };
}
