/**
 * L6-M2 区域运力熔断与供需杠杆调度中枢（P2 战役第三波终局攻坚，2026-08-17）。
 * 区域运力健康度四级状态机（利用率 = 活跃需求 / 总容量，总容量 = 活跃需求 + 可用运力）：
 *   NORMAL(util ≤ 0.80)              → ALLOW 无溢价放行；
 *   CONGESTED(0.80 < util ≤ 0.95)    → SURGE_PRICE ×1.15 微溢价抑制需求；
 *   EXHAUSTED_SURGE(util > 0.95 或排队积压 > 30) → SURGE_PRICE ×1.35 价格杠杆 + 排队；
 *   TRIPPED_THROTTLE(排队 > 100 或等待 > 1800s)  → REJECT_NON_CRITICAL 熔断保护核心履约与 SOS。
 * 联动 L2-M2：recommendedSurgeMultiplier 即 capacitySurgeFactor 直传 calculateDynamicSurgePrice，
 * 在运力枯竭时自动触发价格杠杆抑制需求；严重过载自动排队限流（RESILIENCE 联动见 PartD 桥接）。
 * 红线 1：纯确定性纯函数、零概率；红线 3：base/platform 零 React / UI Store 反向依赖。
 */

export type RegionalCapacityStatus = "NORMAL" | "CONGESTED" | "EXHAUSTED_SURGE" | "TRIPPED_THROTTLE";

export interface IRegionalCapacityMetrics {
  /** 区域 geohash（判定粒度：单区域独立熔断）。 */
  geohash: string;
  /** 活跃需求数（进行中 + 待接）。 */
  activeDemandsCount: number;
  /** 可用运力数（在岗空闲）。 */
  availableProvidersCount: number;
  /** 未匹配排队长度（等待接单的需求数）。 */
  unmatchedQueueLength: number;
  /** 平均等待时长（秒）。 */
  avgWaitTimeSeconds: number;
}

export type CapacityAction = "ALLOW" | "SURGE_PRICE" | "THROTTLE_QUEUE" | "REJECT_NON_CRITICAL";

export interface IRegionalCapacityDecision {
  status: RegionalCapacityStatus;
  /** 建议溢价倍率（供 L2-M2 capacitySurgeFactor 直连联动）。 */
  recommendedSurgeMultiplier: number;
  /** 是否强制新需求进排队（价格杠杆 + 排队双杠）。 */
  shouldQueueNewDemands: boolean;
  action: CapacityAction;
  /** 区域利用率（0 ~ 1；空区域 0/0 记为 0）。 */
  utilizationRate: number;
  /** 中文处置摘要（纯数据，供面板/日志确定性展示）。 */
  summary: string;
}

/* ─────────── 状态阈值（边界精确：≤ 归低一级，> 升级） ─────────── */

export const CAPACITY_UTIL_NORMAL = 0.8;
export const CAPACITY_UTIL_CONGESTED = 0.95;
export const CAPACITY_QUEUE_SURGE = 30;
export const CAPACITY_QUEUE_TRIP = 100;
export const CAPACITY_WAIT_TRIP_SECONDS = 1800;

export const CAPACITY_SURGE_BY_STATUS: Record<RegionalCapacityStatus, number> = {
  NORMAL: 1.0,
  CONGESTED: 1.15,
  EXHAUSTED_SURGE: 1.35,
  TRIPPED_THROTTLE: 1.5,
};

/** 区域利用率：activeDemands / (activeDemands + availableProviders)；全零区域记 0（除零保护）。 */
export function computeUtilizationRate(metrics: IRegionalCapacityMetrics): number {
  const total = metrics.activeDemandsCount + metrics.availableProvidersCount;
  if (total <= 0) return 0;
  return metrics.activeDemandsCount / total;
}

/**
 * 区域运力四级状态机判定器（纯确定性）：
 *   1. TRIPPED_THROTTLE：排队积压 > 100 单 或 平均等待 > 1800s → 熔断普通新需求，强制排队，
 *      保护核心履约与 SOS（NS 级最高处置：REJECT_NON_CRITICAL）；
 *   2. EXHAUSTED_SURGE：利用率 > 0.95 或 排队积压 > 30 → ×1.35 价格杠杆 + 排队蓄水；
 *   3. CONGESTED：利用率 > 0.80 → ×1.15 微溢价；
 *   4. NORMAL：利用率 ≤ 0.80 → 全量放行零溢价。
 * 判定顺序按严重度从高到低，命中即止（确定性短路）。
 */
export function evaluateRegionalCapacityCircuit(
  metrics: IRegionalCapacityMetrics
): IRegionalCapacityDecision {
  const utilizationRate = computeUtilizationRate(metrics);
  const queue = metrics.unmatchedQueueLength;
  const wait = metrics.avgWaitTimeSeconds;

  if (queue > CAPACITY_QUEUE_TRIP || wait > CAPACITY_WAIT_TRIP_SECONDS) {
    return {
      status: "TRIPPED_THROTTLE",
      recommendedSurgeMultiplier: CAPACITY_SURGE_BY_STATUS.TRIPPED_THROTTLE,
      shouldQueueNewDemands: true,
      action: "REJECT_NON_CRITICAL",
      utilizationRate,
      summary: `区域 ${metrics.geohash} 运力爆单熔断（排队 ${queue} 单 / 等待 ${wait}s）：阻断普通新需求进单，强制排队，保护核心履约与 SOS`,
    };
  }
  if (utilizationRate > CAPACITY_UTIL_CONGESTED || queue > CAPACITY_QUEUE_SURGE) {
    return {
      status: "EXHAUSTED_SURGE",
      recommendedSurgeMultiplier: CAPACITY_SURGE_BY_STATUS.EXHAUSTED_SURGE,
      shouldQueueNewDemands: true,
      action: "SURGE_PRICE",
      utilizationRate,
      summary: `区域 ${metrics.geohash} 运力枯竭（利用率 ${(utilizationRate * 100).toFixed(0)}% / 排队 ${queue} 单）：自动联动 L2-M2 ×1.35 价格杠杆抑制需求 + 排队蓄水`,
    };
  }
  if (utilizationRate > CAPACITY_UTIL_NORMAL) {
    return {
      status: "CONGESTED",
      recommendedSurgeMultiplier: CAPACITY_SURGE_BY_STATUS.CONGESTED,
      shouldQueueNewDemands: false,
      action: "SURGE_PRICE",
      utilizationRate,
      summary: `区域 ${metrics.geohash} 运力偏紧（利用率 ${(utilizationRate * 100).toFixed(0)}%）：微溢价 ×1.15 引导供需回归`,
    };
  }
  return {
    status: "NORMAL",
    recommendedSurgeMultiplier: CAPACITY_SURGE_BY_STATUS.NORMAL,
    shouldQueueNewDemands: false,
    action: "ALLOW",
    utilizationRate,
    summary: `区域 ${metrics.geohash} 运力健康（利用率 ${(utilizationRate * 100).toFixed(0)}%）：全量放行零溢价`,
  };
}

/**
 * L2-M2 联动入口：运力中枢判定 → 直传潮汐引擎的 capacitySurgeFactor。
 * EXHAUSTED_SURGE 或更高时自动注入 ×1.35 / ×1.5 价格杠杆；NORMAL/CONGESTED 照常传递。
 * 纯函数：返回 1.0 ~ 1.5 的确定性杠杆因子（recommendedSurgeMultiplier 原样透传）。
 */
export function capacityLeverageFor(decision: IRegionalCapacityDecision): number {
  return decision.recommendedSurgeMultiplier;
}

/** 四级状态机全序（面板/日志确定性展示）。 */
export const CAPACITY_STATUS_ORDER: readonly RegionalCapacityStatus[] = [
  "NORMAL",
  "CONGESTED",
  "EXHAUSTED_SURGE",
  "TRIPPED_THROTTLE",
];