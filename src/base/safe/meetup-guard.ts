/**
 * 见面武装判定纯核（见面要件接线 · 用户裁决：首单/夜单/入户自动武装）。
 *
 * 触发三选一即 ENHANCED（reasons 留痕，进 toast/横幅/metric）：
 * - 首单（本地首接，对方完全陌生）；
 * - 夜单（22:00–06:00，到达/返程风险窗；固定时钟，非用户免打扰偏好）；
 * - 入户（C2_IN_HOME 集群，调用方按弹药供给集群判定）。
 * Pure + unit-testable（hourOfDay 入参，零 DB/UI/时间源依赖）。
 */

export type MeetupGuardLevel = "STANDARD" | "ENHANCED";

/** 夜间窗：22:00（含）– 次日 06:00（不含）。 */
export const MEETUP_NIGHT_START_HOUR = 22;
export const MEETUP_NIGHT_END_HOUR = 6;

export interface MeetupArmingInput {
  isFirstOrder: boolean;
  /** 当地小时 0–23（调用方注入；非法值按非夜间处理）。 */
  hourOfDay: number;
  /** 是否入户类（调用方按弹药 supplyCluster 判定）。 */
  homeAccess: boolean;
}

export function isNightHour(hourOfDay: number): boolean {
  if (!Number.isFinite(hourOfDay)) return false;
  return hourOfDay >= MEETUP_NIGHT_START_HOUR || hourOfDay < MEETUP_NIGHT_END_HOUR;
}

export function evaluateMeetupArming(input: MeetupArmingInput): {
  level: MeetupGuardLevel;
  reasons: string[];
} {
  const reasons: string[] = [];
  if (input.isFirstOrder) reasons.push("first-order");
  if (isNightHour(input.hourOfDay)) reasons.push("night");
  if (input.homeAccess) reasons.push("home-access");
  return { level: reasons.length > 0 ? "ENHANCED" : "STANDARD", reasons };
}
