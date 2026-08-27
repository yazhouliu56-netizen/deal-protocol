/**
 * 标杆弹药 pet-boarding-v1 全流程测试（方向 B · 第 5 弹 · C2_IN_HOME）：
 * 8D 全息契约与流水线出厂（资金守恒 0.85+0.10+0.05 / 加价熔断 / 双证准入）→
 * 中文别名直拨（宠物寄养/寄养/猫咪寄养…）→ C2 三维信用准入（一票熔断）→
 * 碰炸引信核验 → 增项熔断（base 100 加价 50 放行 / 60 阻断）→
 * 全流程（MATCHED → IN_SERVICE → INSPECTED → SETTLED）→ 85/10/5 分账守恒。
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  PET_BOARDING_HOLOGRAPHIC_CONFIG,
  petBoardingAmmo,
} from "./pet_boarding.ammo.ts";
import { assembleAmmo, validateAmmoConfig } from "./factory.ts";
import {
  advanceLifecycle,
  buildSettlementLedger,
  evaluateAmmoFuze,
} from "../base/ammo/runner.ts";
import { evaluateTriCreditAdmission } from "../base/trust/tri-credit.ts";
import { IMPACT_INHOME_FUZE_TEMPLATE } from "../types/fuze-policy.ts";
import type { ITriDimensionalCredit } from "../types/ammo-schema.ts";
import {
  DEFAULT_AMMO,
  getAmmoById,
  getAmmoDefinition,
  resolveAmmoIdForPublish,
} from "./registry.ts";

/* =====================================================================
 * 考卷常量（对准 D2 计价护栏：80 定额 / 增项 50% 熔断线）
 * ===================================================================== */

/** 基础寄养费（100 定额 + 50% 熔断线 = 50 增项上限）。 */
const BASE_YUAN = 100;
const FAIR_SURCHARGE_YUAN = 50;
const MALICIOUS_SURCHARGE_YUAN = 60;

/** 服务者 P：持健康证+宠物护理证的达标寄养师（C2 王牌）。 */
const PET_WORKER: ITriDimensionalCredit = {
  bcsScore: 80,
  pqsScores: { PET_BOARDING: 85 },
  esfScore: 82,
  isPoliceVerified: true,
};
/** 无公安核验（碰炸强合规一票熔断）。 */
const NO_POLICE_WORKER: ITriDimensionalCredit = {
  bcsScore: 80,
  pqsScores: { PET_BOARDING: 88 },
  esfScore: 85,
  isPoliceVerified: false,
};
/** 技能分 55 低于门槛（垂直技能隔离熔断）。 */
const LOW_PQS_WORKER: ITriDimensionalCredit = {
  bcsScore: 80,
  pqsScores: { PET_BOARDING: 55 },
  esfScore: 85,
  isPoliceVerified: true,
};

const interplayQuote = (totalYuan: number) => ({
  items: ["宠物特殊喂养加餐"],
  totalYuan,
  approved: true,
});

/* =====================================================================
 * 1. 8D 契约完整性与流水线出厂验证
 * ===================================================================== */

test("弹药装备完整性：pet-boarding-v1 声明式装填无误", () => {
  assert.equal(petBoardingAmmo.ammoId, "pet-boarding-v1");
  assert.equal(petBoardingAmmo.category, "PET_BOARDING");
  assert.equal(petBoardingAmmo.version, "1.0.0");
  assert.deepEqual(petBoardingAmmo.pricingModel, {
    kind: "FIXED",
    amountYuan: 80,
  });
  assert.deepEqual(petBoardingAmmo.fuzePolicy, IMPACT_INHOME_FUZE_TEMPLATE);
  assert.equal(petBoardingAmmo.fuzePolicy.fuzeTypes.length, 1);
  assert.deepEqual(petBoardingAmmo.fuzePolicy.fuzeTypes, ["IMPACT"]);
  assert.equal(petBoardingAmmo.fuzePolicy.sos.enabled, true);
  assert.equal(petBoardingAmmo.fuzePolicy.sos.autoLocationReport, true);
  assert.equal(petBoardingAmmo.fuzePolicy.sos.autoEvidenceAppend, true);
  assert.equal(petBoardingAmmo.fuzePolicy.sos.notifyEmergencyContacts, true);
  assert.equal(petBoardingAmmo.fiveStateHooks.length, 2);
  assert.ok(
    petBoardingAmmo.fiveStateHooks.some((h) => h.hookId === "operator.arrival-check")
  );
  assert.ok(
    petBoardingAmmo.fiveStateHooks.some((h) => h.hookId === "operator.cleaning-check")
  );
  assert.equal(petBoardingAmmo.sop?.capacityDefault, 1);
  assert.equal(petBoardingAmmo.sop?.depositDefault, true);
  assert.equal(petBoardingAmmo.sop?.depositRate, 0.2);
  assert.deepEqual(petBoardingAmmo.dispatchRule?.hardGates?.requiresVerified, [
    "宠物寄养",
    "上门",
  ]);
});

test("8D 全息出厂：D1~D8 逐维契约断言 + 出厂审查通过", () => {
  const c = PET_BOARDING_HOLOGRAPHIC_CONFIG;

  /* D1 供给准入：C2_IN_HOME 入户寄养 + 双证 + 公安核验 + 安全分 70 */
  assert.equal(c.supplyCluster, "C2_IN_HOME");
  assert.equal(c.workerRequirement?.requiredIdentityLevel, "REAL_NAME");
  assert.equal(c.workerRequirement?.minSafetyScore, 70);
  assert.equal(c.workerRequirement?.isPoliceVerified, true);
  assert.deepEqual(c.workerRequirement?.requiredCertificates, [
    "HEALTH_CERT",
    "PET_CARE_CERT",
  ]);

  /* D2 计价与护栏：80 定额 / 30~2000 护栏 / 增项 50% 熔断 */
  assert.deepEqual(c.pricingModel, { kind: "FIXED", amountYuan: 80 });
  assert.equal(c.minFloorPrice, 3000);
  assert.equal(c.maxCeilingPrice, 200000);
  assert.equal(c.maxSurchargeRatio, 0.5);

  /* D3 引信：碰炸（入户高信任 + 双拍 + SOS 四开关） */
  assert.deepEqual(c.fuzePolicy.fuzeTypes, ["IMPACT"]);
  assert.equal(c.fuzePolicy.backgroundCheck, "HARD");
  assert.equal(c.fuzePolicy.propertyInsurance, true);
  assert.equal(c.fuzePolicy.trace.photoProof, true);
  assert.equal(c.fuzePolicy.trace.evidenceChain, true);

  /* D4 传感降级：GPS 围栏 + 水印相机 */
  assert.deepEqual(c.requiredSensors, ["GPS_GEOFENCE", "WATERMARK_CAMERA"]);
  assert.deepEqual(c.sensorFallbackLadder?.GPS_GEOFENCE, [
    "CELL_TOWER_COARSE_GEO",
    "MANUAL_BASE_PHOTO_AUDIT",
  ]);
  assert.deepEqual(c.sensorFallbackLadder?.WATERMARK_CAMERA, ["HTML5_NATIVE_FALLBACK"]);

  /* D5 正向钩子：到场交接 + 双拍验收（2 算子白名单） */
  assert.deepEqual(c.forwardHooks, ["ArrivalCheckHook", "CleaningCheckHook"]);

  /* D6 逆向违约阶梯：匹配前全退 → 途中 80%+20 → 现场 50% → 服务中 0% */
  assert.equal(c.cancellationTiers?.length, 4);
  assert.deepEqual(c.cancellationTiers?.[0], {
    stage: "BEFORE_MATCH",
    demanderRefundRatio: 1,
    providerCompensationYuan: 0,
    deductDepositRatio: 0,
  });
  assert.deepEqual(c.cancellationTiers?.[1], {
    stage: "AFTER_MATCH_EN_ROUTE",
    demanderRefundRatio: 0.8,
    providerCompensationYuan: 20,
    deductDepositRatio: 0.2,
  });
  assert.deepEqual(c.cancellationTiers?.[2], {
    stage: "ON_SITE",
    demanderRefundRatio: 0.5,
    providerCompensationYuan: 0,
    deductDepositRatio: 0.5,
  });
  assert.deepEqual(c.cancellationTiers?.[3], {
    stage: "IN_SERVICE",
    demanderRefundRatio: 0,
    providerCompensationYuan: 0,
    deductDepositRatio: 1,
  });

  /* D6.5 SLA：30min/60min；D7：24h 验收 + 85/10/5 守恒 */
  assert.deepEqual(c.slaPhases, { ACCEPTED: 1800, DEPARTED: 3600 });
  assert.equal(c.autoAcceptanceTimeoutHours, 24);
  assert.equal(
    c.splitRules!.providerRatio + c.splitRules!.platformRatio + c.splitRules!.insuranceRatio,
    1
  );
  assert.deepEqual(c.splitRules, { providerRatio: 0.85, platformRatio: 0.1, insuranceRatio: 0.05 });

  /* D8 视界与表单：default + HousekeepingSlot + 宠物表单 */
  assert.equal(c.theme, "default");
  assert.equal(c.cockpitSlot, "HousekeepingSlot");
  assert.equal((c.formSchema as { petType?: { type: string } }).petType?.type, "select");
  assert.equal((c.formSchema as { petType?: { required: boolean } }).petType?.required, true);

  /* 出厂审查 */
  const verdict = validateAmmoConfig(c);
  assert.deepEqual(verdict, { ok: true });
});

test("工厂出厂验证：assembleAmmo 二次出厂 ok + 全图 deepFreeze", () => {
  const assembled = assembleAmmo(PET_BOARDING_HOLOGRAPHIC_CONFIG);
  assert.equal(assembled.ok, true);
  assert.ok(assembled.ok && Object.isFrozen(assembled.ammo));
  assert.ok(assembled.ok && Object.isFrozen(petBoardingAmmo.holographic));
  assert.ok(assembled.ok && Object.isFrozen(petBoardingAmmo.holographic?.splitRules));
  if (assembled.ok) {
    assert.equal(assembled.ammo.ammoId, "pet-boarding-v1");
    assert.equal(assembled.ammo.maxSurchargeRatio, 0.5);
    assert.equal(assembled.ammo.autoAcceptanceTimeoutHours, 24);
  }
});

/* =====================================================================
 * 2. 注册表挂载与中文别名直拨
 * ===================================================================== */

test("注册表：PET_BOARDING 类目键精确解析整弹 + getAmmoById 反查", () => {
  assert.equal(getAmmoDefinition("PET_BOARDING").ammoId, "pet-boarding-v1");
  assert.equal(getAmmoDefinition("pet_boarding").ammoId, "pet-boarding-v1");
  assert.equal(getAmmoDefinition("pet-boarding").ammoId, "pet-boarding-v1");
  assert.equal(getAmmoById("pet-boarding-v1"), petBoardingAmmo);
  assert.equal(getAmmoDefinition("不存在类目").ammoId, DEFAULT_AMMO.ammoId);
});

test("别名直拨：宠物寄养六连别名全部解析至 pet-boarding-v1", () => {
  const aliases = [
    "宠物寄养",
    "寄养",
    "猫咪寄养",
    "狗狗寄养",
    "家庭寄养",
    "宠物托养",
  ];
  for (const a of aliases) {
    assert.equal(resolveAmmoIdForPublish(a), "pet-boarding-v1", `别名「${a}」直拨`);
  }
});

/* =====================================================================
 * 3. C2 准入门槛与资质拦截
 * ===================================================================== */

test("C2 准入：持双证达标寄养师（公安核验 + 技能 85）通过", () => {
  const r = evaluateTriCreditAdmission(PET_WORKER, petBoardingAmmo);
  assert.equal(r.isAdmitted, true, r.reason);
});

test("C2 准入：无公安背调一票熔断", () => {
  const r = evaluateTriCreditAdmission(NO_POLICE_WORKER, petBoardingAmmo);
  assert.equal(r.isAdmitted, false);
  assert.ok(r.reason?.includes("police-verification-required"), r.reason);
});

test("C2 准入：技能分低于门槛 → 垂直技能隔离熔断", () => {
  const e = evaluateTriCreditAdmission(LOW_PQS_WORKER, petBoardingAmmo);
  assert.equal(e.isAdmitted, false);
  assert.ok(e.reason?.includes("pqs[PET_BOARDING]"), e.reason);
});

/* =====================================================================
 * 4. 碰炸引信核验
 * ===================================================================== */

test("碰炸引信：裸核验拦截 + 就绪放行", () => {
  const bare = evaluateAmmoFuze(petBoardingAmmo.fuzePolicy, {});
  assert.equal(bare.pass, false);
  assert.ok(bare.checks.some((c) => c.rule === "backgroundCheck"));
  assert.ok(bare.checks.some((c) => c.rule === "deposit"));

  const armed = evaluateAmmoFuze(petBoardingAmmo.fuzePolicy, {
    backgroundVerified: true,
    depositHeld: true,
  });
  assert.equal(armed.pass, true);
});

/* =====================================================================
 * 5. 增项熔断 50%
 * ===================================================================== */

test("增项熔断：基础 100 / 加价 50（=50%上限）→ 放行", async () => {
  const r = await advanceLifecycle({
    ammo: petBoardingAmmo,
    orderId: "pet-gouge-ok",
    from: "MATCHED",
    to: "IN_SERVICE",
    payload: {
      arrival: { confirmed: true, at: 1_750_000_000_000 },
      baseAmountYuan: BASE_YUAN,
      onsiteQuote: interplayQuote(FAIR_SURCHARGE_YUAN),
    },
  });
  assert.equal(r.ok, true, r.reason);
  assert.equal(r.state, "IN_SERVICE");
});

test("增项熔断：基础 100 / 加价 60（>50%）→ BLOCK", async () => {
  const r = await advanceLifecycle({
    ammo: petBoardingAmmo,
    orderId: "pet-gouge-block",
    from: "MATCHED",
    to: "IN_SERVICE",
    payload: {
      arrival: { confirmed: true, at: 1_750_000_000_000 },
      baseAmountYuan: BASE_YUAN,
      onsiteQuote: interplayQuote(MALICIOUS_SURCHARGE_YUAN),
    },
  });
  assert.equal(r.ok, false);
  assert.equal(r.state, "MATCHED");
  assert.match(r.reason ?? "", /ANTI_GOUGING_LIMIT_EXCEEDED/);
});

/* =====================================================================
 * 6. 全生命周期（2 算子钩子联动）
 * ===================================================================== */

test("全流程：MATCHED → IN_SERVICE（到场+增项）→ INSPECTED（双拍）→ SETTLED", async () => {
  const inService = await advanceLifecycle({
    ammo: petBoardingAmmo,
    orderId: "pet-lifecycle-1",
    from: "MATCHED",
    to: "IN_SERVICE",
    payload: {
      arrival: { confirmed: true, at: 1_750_000_000_000 },
      baseAmountYuan: BASE_YUAN,
      onsiteQuote: interplayQuote(FAIR_SURCHARGE_YUAN),
    },
  });
  assert.equal(inService.ok, true, inService.reason);
  assert.equal(inService.state, "IN_SERVICE");
  // 2 算子：arrival-check + onsite-quote（或 cleaning 前置校验）
  assert.ok(inService.hookOutcomes.length >= 1);
  assert.ok(inService.hookOutcomes.some((h) => h.ok));

  const inspected = await advanceLifecycle({
    ammo: petBoardingAmmo,
    orderId: "pet-lifecycle-1",
    from: "IN_SERVICE",
    to: "INSPECTED",
    payload: {
      photos: { before: ["pet-before.jpg"], after: ["pet-after-1.jpg"] },
    },
  });
  assert.equal(inspected.ok, true, inspected.reason);
  assert.equal(inspected.state, "INSPECTED");
  assert.ok(inspected.hookOutcomes.some((h) => h.hookId === "operator.cleaning-check" && h.ok));

  const settled = await advanceLifecycle({
    ammo: petBoardingAmmo,
    orderId: "pet-lifecycle-1",
    from: "INSPECTED",
    to: "SETTLED",
  });
  assert.equal(settled.ok, true, settled.reason);
  assert.equal(settled.state, "SETTLED");
});

/* =====================================================================
 * 7. 24h 验收期与 85/10/5 分账守恒
 * ===================================================================== */

test("分账守恒：总额 100 → 服务者 85 / 平台 10 / 保险 5", () => {
  const file = buildSettlementLedger({
    ammo: petBoardingAmmo,
    orderId: "pet-settle-1",
    amount: 100,
  });
  const split = file.split;
  assert.ok(split);
  assert.equal(split.providerIncome, 85);
  assert.equal(split.platformIncome, 10);
  assert.equal(split.insuranceFee, 5);
  assert.equal(split.providerIncome + split.platformIncome + (split.insuranceFee ?? 0), 100);
});

test("分账守恒：大额 2000 → 1700/200/100 精确守恒", () => {
  const file = buildSettlementLedger({
    ammo: petBoardingAmmo,
    orderId: "pet-settle-2",
    amount: 2000,
  });
  const split = file.split;
  assert.ok(split);
  assert.equal(split.providerIncome, 1700);
  assert.equal(split.platformIncome, 200);
  assert.equal(split.insuranceFee, 100);
  assert.equal(split.providerIncome + split.platformIncome + (split.insuranceFee ?? 0), 2000);
});

/* =====================================================================
 * 8. 违约阶梯
 * ===================================================================== */

test("违约阶梯：四阶梯完整且资金维度合法", () => {
  const tiers = PET_BOARDING_HOLOGRAPHIC_CONFIG.cancellationTiers ?? [];
  assert.equal(tiers.length, 4);
  for (const t of tiers) {
    assert.ok(t.demanderRefundRatio >= 0 && t.demanderRefundRatio <= 1, `stage ${t.stage}`);
    assert.ok(t.deductDepositRatio >= 0 && t.deductDepositRatio <= 1, `stage ${t.stage}`);
    assert.ok(t.providerCompensationYuan >= 0, `stage ${t.stage}`);
  }
});
