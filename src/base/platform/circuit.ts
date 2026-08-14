/**
 * 智能运力熔断 + 供需杠杆（ADR-0014，缺口 N12）。
 * 熔断：连续失败 → open → 半开探测 → closed。供需杠杆：响应数 / 需求数的
 * 供需比 → 建议加减价/增减供给（供不应求 → 需求侧提价提示）。
 * 纯函数，SSR 安全。
 */

export type BreakerState = "closed" | "open" | "half-open";

export interface Breaker {
  state: BreakerState;
  failures: number;
  /** 半开探测允许放行的次数。 */
  probes: number;
  openedAt: number;
}

export const BREAKER_RULES = { threshold: 3, cooldownMs: 30_000, probeMax: 1 } as const;

/** 调用结果回执 → 状态迁移。 */
export function trip(b: Breaker, ok: boolean, now: number): Breaker {
  if (ok) {
    if (b.state === "half-open") {
      return { state: "closed", failures: 0, probes: 0, openedAt: 0 };
    }
    return { ...b, failures: 0 };
  }
  const failures = b.failures + 1;
  if (failures >= BREAKER_RULES.threshold) {
    return { state: "open", failures, probes: 0, openedAt: now };
  }
  return { ...b, failures };
}

/** 请求放行判定：open 且未过冷却 → 拒绝；open 冷却过后 → half-open 探测放行。 */
export function allow(b: Breaker, now: number): { ok: boolean; breaker: Breaker } {
  if (b.state !== "open") return { ok: true, breaker: b };
  if (now - b.openedAt < BREAKER_RULES.cooldownMs) return { ok: false, breaker: b };
  return {
    ok: true,
    breaker: b.probes < BREAKER_RULES.probeMax ? { ...b, state: "half-open", probes: b.probes + 1 } : b,
  };
}

// ---------- 供需杠杆 ----------

export interface SupplyDemand {
  demandCount: number;
  supplyCount: number;
}

export type LeverSignal = "thin-supply" | "balanced" | "glut";

/** 供需比 → 信号：供给 < 需求×0.6 供不应求；供给 > 需求×1.6 供给过剩。 */
export function lever(d: SupplyDemand): { signal: LeverSignal; ratio: number; advice: string } {
  const ratio = d.supplyCount === 0 ? (d.demandCount > 0 ? Infinity : 1) : d.supplyCount / Math.max(1, d.demandCount);
  if (ratio < 0.6) {
    return {
      signal: "thin-supply",
      ratio,
      advice: `供不应求（供需比 ${ratio.toFixed(2)}）——建议需求侧上调预算、供给侧平台补贴加价`,
    };
  }
  if (ratio > 1.6) {
    return {
      signal: "glut",
      ratio,
      advice: `供给过剩（供需比 ${ratio.toFixed(2)}）——建议需求侧降本，供给侧让价竞单`,
    };
  }
  return { signal: "balanced", ratio, advice: `供需平衡（${ratio.toFixed(2)}），维持现状` };
}