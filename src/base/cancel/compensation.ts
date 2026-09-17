/**
 * 取消补偿纯核（P6 · 用户裁决 2026-09-18）。
 *
 * 公式：冷静期 3 分钟内免费；否则补偿 = 预估到达分钟 × 城市小时基准 / 60
 * （已到达 ×2，含往返路费；未到达 ×1）。无封顶（预估时间天然有界）。
 * ETA 为平台快照（防师傅虚报拖延），签到以状态机 ARRIVED+ 为准。
 *
 * Pure + unit-testable.
 */

export const CANCEL_COOLDOWN_MS = 3 * 60_000;

export interface CompensationInput {
  /** 接单时刻 ms。 */
  assignedAtMs: number;
  /** 取消时刻 ms。 */
  cancelAtMs: number;
  /** 平台预估到达（分钟，快照）。 */
  etaMin: number;
  /** 城市小时基准（元/小时）。 */
  hourlyRate: number;
  /** 是否已到达（状态 ARRIVED+）。 */
  arrived: boolean;
}

export interface CompensationResult {
  /** 冷静期内免费。 */
  free: boolean;
  /** 补偿金额（元，2 位）。 */
  amount: number;
}

export function computeCompensation(input: CompensationInput): CompensationResult {
  const { assignedAtMs, cancelAtMs, etaMin, hourlyRate, arrived } = input;
  if (
    !Number.isFinite(assignedAtMs) ||
    !Number.isFinite(cancelAtMs) ||
    cancelAtMs < assignedAtMs
  ) {
    throw new Error("INVALID_TIME: 取消时间非法");
  }
  if (!Number.isFinite(etaMin) || etaMin < 0) {
    throw new Error("INVALID_ETA: 预估到达时间非法");
  }
  if (!Number.isFinite(hourlyRate) || hourlyRate < 0) {
    throw new Error("INVALID_RATE: 基准费率非法");
  }
  if (cancelAtMs - assignedAtMs <= CANCEL_COOLDOWN_MS) {
    return { free: true, amount: 0 };
  }
  const base = (etaMin * hourlyRate) / 60;
  const amount = Math.round(base * (arrived ? 2 : 1) * 100) / 100;
  return { free: false, amount };
}
