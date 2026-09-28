/**
 * 录音会话纯核（R-0928-08 三档录音 · R-0928-09 留存）。
 *
 * 三档：
 * - A（入户独处/夜间/高危）：双方接单时授权 → 到达节点自动开 → 完工自动关，
 *   期间任一方关不掉（授权换不可逆； unilateral-stop 即 TAMPER 留痕）；
 * - B（公共/低危）：自保按钮，任一方可开可关；
 * - C（未成年人相关/私密空间）：禁音（never，监护人同意也只留 GPS+文字）。
 *
 * 缺口即证据：时间线断裂由证据哈希链 PREV_LINK_BREAK 标定（调用方落盘时核验）。
 * Pure + unit-testable（nowMs 入参，零时间源/DB/UI 依赖）。
 */

export type RecordingTier = "A" | "B" | "C";
export type RecordingState = "IDLE" | "RECORDING" | "SEALED";

export type TerminalKind = "clean" | "disputed" | "tampered";

/** 留存矩阵（R-0928-09）：风险越高存越久；C 无音声，0 天。单位：天。 */
export function retentionDaysFor(tier: RecordingTier, terminal: TerminalKind): number {
  if (tier === "C") return 0;
  if (terminal === "tampered") return 90;
  if (terminal === "disputed") return 30;
  return tier === "A" ? 30 : 7;
}

export interface AutoStartInput {
  tier: RecordingTier;
  /** 双方接单时已授权（A 档前置条件）。 */
  authorized: boolean;
  /** 是否到达高危节点（如 ARRIVED 现场）。 */
  atHighRiskNode: boolean;
}

export function decideAutoStart(input: AutoStartInput): { start: boolean; reason: string } {
  if (input.tier === "C") return { start: false, reason: "tier-c-forbidden" };
  if (input.tier === "B") return { start: false, reason: "tier-b-manual-only" };
  if (!input.authorized) return { start: false, reason: "missing-authorization" };
  if (!input.atHighRiskNode) return { start: false, reason: "not-at-node" };
  return { start: true, reason: "tier-a-authorized-node" };
}

export interface StopInput {
  tier: RecordingTier;
  state: RecordingState;
  /** 是否用户主动停止（vs 到达完工自动封存）。 */
  manual: boolean;
}

export function decideStop(input: StopInput): {
  action: "seal" | "deny" | "noop";
  reason: string;
  /** A 档任一方手动关＝篡改信号（调用方记 TAMPER 留痕）。 */
  tamper: boolean;
} {
  if (input.state !== "RECORDING") return { action: "noop", reason: "not-recording", tamper: false };
  if (input.tier === "A" && input.manual) {
    return { action: "deny", reason: "tier-a-locked", tamper: true };
  }
  return { action: "seal", reason: input.manual ? "manual-seal" : "auto-seal", tamper: false };
}

/** 到期销毁判定（ retainedDays 起自封存时刻；调用方定时任务消费）。 */
export function isRetentionExpired(
  sealedAtMs: number,
  tier: RecordingTier,
  terminal: TerminalKind,
  nowMs: number,
): boolean {
  if (!Number.isFinite(sealedAtMs) || !Number.isFinite(nowMs)) return false;
  const days = retentionDaysFor(tier, terminal);
  if (days <= 0) return true;
  return nowMs - sealedAtMs > days * 86_400_000;
}
