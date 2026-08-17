import { test } from "node:test";
import assert from "node:assert/strict";
import {
  calculateDynamicSurgePrice,
  capacitySurgeFactorFromRatio,
  SURGE_CAPACITY_MAX_FACTOR,
  timeSurgeFactor,
  weatherSurgeFactor,
  type ISurgePricingContext,
} from "./surge-pricing.ts";

const ctx = (over: Partial<ISurgePricingContext>): ISurgePricingContext => ({
  timeOfDayHour: 12,
  weather: "CLEAR",
  demandSupplyRatio: 1.0,
  ...over,
});

test("溢价：晴天平价时段 → ×1.0 平价输出（零溢价）", () => {
  const r = calculateDynamicSurgePrice(10_000, ctx({}));
  assert.equal(r.finalPriceCents, 10_000);
  assert.equal(r.surgeMultiplier, 1.0);
  assert.deepEqual(r.breakdown, {
    timeSurgeFactor: 1.0,
    weatherSurgeFactor: 1.0,
    capacitySurgeFactor: 1.0,
    clampedByBounds: false,
  });
});

test("时段：早高峰 8 点 ×1.15 / 晚高峰 18 点 ×1.20 / 深夜 23 点 ×1.30 / 凌晨 3 点 ×1.30", () => {
  assert.equal(timeSurgeFactor(8), 1.15);
  assert.equal(timeSurgeFactor(18), 1.2);
  assert.equal(timeSurgeFactor(23), 1.3);
  assert.equal(timeSurgeFactor(3), 1.3);
  const morning = calculateDynamicSurgePrice(10_000, ctx({ timeOfDayHour: 8 }));
  assert.equal(morning.finalPriceCents, 11_500);
  assert.equal(morning.breakdown.timeSurgeFactor, 1.15);
});

test("时段边界精确：7 入峰 / 9 出峰 / 17 入晚峰 / 20 出晚峰 / 22 入深夜 / 5 出深夜", () => {
  assert.equal(timeSurgeFactor(7), 1.15);
  assert.equal(timeSurgeFactor(9), 1.0);
  assert.equal(timeSurgeFactor(17), 1.2);
  assert.equal(timeSurgeFactor(20), 1.0);
  assert.equal(timeSurgeFactor(22), 1.3);
  assert.equal(timeSurgeFactor(5), 1.0);
});

test("天气：暴雨 ×1.25 / 中轻雨 ×1.10 / 暴雪与风暴 ×1.40 / 晴天 ×1.0", () => {
  assert.equal(weatherSurgeFactor("RAIN_HEAVY"), 1.25);
  assert.equal(weatherSurgeFactor("RAIN_LIGHT"), 1.1);
  assert.equal(weatherSurgeFactor("SNOW"), 1.4);
  assert.equal(weatherSurgeFactor("STORM"), 1.4);
  assert.equal(weatherSurgeFactor("CLEAR"), 1.0);
  assert.equal(weatherSurgeFactor(undefined), 1.0);
  const rain = calculateDynamicSurgePrice(10_000, ctx({ weather: "RAIN_HEAVY" }));
  assert.equal(rain.finalPriceCents, 12_500);
});

test("复合溢价：深夜 1.3 × 暴雪 1.4 × 供需 1.5 = 2.73（三因子连乘精确）", () => {
  const r = calculateDynamicSurgePrice(
    10_000,
    ctx({ timeOfDayHour: 23, weather: "SNOW", demandSupplyRatio: 4.0 })
  );
  assert.equal(r.breakdown.timeSurgeFactor, 1.3);
  assert.equal(r.breakdown.weatherSurgeFactor, 1.4);
  assert.equal(r.breakdown.capacitySurgeFactor, 1.5);
  assert.equal(r.surgeMultiplier, 2.73);
  assert.equal(r.finalPriceCents, 27_300);
  assert.equal(r.breakdown.clampedByBounds, false);
});

test("供需平滑：ratio ≤2.0 → 1.0；3.0 → 1.25；4.0 → 1.50；6.0 封顶 1.50", () => {
  assert.equal(capacitySurgeFactorFromRatio(2.0), 1.0);
  assert.equal(capacitySurgeFactorFromRatio(3.0), 1.25);
  assert.equal(capacitySurgeFactorFromRatio(4.0), SURGE_CAPACITY_MAX_FACTOR);
  assert.equal(capacitySurgeFactorFromRatio(6.0), SURGE_CAPACITY_MAX_FACTOR);
  assert.equal(capacitySurgeFactorFromRatio(undefined), 1.0);
});

test("护栏：天花板价强制封顶（严防天价溢价）", () => {
  const r = calculateDynamicSurgePrice(
    10_000,
    ctx({
      timeOfDayHour: 23,
      weather: "STORM",
      demandSupplyRatio: 4.0, // 2.73 倍理论价 27,300
      maxCeilingPriceCents: 15_000,
    })
  );
  assert.equal(r.finalPriceCents, 15_000);
  assert.equal(r.breakdown.clampedByBounds, true);
});

test("护栏：地板价强制保底（综合后低于地板拉回）", () => {
  const r = calculateDynamicSurgePrice(
    10_000,
    ctx({ minFloorPriceCents: 12_000 }) // 平价 10,000 < 地板 12,000
  );
  assert.equal(r.finalPriceCents, 12_000);
  assert.equal(r.breakdown.clampedByBounds, true);
});

test("护栏：护栏配置矛盾（floor > ceiling）→ 以天花板为准（上限恒守）", () => {
  const r = calculateDynamicSurgePrice(
    20_000,
    ctx({ minFloorPriceCents: 50_000, maxCeilingPriceCents: 30_000 })
  );
  assert.equal(r.finalPriceCents, 30_000);
  assert.ok(r.finalPriceCents <= 30_000);
  assert.equal(r.breakdown.clampedByBounds, true);
});

test("负数账单保护：负数/非法基数 → final ≥ 0 且不超天花板", () => {
  const r = calculateDynamicSurgePrice(
    -500,
    ctx({ timeOfDayHour: 23, weather: "STORM", maxCeilingPriceCents: 1_000 })
  );
  assert.ok(r.finalPriceCents >= 0);
  assert.ok(r.finalPriceCents <= 1_000);
});

test("L6-M2 联动：capacitySurgeFactor 显式注入（运力中枢 ×1.35 直传）", () => {
  const r = calculateDynamicSurgePrice(
    10_000,
    ctx({ capacitySurgeFactor: 1.35 }) // EXHAUSTED_SURGE 推荐杠杆
  );
  assert.equal(r.breakdown.capacitySurgeFactor, 1.35);
  assert.equal(r.finalPriceCents, 13_500);
  // 显式注入优先于供需线性派生
  const override = calculateDynamicSurgePrice(
    10_000,
    ctx({ demandSupplyRatio: 4.0, capacitySurgeFactor: 1.35 })
  );
  assert.equal(override.breakdown.capacitySurgeFactor, 1.35);
});

test("确定性：同输入同输出（无随机/无隐式时间）", () => {
  const c: ISurgePricingContext = { timeOfDayHour: 18, weather: "RAIN_HEAVY", demandSupplyRatio: 3.0 };
  assert.deepEqual(calculateDynamicSurgePrice(8_888, c), calculateDynamicSurgePrice(8_888, c));
});