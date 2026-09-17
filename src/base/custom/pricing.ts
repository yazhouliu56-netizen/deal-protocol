/**
 * 定制行项定价纯核（P5a · 用户裁决 2026-09-18）。
 *
 * 双轨：事实型固定价（成本表）/ 情绪型按订单基础价百分比。
 * floor = fixed_amount | base × percent_rate（护栏在调用方按
 * platform_config qualityGuardrails 校验：下限 emotionMinPct 等）。
 * 用户填 amount ≥ floor 才有效；订单总额 = 基础价 + Σ溢价。
 *
 * Pure + unit-testable.
 */

export type CustomPricingMode = "fixed" | "percent";

export interface CustomDimFloor {
  dim_key: string;
  mode: CustomPricingMode;
  fixed_amount: number;
  percent_rate: number;
}

export interface CustomItemInput {
  dim_key: string;
  amount: number;
}

export function floorForDim(
  dim: CustomDimFloor,
  baseAmount: number,
): number {
  const base = Number.isFinite(baseAmount) && baseAmount > 0 ? baseAmount : 0;
  if (dim.mode === "fixed") return Math.max(0, Number(dim.fixed_amount) || 0);
  return Math.round(base * (Number(dim.percent_rate) || 0) * 100) / 100;
}

/** 逐项校验（未知维度/低于底价即错；返回错误列表，空=全过）。 */
export function validateCustomItems(
  items: CustomItemInput[],
  dims: Map<string, CustomDimFloor>,
  baseAmount: number,
): string[] {
  const errors: string[] = [];
  for (const it of items) {
    const dim = dims.get(it.dim_key);
    if (!dim) {
      errors.push(`未知定制维度: ${it.dim_key}`);
      continue;
    }
    const floor = floorForDim(dim, baseAmount);
    if (!Number.isFinite(it.amount) || it.amount < floor) {
      errors.push(`定制项 ${it.dim_key} 金额¥${it.amount}低于最低价¥${floor}`);
    }
  }
  return errors;
}

/** 订单总额 = 基础价 + Σ定制溢价（一张单子）。 */
export function totalWithCustom(baseAmount: number, items: CustomItemInput[]): number {
  const sum = items.reduce((s, it) => s + (Number(it.amount) || 0), 0);
  return Math.round(((Number(baseAmount) || 0) + sum) * 100) / 100;
}
