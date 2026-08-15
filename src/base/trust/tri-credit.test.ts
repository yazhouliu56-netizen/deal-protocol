/**
 * 漏洞二闭环 · 三维解耦信用雷达引擎测试：
 * 强合规一票熔断（公安核验 + ESF）/ 垂直技能类目隔离（PQS 禁通兑）/
 * 合规定向押金折抵（单维度上限）与守恒。
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  DEFAULT_ESF_GATE,
  evaluateDepositWaiver,
  evaluateTriCreditAdmission,
} from "./tri-credit.ts";
import type { IAmmoDefinition, ITriDimensionalCredit } from "../../types/ammo-schema.ts";
import { IMPACT_FUZE_TEMPLATE, PROXIMITY_FUZE_TEMPLATE, DELAY_FUZE_TEMPLATE } from "../../types/fuze-policy.ts";
import { housekeepingAmmo } from "../../ammo/housekeeping.ammo.ts";
import { meetupAmmo } from "../../ammo/meetup.ammo.ts";

/** 满分三维信用（BCS 99 / PQS 家政 95 / ESF 95 / 公安核验）——全维度顶尖。 */
const PERFECT: ITriDimensionalCredit = {
  bcsScore: 99,
  pqsScores: { housekeeping: 95 },
  esfScore: 95,
  isPoliceVerified: true,
};

const NO_FUZE_AMMO: IAmmoDefinition = {
  ammoId: "test-plain",
  category: "test",
  version: "1.0.0",
  fiveStateHooks: [],
  pricingModel: { kind: "FIXED", amountYuan: 100 },
  fuzePolicy: { fuzeId: "fuze-none", fuzeTypes: [] },
};

/* ============ 1. 强合规隔离（一票熔断） ============ */

test("准入：全维度顶尖 + 公安核验 → 入户类目放行", () => {
  const r = evaluateTriCreditAdmission(PERFECT, housekeepingAmmo);
  assert.equal(r.isAdmitted, true);
});

test("准入：BCS 满分但无公安核验 → 入户保洁一票熔断", () => {
  const r = evaluateTriCreditAdmission(
    { ...PERFECT, isPoliceVerified: false },
    housekeepingAmmo,
  );
  assert.equal(r.isAdmitted, false);
  assert.match(r.reason ?? "", /police-verification-required/);
});

test("准入：BCS 满分但 ESF 不及格（50 < 弹药门槛 60）→ 一票熔断", () => {
  const r = evaluateTriCreditAdmission(
    { ...PERFECT, esfScore: 50 },
    housekeepingAmmo,
  );
  assert.equal(r.isAdmitted, false);
  assert.match(r.reason ?? "", /esf-score 50 < gate 60/);
});

test("准入：PROXIMITY 近炸引信（密闭空间）同样强制强合规闸", () => {
  const proximityAmmo: IAmmoDefinition = {
    ...housekeepingAmmo,
    ammoId: "proximity-test",
    fuzePolicy: PROXIMITY_FUZE_TEMPLATE,
  };
  const r = evaluateTriCreditAdmission(
    { ...PERFECT, isPoliceVerified: false, pqsScores: { ...PERFECT.pqsScores, "proximity-test": 90 } },
    proximityAmmo,
  );
  assert.equal(r.isAdmitted, false);
  assert.match(r.reason ?? "", /police-verification-required/);
});

test("准入：ESF 门槛缺省兜底（未声明 minSafetyScore 的 IMPACT 弹药按 70）", () => {
  const impactNoReq: IAmmoDefinition = {
    ...NO_FUZE_AMMO,
    ammoId: "impact-noreq",
    fuzePolicy: IMPACT_FUZE_TEMPLATE,
  };
  const lowEsf = evaluateTriCreditAdmission(
    { ...PERFECT, esfScore: 65, pqsScores: { test: 90 } },
    impactNoReq,
  );
  assert.equal(lowEsf.isAdmitted, false);
  assert.match(lowEsf.reason ?? "", new RegExp(`esf-score 65 < gate ${DEFAULT_ESF_GATE}`));
  const passEsf = evaluateTriCreditAdmission(
    { ...PERFECT, esfScore: 72, pqsScores: { test: 90 } },
    impactNoReq,
  );
  assert.equal(passEsf.isAdmitted, true);
});

test("准入：DELAY 延期引信（轻履约）不触发强合规闸", () => {
  const delayAmmo: IAmmoDefinition = {
    ...NO_FUZE_AMMO,
    ammoId: "delay-test",
    fuzePolicy: DELAY_FUZE_TEMPLATE,
  };
  const r = evaluateTriCreditAdmission(
    { ...PERFECT, isPoliceVerified: false, pqsScores: { test: 80 } },
    delayAmmo,
  );
  assert.equal(r.isAdmitted, true);
});

/* ============ 2. 垂直技能隔离（PQS 类目精确匹配） ============ */

test("技能隔离：组局守时分无法通兑为家政技能分（PQS 缺失 → 拒绝）", () => {
  const r = evaluateTriCreditAdmission(
    { ...PERFECT, pqsScores: { social: 98 } },
    housekeepingAmmo,
  );
  assert.equal(r.isAdmitted, false);
  assert.match(r.reason ?? "", /pqs\[housekeeping\] missing/);
  assert.match(r.reason ?? "", /禁止跨类目通兑/);
});

test("技能隔离：家政 PQS 90 ≥ 门槛 60 放行；40 分 → 拒绝", () => {
  const ok = evaluateTriCreditAdmission(
    { ...PERFECT, pqsScores: { housekeeping: 90 } },
    housekeepingAmmo,
  );
  assert.equal(ok.isAdmitted, true);
  const low = evaluateTriCreditAdmission(
    { ...PERFECT, pqsScores: { housekeeping: 40 } },
    housekeepingAmmo,
  );
  assert.equal(low.isAdmitted, false);
  assert.match(low.reason ?? "", /pqs\[housekeeping\] 40 < gate 60/);
});

test("通用底线：BCS < 50 全类目拒绝（移动轻履约也不放行）", () => {
  const r = evaluateTriCreditAdmission(
    { ...PERFECT, bcsScore: 45, pqsScores: { social: 90 } },
    meetupAmmo,
  );
  assert.equal(r.isAdmitted, false);
  assert.match(r.reason ?? "", /bcs-score 45 < 50/);
});

test("非法分数（NaN / 越界）→ 拒绝且不抛异常", () => {
  const bad = evaluateTriCreditAdmission(
    { bcsScore: NaN, pqsScores: {}, esfScore: 90, isPoliceVerified: true },
    NO_FUZE_AMMO,
  );
  assert.equal(bad.isAdmitted, false);
  assert.match(bad.reason ?? "", /score out of 0-100/);
});

/* ============ 3. 合规定向押金折抵（单维度上限 + 守恒） ============ */

test("折抵：housekeeping 安全分折抵（ESF 80 / 押金 200 → 折 40 = 20% 上限内）", () => {
  const r = evaluateDepositWaiver(
    { ...PERFECT, esfScore: 80 },
    housekeepingAmmo,
    200,
  );
  // ratio = min(0.5, 0.8 × 0.5) = 0.4 → 折抵 80
  assert.equal(r.waivedDepositYuan, 80);
  assert.equal(r.requiredDepositYuan, 120);
  assert.equal(r.waivedDepositYuan + r.requiredDepositYuan, 200); // 守恒
});

test("折抵：ESF 满分 100 → 折抵达声明上限 50%（150 / 300）", () => {
  const r = evaluateDepositWaiver(
    { ...PERFECT, esfScore: 100 },
    housekeepingAmmo,
    300,
  );
  assert.equal(r.waivedDepositYuan, 150);
  assert.equal(r.requiredDepositYuan, 150);
});

test("折抵：meetup 守时分折抵（BCS 90 / 定金 100 → 折 45 = 45% ≤ 上限 50%）", () => {
  const r = evaluateDepositWaiver(
    { ...PERFECT, bcsScore: 90, pqsScores: {} },
    meetupAmmo,
    100,
  );
  assert.equal(r.waivedDepositYuan, 45);
  assert.equal(r.requiredDepositYuan, 55);
});

test("折抵：跨维度滥用被拒（SKILL_LEVEL 声明维度本引擎不开放 → 零折抵）", () => {
  const skillRuleAmmo: IAmmoDefinition = {
    ...NO_FUZE_AMMO,
    creditWaiverRule: {
      allowedCreditDimension: "SKILL_LEVEL",
      maxWaiverPercentage: 0.5,
    },
  };
  const r = evaluateDepositWaiver(PERFECT, skillRuleAmmo, 200);
  assert.equal(r.waivedDepositYuan, 0);
  assert.equal(r.requiredDepositYuan, 200);
});

test("折抵：未声明 creditWaiverRule → 零折抵保守兜底", () => {
  const r = evaluateDepositWaiver(PERFECT, NO_FUZE_AMMO, 200);
  assert.equal(r.waivedDepositYuan, 0);
  assert.equal(r.requiredDepositYuan, 200);
});

test("折抵：非法押金（0 / 负数 / NaN）→ 零折抵零要求", () => {
  for (const bad of [0, -50, NaN]) {
    const r = evaluateDepositWaiver(PERFECT, housekeepingAmmo, bad);
    assert.equal(r.waivedDepositYuan, 0);
    assert.equal(r.requiredDepositYuan, 0);
  }
});
