/**
 * L2-M2 潮汐动态与环境溢价算子引擎（P2 战役第三波终局攻坚，2026-08-17）。
 * 三因子纯函数动态溢价：
 *  ① 时段潮汐系数——早高峰 7-9 点 ×1.15、晚高峰 17-20 点 ×1.20、深夜 22-5 点 ×1.30、其余 ×1.0；
 *  ② 极端天气系数——暴雨 ×1.25、暴雪/风暴 ×1.40、中轻雨 ×1.10、晴天 ×1.0；
 *  ③ 供需热度系数——demandSupplyRatio > 2.0 时线性平滑加价（(ratio-2)×0.25），
 *     最高加价 ×1.50 封顶；亦支持 L6-M2 运力中枢显式注入 capacitySurgeFactor 直连联动。
 * 红线 1：纯确定性纯函数（无概率、无隐式时间）；红线 2：金额一律分（Cents）单位，
 * 最终应付金额严格钳制在 [minFloorPriceCents, maxCeilingPriceCents] 闭区间内，
 * 严防天价溢价与负数账单；红线 3：base/money 零 React / UI Store 反向依赖。
 */

export type WeatherCondition = "CLEAR" | "RAIN_LIGHT" | "RAIN_HEAVY" | "SNOW" | "STORM";

export interface ISurgePricingContext {
  /** 时钟小时 0 ~ 23（UTC 或本地由调用方决定，纯入参）。 */
  timeOfDayHour: number;
  weather?: WeatherCondition;
  /** 需求数 / 可用运力数（1.0 = 供需平衡；>2.0 = 严重缺人）。 */
  demandSupplyRatio?: number;
  /** L6-M2 运力中枢注入的容量溢价因子（显式给定则优先于供需线性计算）。 */
  capacitySurgeFactor?: number;
  /** D2 计价护栏：地板价（分），综合溢价后强制保底。 */
  minFloorPriceCents?: number;
  /** D2 计价护栏：天花板价（分），综合溢价后强制封顶。 */
  maxCeilingPriceCents?: number;
}

export interface ISurgePricingResult {
  basePriceCents: number;
  /** 最终应付金额（分）：综合倍率 × 基数 → 取整 → 双向护栏钳制。 */
  finalPriceCents: number;
  /** 最终综合倍率（时段 × 天气 × 容量）。 */
  surgeMultiplier: number;
  breakdown: {
    timeSurgeFactor: number;
    weatherSurgeFactor: number;
    capacitySurgeFactor: number;
    /** 是否发生护栏钳制（命中地板/天花板/负数保护）。 */
    clampedByBounds: boolean;
  };
}

/* ─────────── 时段潮汐系数（边界精确：闭区间 [start, end)） ─────────── */

export const TIME_SURGE_LEVELS = {
  DAWN_AND_BEFORE: { startHour: 22, endHour: 5, factor: 1.3 },
  EARLY_PEAK: { startHour: 7, endHour: 9, factor: 1.15 },
  EVENING_PEAK: { startHour: 17, endHour: 20, factor: 1.2 },
} as const;

/** 时段系数：22-5 深夜 ×1.30、7-9 早高峰 ×1.15、17-20 晚高峰 ×1.20、其余 ×1.0。 */
export function timeSurgeFactor(hour: number): number {
  const normalized = ((hour % 24) + 24) % 24;
  if (normalized >= 22 || normalized < 5) return TIME_SURGE_LEVELS.DAWN_AND_BEFORE.factor; // 22-23, 0-4
  if (normalized >= 7 && normalized < 9) return TIME_SURGE_LEVELS.EARLY_PEAK.factor;
  if (normalized >= 17 && normalized < 20) return TIME_SURGE_LEVELS.EVENING_PEAK.factor;
  return 1.0;
}

/* ─────────── 极端天气系数 ─────────── */

export const WEATHER_SURGE_FACTORS: Record<WeatherCondition, number> = {
  CLEAR: 1.0,
  RAIN_LIGHT: 1.1,
  RAIN_HEAVY: 1.25,
  SNOW: 1.4,
  STORM: 1.4,
};

/** 天气系数：暴雪/风暴 ×1.40、暴雨 ×1.25、中轻雨 ×1.10、晴天/缺省 ×1.0。 */
export function weatherSurgeFactor(weather?: WeatherCondition): number {
  return weather ? (WEATHER_SURGE_FACTORS[weather] ?? 1.0) : 1.0;
}

/* ─────────── 供需热度系数（线性平滑加价，×1.50 封顶） ─────────── */

/** 供需加价触发阈值：ratio > 2.0 开始线性加价。 */
export const SURGE_DEMAND_RATIO_TRIGGER = 2.0;
/** 供需加价斜率：每超出 1.0 的供需比加 0.25 倍率。 */
export const SURGE_DEMAND_RATIO_STEP = 0.25;
/** 供需加价上限（×1.50）。 */
export const SURGE_CAPACITY_MAX_FACTOR = 1.5;

/**
 * 供需热度系数：ratio > 2.0 → 1.0 + (ratio − 2.0) × 0.25 线性平滑，
 * 封顶 ×1.50；ratio 缺省或 ≤ 2.0 → ×1.0。
 */
export function capacitySurgeFactorFromRatio(demandSupplyRatio?: number): number {
  if (demandSupplyRatio === undefined || demandSupplyRatio <= SURGE_DEMAND_RATIO_TRIGGER) return 1.0;
  const raw = 1.0 + (demandSupplyRatio - SURGE_DEMAND_RATIO_TRIGGER) * SURGE_DEMAND_RATIO_STEP;
  return Math.min(SURGE_CAPACITY_MAX_FACTOR, raw);
}

/* ─────────── 主算子：三因子综合 + 双向护栏钳制 ─────────── */

/**
 * 潮汐动态与环境溢价主算子（纯确定性）：
 *  1) capacitySurgeFactor 显式注入优先（L6-M2 联动），否则由 demandSupplyRatio 线性派生；
 *  2) surgeMultiplier = 时段 × 天气 × 容量三因子连乘；
 *  3) finalPrice = max(0, round(base × multiplier))（负数账单保护）→
 *     minFloorPriceCents 保底 → maxCeilingPriceCents 封顶（先地后顶，上限恒守；
 *     护栏配置矛盾（floor > ceiling）时以天花板为准，杜绝天价溢价）。
 */
export function calculateDynamicSurgePrice(
  basePriceCents: number,
  ctx: ISurgePricingContext
): ISurgePricingResult {
  const time = timeSurgeFactor(ctx.timeOfDayHour);
  const weather = weatherSurgeFactor(ctx.weather);
  const capacity =
    ctx.capacitySurgeFactor !== undefined
      ? ctx.capacitySurgeFactor
      : capacitySurgeFactorFromRatio(ctx.demandSupplyRatio);

  const multiplier = round3(time * weather * capacity);
  let finalPriceCents = Math.max(0, Math.round(basePriceCents * multiplier));
  let clamped = false;

  if (ctx.minFloorPriceCents !== undefined) {
    if (finalPriceCents < ctx.minFloorPriceCents) {
      finalPriceCents = ctx.minFloorPriceCents;
      clamped = true;
    }
  }
  if (ctx.maxCeilingPriceCents !== undefined) {
    if (finalPriceCents > ctx.maxCeilingPriceCents) {
      finalPriceCents = ctx.maxCeilingPriceCents;
      clamped = true;
    }
  }

  return {
    basePriceCents,
    finalPriceCents,
    surgeMultiplier: multiplier,
    breakdown: {
      timeSurgeFactor: time,
      weatherSurgeFactor: weather,
      capacitySurgeFactor: capacity,
      clampedByBounds: clamped,
    },
  };
}

/** 三因子乘积累加到 3 位小数的确定性舍入（避免 1.3×1.4=1.8200000001 类浮点噪声）。 */
function round3(v: number): number {
  return Math.round(v * 1000) / 1000;
}