/**
 * 弹药属性表 · 计价公式（C3）— 每类目一行可配公式，底座 customPricing 按 schema 驱动。
 * 新增业务只填表，前端/底座一行不改。
 */

export interface PricingFormula {
  /** 起步价（元）。 */
  baseRateYuan?: number;
  /** 城市档 → 时薪（元/小时）。 */
  hourlyRates?: Record<number, number>;
  /** 复杂度因子（如 dirty_work: 1.3）。 */
  multipliers?: Record<string, number>;
  /** 距离费（元/km）。 */
  distanceFeePerKm?: number;
  /** 时间系数（普通/高峰/紧急）。 */
  timeFactors?: Record<"normal" | "peak" | "urgent", number>;
  /** 地板价（fixed 报价不低于此）。 */
  minPriceYuan?: number;
  /** 保修文案。 */
  warrantyText?: string;
}

export const CATEGORY_PRICING: Record<string, PricingFormula> = {
  // 需求局默认（沿用 customPricing 现状参数）
  "厨师 · 上门做饭": {
    baseRateYuan: 30,
    hourlyRates: { 1: 80, 2: 60, 3: 40 },
    multipliers: { dirty_work: 1.3, heavy_lifting: 1.5, hazardous: 1.5 },
    distanceFeePerKm: 5,
    timeFactors: { normal: 1.0, peak: 1.3, urgent: 1.5 },
    minPriceYuan: 50,
    warrantyText: "6 个月",
  },
  "家电维修": {
    baseRateYuan: 50,
    hourlyRates: { 1: 100, 2: 80, 3: 60 },
    multipliers: { hazardous: 1.3 },
    distanceFeePerKm: 5,
    timeFactors: { normal: 1.0, peak: 1.2, urgent: 1.5 },
    minPriceYuan: 80,
    warrantyText: "6 个月",
  },
  "家政保洁": {
    baseRateYuan: 30,
    hourlyRates: { 1: 60, 2: 50, 3: 40 },
    multipliers: { heavy_lifting: 1.2 },
    distanceFeePerKm: 4,
    timeFactors: { normal: 1.0, peak: 1.2, urgent: 1.4 },
    minPriceYuan: 50,
    warrantyText: "满意度保障",
  },
  "水电维修": {
    baseRateYuan: 50,
    hourlyRates: { 1: 90, 2: 70, 3: 55 },
    multipliers: { hazardous: 1.5 },
    distanceFeePerKm: 6,
    timeFactors: { normal: 1.0, peak: 1.3, urgent: 1.6 },
    minPriceYuan: 60,
    warrantyText: "6 个月",
  },
  "搬家": {
    baseRateYuan: 100,
    hourlyRates: { 1: 120, 2: 100, 3: 80 },
    multipliers: { heavy_lifting: 1.5 },
    distanceFeePerKm: 8,
    timeFactors: { normal: 1.0, peak: 1.3, urgent: 1.5 },
    minPriceYuan: 200,
    warrantyText: "短期待 - 破损保障",
  },
  "按摩": {
    baseRateYuan: 60,
    hourlyRates: { 1: 120, 2: 100, 3: 80 },
    multipliers: {},
    distanceFeePerKm: 5,
    timeFactors: { normal: 1.0, peak: 1.2, urgent: 1.4 },
    minPriceYuan: 100,
    warrantyText: "短期待 - 满意度保障，非传统保修",
  },
  // Phase 3 端到端验证：只填这一行配置，即成为「新弹药」。
  "遛狗遛弯": {
    baseRateYuan: 25,
    hourlyRates: { 1: 55, 2: 45, 3: 35 },
    multipliers: { big_dog: 1.4 },
    distanceFeePerKm: 3,
    timeFactors: { normal: 1.0, peak: 1.2, urgent: 1.4 },
    minPriceYuan: 35,
    warrantyText: "遛狗无忧",
  },
};

/** 未配置类目 → 需求局默认公式（含 customPricing 兜底）。 */
export const DEFAULT_PRICING: PricingFormula = CATEGORY_PRICING["厨师 · 上门做饭"];

export function pricingForCategory(category: string): PricingFormula {
  return CATEGORY_PRICING[category] ?? DEFAULT_PRICING;
}
