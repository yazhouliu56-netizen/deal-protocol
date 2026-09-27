/**
 * 守望状态机纯核（强制守护 · 用户裁决：无便捷开关，中断只有技术性缺口）。
 *
 * 状态：
 * - LIVE：信号正常（缺口在复连窗内）；
 * - DEGRADED：信号中断超复连窗（device 可能杀进程/断网/没电）→ 提醒双方＋复连引导；
 * - LOST：中断超丢失线 → 按危机等级升级（复用 crisis 递增通道）；
 * - TAMPER：明确关 GPS（系统能探知到关闭动作本身）→ 即时标记＋通知对方，
 *   不等窗口（关 GPS 不是没电，是动作）。
 * 缺口起因不可区分时（杀进程/断网/没电长得一样），一律按最严处理，
 * 但携带 batteryLow 上下文（客户端上报），升级单据实写“可能没电”，不断案。
 *
 * 阈值（用户可调参）：复连窗 10min，丢失线 15min。
 * Pure + unit-testable（nowMs/lastSeenMs 全入参，零时间源/DB/UI 依赖）。
 */

export type GuardSignalState = "LIVE" | "DEGRADED" | "LOST" | "TAMPER";

/** 复连窗 10min：窗内抖动自愈，只记不扰。 */
export const SIGNAL_RECONNECT_WINDOW_MS = 10 * 60_000;
/** 丢失线 15min：超线即升级，不等。 */
export const SIGNAL_LOST_AFTER_MS = 15 * 60_000;

export interface SignalWatchInput {
  /** 末次信号时刻（ms；null＝从未上报）。 */
  lastSeenMs: number | null;
  nowMs: number;
  /** GPS 开关可探知时传入；未知传 null（不判 tamper）。 */
  gpsEnabled: boolean | null;
  /** 客户端上报的低电量（解释缺口用，不降级）。 */
  batteryLow?: boolean;
}

export interface SignalWatchReport {
  state: GuardSignalState;
  reasons: string[];
  /** 是否向对方可见（DEGRADED 起双向透明，拒绝黑箱）。 */
  notifyPeer: boolean;
  /** 是否升级（仅 LOST；TAMPER 走即时标记通道，由调用方升级）。 */
  escalate: boolean;
}

export function evaluateGuardSignal(input: SignalWatchInput): SignalWatchReport {
  if (input.gpsEnabled === false) {
    return { state: "TAMPER", reasons: ["gps-off"], notifyPeer: true, escalate: false };
  }
  if (input.lastSeenMs == null || !Number.isFinite(input.lastSeenMs)) {
    const reasons = ["never-reported"];
    if (input.batteryLow) reasons.push("low-battery");
    return { state: "DEGRADED", reasons, notifyPeer: true, escalate: false };
  }
  const gap = input.nowMs - input.lastSeenMs;
  if (gap <= SIGNAL_RECONNECT_WINDOW_MS) {
    return { state: "LIVE", reasons: [], notifyPeer: false, escalate: false };
  }
  const reasons = [gap <= SIGNAL_LOST_AFTER_MS ? "reconnect-window-exceeded" : "signal-lost"];
  if (input.batteryLow) reasons.push("low-battery");
  if (gap <= SIGNAL_LOST_AFTER_MS) {
    return { state: "DEGRADED", reasons, notifyPeer: true, escalate: false };
  }
  return { state: "LOST", reasons, notifyPeer: true, escalate: true };
}
