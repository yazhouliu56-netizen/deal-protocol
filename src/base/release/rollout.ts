/**
 * 灰度发布（B3 · canary＋放量＋kill switch）。
 *
 * 与存量 `lib/feature-flags.ts` 分工：flag 管"谁有资格"（分桶/城市/人群），
 * 本模块管"发布走到哪"（阶段/浸泡/急停）。组合使用：
 * `serve = isEnabled(flag, user) && shouldServe(plan, startedAt, now, bucket01)`。
 * Pure + unit-testable; no runtime imports.
 */

export interface RolloutStage {
  /** 本阶段放量百分比 0–100。 */
  pct: number;
  /** 本阶段最短浸泡分钟数（0 = 终态）。 */
  soakMin: number;
}

export interface RolloutPlan {
  stages: RolloutStage[];
  /** kill switch：true＝全停（阶段/分桶一律不放行）。 */
  kill: boolean;
}

/** 默认 canary 计划：1%（30min）→10%（2h）→50%（6h）→100%。 */
export const DEFAULT_ROLLOUT: RolloutPlan = {
  kill: false,
  stages: [
    { pct: 1, soakMin: 30 },
    { pct: 10, soakMin: 120 },
    { pct: 50, soakMin: 360 },
    { pct: 100, soakMin: 0 },
  ],
};

/** 当前阶段序号（kill 状态下返回 -1）。 */
export function stageFor(plan: RolloutPlan, startedAt: number, now = Date.now()): number {
  if (plan.kill || plan.stages.length === 0) return -1;
  let elapsedMin = (now - startedAt) / 60000;
  if (elapsedMin < 0) elapsedMin = 0;
  let idx = 0;
  for (let i = 0; i < plan.stages.length; i++) {
    idx = i;
    const soak = plan.stages[i].soakMin;
    if (soak <= 0) break;
    if (elapsedMin < soak) break;
    elapsedMin -= soak;
  }
  return idx;
}

/** 是否放行（kill 一票否决；bucket01＝用户分桶 0–1，如 hash%100/100）。 */
export function shouldServe(
  plan: RolloutPlan,
  startedAt: number,
  now: number,
  bucket01: number,
): boolean {
  const idx = stageFor(plan, startedAt, now);
  if (idx < 0) return false;
  const pct = plan.stages[idx].pct;
  if (pct >= 100) return true;
  if (pct <= 0) return false;
  return bucket01 >= 0 && bucket01 < pct / 100;
}

/** 急停（返回新计划，原计划不变）。 */
export function tripKill(plan: RolloutPlan): RolloutPlan {
  return { ...plan, kill: true };
}
