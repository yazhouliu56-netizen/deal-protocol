/**
 * ADR-0020 转岗试单考卷（R1/R2/R3 分档 · 用户已裁决）。
 * 硬门槛保持 / PQS 回流零摩擦 / 试单进度 / 投诉熔断 / 档位推导。
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  evaluateTransfer,
  resolveTransferPolicy,
  riskTierFor,
} from "./probation.ts";
import type { IAmmoDefinition, ITriDimensionalCredit } from "../../types/ammo-schema.ts";
import { IMPACT_FUZE_TEMPLATE } from "../../types/fuze-policy.ts";
import { housekeepingAmmo } from "../../ammo/housekeeping.ammo.ts";
import { meetupAmmo } from "../../ammo/meetup.ammo.ts";

const CLEANER_NO_PQS: ITriDimensionalCredit = {
  bcsScore: 90,
  pqsScores: { housekeeping: 88 },
  esfScore: 85,
  isPoliceVerified: true,
};

const R1_AMMO: IAmmoDefinition = {
  ammoId: "test-r1",
  category: "test-r1-cat",
  version: "1.0.0",
  fiveStateHooks: [],
  pricingModel: { kind: "FIXED", amountYuan: 100 },
  fuzePolicy: IMPACT_FUZE_TEMPLATE,
  supplyCluster: "C2_IN_HOME",
  workerRequirement: { isPoliceVerified: true, minSafetyScore: 70 },
};

test("档位推导：C2/C3→R1，C1→R3，未归类→R2，显式声明优先", () => {
  assert.equal(riskTierFor(R1_AMMO), "R1");
  assert.equal(riskTierFor(meetupAmmo), "R3");
  assert.equal(riskTierFor(housekeepingAmmo), "R1");
  const unclassified: IAmmoDefinition = { ...R1_AMMO, supplyCluster: undefined };
  assert.equal(riskTierFor(unclassified), "R2");
  const override: IAmmoDefinition = { ...R1_AMMO, transferPolicy: { riskTier: "R3" } };
  assert.equal(riskTierFor(override), "R3");
});

test("R1 无目标 PQS＋硬门槛全过 → PROBATION（PQS 缺失不再直接拒）", () => {
  const v = evaluateTransfer(CLEANER_NO_PQS, R1_AMMO, { completedOrders: 0, complaints: 0 });
  assert.equal(v.outcome, "PROBATION");
  assert.match(v.reason ?? "", /0\/5/);
  assert.deepEqual(
    { tier: v.policy.riskTier, n: v.policy.probationOrders, cap: v.policy.dailyCap },
    { tier: "R1", n: 5, cap: 2 },
  );
});

test("硬门槛保持：无公安核验＋IMPACT 引信 → 转岗也一票熔断", () => {
  const v = evaluateTransfer(
    { ...CLEANER_NO_PQS, isPoliceVerified: false },
    R1_AMMO,
    { completedOrders: 0, complaints: 0 },
  );
  assert.equal(v.outcome, "REJECTED");
  assert.match(v.reason ?? "", /police-verification-required/);
});

test("硬门槛保持：BCS<50 → 拒绝（deferPQS 不赦免底线）", () => {
  const v = evaluateTransfer(
    { ...CLEANER_NO_PQS, bcsScore: 40 },
    R1_AMMO,
    { completedOrders: 0, complaints: 0 },
  );
  assert.equal(v.outcome, "REJECTED");
  assert.match(v.reason ?? "", /bcs-score/);
});

test("PQS 回流：已持达线目标 PQS → 直接 ADMITTED", () => {
  const v = evaluateTransfer(
    { ...CLEANER_NO_PQS, pqsScores: { "test-r1-cat": 80 } },
    R1_AMMO,
    { completedOrders: 0, complaints: 0 },
  );
  assert.equal(v.outcome, "ADMITTED");
  assert.match(v.reason ?? "", /transfer-returning/);
});

test("试单熔断：有效投诉即 REJECTED（期满也救不回）", () => {
  const v = evaluateTransfer(CLEANER_NO_PQS, R1_AMMO, { completedOrders: 5, complaints: 1 });
  assert.equal(v.outcome, "REJECTED");
  assert.match(v.reason ?? "", /transfer-fused/);
});

test("期满转正：5/5 无投诉 → ADMITTED", () => {
  const v = evaluateTransfer(CLEANER_NO_PQS, R1_AMMO, { completedOrders: 5, complaints: 0 });
  assert.equal(v.outcome, "ADMITTED");
  assert.match(v.reason ?? "", /transfer-graduated/);
});

test("R3 直通：meetup 无 PQS 也 ADMITTED（硬门槛仍在：PROXIMITY 引信须公安核验）", () => {
  // 组局挂 DELAY＋PROXIMITY 引信：无公安核验先被硬门槛拦（转岗不赦免强合规）
  const noPolice: ITriDimensionalCredit = { bcsScore: 80, pqsScores: {}, esfScore: 80, isPoliceVerified: false };
  assert.equal(evaluateTransfer(noPolice, meetupAmmo, { completedOrders: 0, complaints: 0 }).outcome, "REJECTED");
  // 公安核验过＋无 PQS → R3 直通
  const rookie: ITriDimensionalCredit = { ...noPolice, isPoliceVerified: true };
  const v = evaluateTransfer(rookie, meetupAmmo, { completedOrders: 0, complaints: 0 });
  assert.equal(v.outcome, "ADMITTED");
  assert.match(v.reason ?? "", /transfer-r3/);
});

test("家政实弹：R1＋5 单＋日限 2（显式声明与推导一致）", () => {
  const p = resolveTransferPolicy(housekeepingAmmo);
  assert.equal(p.riskTier, "R1");
  assert.equal(p.probationOrders, 5);
  assert.equal(p.dailyCap, 2);
  assert.equal(p.fuseOnComplaint, true);
});
