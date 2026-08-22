import { test } from "node:test";
import assert from "node:assert/strict";
import {
  CAPACITY_UTIL_CONGESTED,
  computeUtilizationRate,
  evaluateRegionalCapacityCircuit,
  capacityLeverageFor,
  type IRegionalCapacityMetrics,
} from "./capacity-circuit.ts";
import { calculateDynamicSurgePrice } from "../money/surge-pricing.ts";
import { evaluateDegradationGate, mapRegionalCapacityToDegradation } from "./resilience.ts";

const m = (over: Partial<IRegionalCapacityMetrics>): IRegionalCapacityMetrics => ({
  geohash: "ws10u",
  activeDemandsCount: 5,
  availableProvidersCount: 5, // util 0.5
  unmatchedQueueLength: 0,
  avgWaitTimeSeconds: 0,
  ...over,
});

test("利用率：active/(active+available)，全零区域记 0（除零保护）", () => {
  assert.equal(computeUtilizationRate(m({ activeDemandsCount: 5, availableProvidersCount: 5 })), 0.5);
  assert.equal(computeUtilizationRate(m({ activeDemandsCount: 0, availableProvidersCount: 0 })), 0);
  assert.equal(computeUtilizationRate(m({ activeDemandsCount: 19, availableProvidersCount: 1 })), 0.95);
});

test("状态机：利用率 ≤80% → NORMAL 无溢价全量放行", () => {
  const r = evaluateRegionalCapacityCircuit(m({}));
  assert.equal(r.status, "NORMAL");
  assert.equal(r.action, "ALLOW");
  assert.equal(r.recommendedSurgeMultiplier, 1.0);
  assert.equal(r.shouldQueueNewDemands, false);
  assert.equal(r.utilizationRate, 0.5);
  // 80% 精确边界仍 NORMAL（4/5 = 0.8）
  const edge = evaluateRegionalCapacityCircuit(m({ activeDemandsCount: 4, availableProvidersCount: 1 }));
  assert.equal(edge.status, "NORMAL");
});

test("状态机：80%<利用率 ≤95% → CONGESTED 微溢价 ×1.15（不断流）", () => {
  const r = evaluateRegionalCapacityCircuit(m({ activeDemandsCount: 5, availableProvidersCount: 1 })); // 5/6 = 0.833
  assert.equal(r.status, "CONGESTED");
  assert.equal(r.action, "SURGE_PRICE");
  assert.equal(r.recommendedSurgeMultiplier, 1.15);
  assert.equal(r.shouldQueueNewDemands, false);
  // 95% 精确边界仍 CONGESTED（19/20 = 0.95）
  const edge = evaluateRegionalCapacityCircuit(m({ activeDemandsCount: 19, availableProvidersCount: 1 }));
  assert.equal(edge.status, "CONGESTED");
});

test("状态机：利用率 >95% → EXHAUSTED_SURGE ×1.35 价格杠杆 + 排队", () => {
  const r = evaluateRegionalCapacityCircuit(m({ activeDemandsCount: 20, availableProvidersCount: 1 })); // 20/21 = 0.952
  assert.equal(r.status, "EXHAUSTED_SURGE");
  assert.equal(r.action, "SURGE_PRICE");
  assert.equal(r.recommendedSurgeMultiplier, 1.35);
  assert.equal(r.shouldQueueNewDemands, true);
  assert.equal(r.utilizationRate > CAPACITY_UTIL_CONGESTED, true);
});

test("状态机：排队积压 >30（低利用率也触发）→ EXHAUSTED_SURGE", () => {
  const r = evaluateRegionalCapacityCircuit(m({ unmatchedQueueLength: 31 })); // util 0.5 低载
  assert.equal(r.status, "EXHAUSTED_SURGE");
  assert.equal(r.recommendedSurgeMultiplier, 1.35);
  assert.equal(r.shouldQueueNewDemands, true);
  // 30 单边界不升级（仍按利用率判定）
  const edge = evaluateRegionalCapacityCircuit(m({ unmatchedQueueLength: 30 }));
  assert.equal(edge.status, "NORMAL");
});

test("状态机：排队 >100 或等待 >1800s → TRIPPED_THROTTLE 爆单熔断", () => {
  const byQueue = evaluateRegionalCapacityCircuit(m({ unmatchedQueueLength: 101 }));
  assert.equal(byQueue.status, "TRIPPED_THROTTLE");
  assert.equal(byQueue.action, "REJECT_NON_CRITICAL");
  assert.equal(byQueue.recommendedSurgeMultiplier, 1.5);
  assert.equal(byQueue.shouldQueueNewDemands, true);
  const byWait = evaluateRegionalCapacityCircuit(m({ avgWaitTimeSeconds: 1801 }));
  assert.equal(byWait.status, "TRIPPED_THROTTLE");
  // 边界：100 单 / 1800s 不熔断（确定性短路到 EXHAUSTED 判定）
  const edgeQueue = evaluateRegionalCapacityCircuit(m({ unmatchedQueueLength: 100, avgWaitTimeSeconds: 1800 }));
  assert.equal(edgeQueue.status, "EXHAUSTED_SURGE");
});

test("熔断联动（L6-M2 ➔ L2-M2）：EXHAUSTED ×1.35 直传潮汐引擎价格杠杆", () => {
  const decision = evaluateRegionalCapacityCircuit(
    m({ activeDemandsCount: 20, availableProvidersCount: 1, unmatchedQueueLength: 31 })
  );
  assert.equal(decision.status, "EXHAUSTED_SURGE");
  const lever = capacityLeverageFor(decision);
  assert.equal(lever, 1.35);
  const price = calculateDynamicSurgePrice(10_000, {
    timeOfDayHour: 12,
    weather: "CLEAR",
    capacitySurgeFactor: lever,
  });
  assert.equal(price.finalPriceCents, 13_500);
  assert.equal(price.breakdown.capacitySurgeFactor, 1.35);
});

test("熔断联动（L6-M2 ➔ 全站容灾）：四级状态映射五级降级等级", () => {
  assert.equal(mapRegionalCapacityToDegradation("NORMAL"), "NORMAL");
  assert.equal(mapRegionalCapacityToDegradation("CONGESTED"), "NORMAL");
  assert.equal(mapRegionalCapacityToDegradation("EXHAUSTED_SURGE"), "RATE_LIMIT_QUEUE");
  assert.equal(mapRegionalCapacityToDegradation("TRIPPED_THROTTLE"), "PRESERVE_CORE");
  // PRESERVE_CORE：仅放行 SOS 与在途履约，阻断普通新需求（与既有五级矩阵零回归）
  assert.equal(evaluateDegradationGate("PRESERVE_CORE", "CRITICAL_SOS").isAllowed, true);
  assert.equal(evaluateDegradationGate("PRESERVE_CORE", "CORE_FULFILLMENT").isAllowed, true);
  assert.equal(evaluateDegradationGate("PRESERVE_CORE", "NEW_DEMAND").isAllowed, false);
  assert.equal(evaluateDegradationGate("RATE_LIMIT_QUEUE", "NEW_DEMAND").isAllowed, false);
});

test("空区域（0 需求 0 运力）→ NORMAL 无除零异常", () => {
  const r = evaluateRegionalCapacityCircuit(m({ activeDemandsCount: 0, availableProvidersCount: 0 }));
  assert.equal(r.status, "NORMAL");
  assert.equal(r.action, "ALLOW");
  assert.equal(r.utilizationRate, 0);
  assert.ok(r.summary.includes("ws10u"));
});

test("确定性：同输入同输出（状态/倍率/队列/摘要全稳定）", () => {
  const input = m({ activeDemandsCount: 30, availableProvidersCount: 3, unmatchedQueueLength: 25 });
  assert.deepEqual(
    evaluateRegionalCapacityCircuit(input),
    evaluateRegionalCapacityCircuit(input)
  );
});