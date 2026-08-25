/**
 * 标杆弹药 appliance-repair-v1 全流程测试（Phase 2 扩品实战 · 第 4 枚 · C3_TECH_B2B）：
 * 8D 全息契约与流水线出厂（资金守恒 0.82+0.13+0.05 / 加价熔断 / 双证书准入）→
 * 中文别名直拨（家电维修/修空调/水电维修…）→ C3 三维信用准入（无背调一票熔断）→
 * 碰炸引信核验 → 增项熔断（base 100 加价 50 放行 / 60 阻断）→
 * 全流程（MATCHED → IN_SERVICE → INSPECTED → SETTLED）→ 82/13/5 分账守恒。
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  APPLIANCE_REPAIR_HOLOGRAPHIC_CONFIG,
  applianceRepairAmmo,
} from "./appliance_repair.ammo.ts";
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
 * 考卷常量（对准 D2 计价护栏：¥30 上门检测费起步 / 增项 50% 熔断线）
 * ===================================================================== */

/** 基础检测费（¥100 单 + 50% 熔断线 = ¥50 增项上限）。 */
const BASE_YUAN = 100;
const FAIR_SURCHARGE_YUAN = 50;
const BOUNDARY_SURCHARGE_YUAN = 50;
const MALICIOUS_SURCHARGE_YUAN = 60;

/** 服务者 T：持电工+家电维修双证书的达标技师画像（C3 王牌工人）。 */
const TECH_WORKER: ITriDimensionalCredit = {
  bcsScore: 80,
  pqsScores: { APPLIANCE_REPAIR: 88 },
  esfScore: 82,
  isPoliceVerified: true,
};
/** 服务者 N：未过公安无犯罪背调（技能满格但准入一票熔断）。 */
const NO_POLICE_WORKER: ITriDimensionalCredit = {
  bcsScore: 80,
  pqsScores: { APPLIANCE_REPAIR: 88 },
  esfScore: 85,
  isPoliceVerified: false,
};
/** 服务者 L：技能分 55 低于类目门槛 70（垂直技能按类目隔离熔断）。 */
const LOW_PQS_WORKER: ITriDimensionalCredit = {
  bcsScore: 80,
  pqsScores: { APPLIANCE_REPAIR: 55 },
  esfScore: 85,
  isPoliceVerified: true,
};

const interplayQuote = (totalYuan: number) => ({
  items: ["更换空调电容"],
  totalYuan,
  approved: true,
});

/* =====================================================================
 * 1. 8D 契约完整性与流水线出厂验证
 * ===================================================================== */

test("弹药装备完整性：appliance-repair-v1 声明式装填无误", () => {
  assert.equal(applianceRepairAmmo.ammoId, "appliance-repair-v1");
  assert.equal(applianceRepairAmmo.category, "APPLIANCE_REPAIR");
  assert.equal(applianceRepairAmmo.version, "1.0.0");
  assert.deepEqual(applianceRepairAmmo.pricingModel, {
    kind: "FORMULA",
    formulaId: "appliance-repair-formula",
    params: { baseRate: 30, baseDurationMin: 60 },
  });
  assert.deepEqual(applianceRepairAmmo.fuzePolicy, IMPACT_INHOME_FUZE_TEMPLATE);
  assert.equal(applianceRepairAmmo.fuzePolicy.fuzeTypes.length, 1);
  assert.deepEqual(applianceRepairAmmo.fuzePolicy.fuzeTypes, ["IMPACT"]);
  /* P1-3 加固：入户武装版 SOS 四开关全开（指挥官裁决 2026-08-25，宪法 #5） */
  assert.equal(applianceRepairAmmo.fuzePolicy.sos.enabled, true);
  assert.equal(applianceRepairAmmo.fuzePolicy.sos.autoLocationReport, true);
  assert.equal(applianceRepairAmmo.fuzePolicy.sos.autoEvidenceAppend, true);
  assert.equal(applianceRepairAmmo.fuzePolicy.sos.notifyEmergencyContacts, true);
  assert.equal(applianceRepairAmmo.fiveStateHooks.length, 3);
  assert.ok(
    applianceRepairAmmo.fiveStateHooks.some((h) => h.hookId === "operator.arrival-check")
  );
  assert.ok(
    applianceRepairAmmo.fiveStateHooks.some((h) => h.hookId === "operator.onsite-quote")
  );
  assert.ok(
    applianceRepairAmmo.fiveStateHooks.some((h) => h.hookId === "operator.cleaning-check")
  );
  assert.equal(applianceRepairAmmo.sop?.capacityDefault, 1);
  assert.equal(applianceRepairAmmo.sop?.depositDefault, true);
  assert.equal(applianceRepairAmmo.sop?.depositRate, 0.2);
  assert.deepEqual(applianceRepairAmmo.dispatchRule?.hardGates?.requiresVerified, [
    "家电维修",
    "上门",
  ]);
});

test("8D 全息出厂：D1~D8 逐维契约断言 + 出厂审查通过", () => {
  const c = APPLIANCE_REPAIR_HOLOGRAPHIC_CONFIG;

  /* D1 供给准入：C3_TECH_B2B 技术资产聚类 + 双证书 + 公安核验 */
  assert.equal(c.supplyCluster, "C3_TECH_B2B");
  assert.equal(c.workerRequirement?.requiredIdentityLevel, "REAL_NAME");
  assert.equal(c.workerRequirement?.minSafetyScore, 70);
  assert.equal(c.workerRequirement?.isPoliceVerified, true);
  assert.deepEqual(c.workerRequirement?.requiredCertificates, [
    "ELECTRICIAN_CERT",
    "APPLIANCE_MAINTENANCE_CERT",
  ]);

  /* D2 计价与护栏：¥30 起步 / ¥30~¥3000 护栏 / 增项 50% 熔断 / 技能分折抵 ≤30% */
  assert.deepEqual(c.pricingParams, { baseRate: 30, baseDurationMin: 60 });
  assert.equal(c.minFloorPrice, 3000);
  assert.equal(c.maxCeilingPrice, 300000);
  assert.equal(c.maxSurchargeRatio, 0.5);
  assert.equal(c.creditWaiverRule?.allowedCreditDimension, "SKILL_LEVEL");
  assert.equal(c.creditWaiverRule?.maxWaiverPercentage, 0.3);

  /* D3 引信：碰炸（入户高财产 + 双拍存证 + 强实名） */
  assert.deepEqual(c.fuzePolicy.fuzeTypes, ["IMPACT"]);
  assert.equal(c.fuzePolicy.backgroundCheck, "HARD");
  assert.equal(c.fuzePolicy.propertyInsurance, true);
  assert.equal(c.fuzePolicy.trace.photoProof, true);
  assert.equal(c.fuzePolicy.trace.evidenceChain, true);

  /* D4 传感降级：GPS 围栏 + 水印相机逐级回退 */
  assert.deepEqual(c.requiredSensors, ["GPS_GEOFENCE", "WATERMARK_CAMERA"]);
  assert.deepEqual(c.sensorFallbackLadder?.GPS_GEOFENCE, [
    "CELL_TOWER_COARSE_GEO",
    "MANUAL_BASE_PHOTO_AUDIT",
  ]);
  assert.deepEqual(c.sensorFallbackLadder?.WATERMARK_CAMERA, ["HTML5_NATIVE_FALLBACK"]);

  /* D5 正向钩子：到点履约 + 现场增项 + 双拍验收（三算子白名单） */
  assert.deepEqual(c.forwardHooks, [
    "ArrivalCheckHook",
    "OnsiteQuoteHook",
    "CleaningCheckHook",
  ]);

  /* D6 逆向违约阶梯：匹配前全退 → 途退 80%+20 → 现场扣检测费退剩余 → 服务中 0% 退 */
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
    demanderRefundRatio: 0.7,
    providerCompensationYuan: 30,
    deductDepositRatio: 0,
  });
  assert.deepEqual(c.cancellationTiers?.[3], {
    stage: "IN_SERVICE",
    demanderRefundRatio: 0,
    providerCompensationYuan: 0,
    deductDepositRatio: 1,
  });

  /* D7 清算与仲裁：48h 质保验收期 + 82/13/5 资金守恒 */
  assert.equal(c.autoAcceptanceTimeoutHours, 48);
  assert.equal(
    c.splitRules?.providerRatio + c.splitRules!.platformRatio + c.splitRules!.insuranceRatio,
    1
  );
  assert.deepEqual(c.splitRules, { providerRatio: 0.82, platformRatio: 0.13, insuranceRatio: 0.05 });

  /* D8 视界与表单：default 主题 + HousekeepingSlot 座舱 + 家电表单 schema */
  assert.equal(c.theme, "default");
  assert.equal(c.cockpitSlot, "HousekeepingSlot");
  assert.deepEqual((c.formSchema as { applianceType?: { type: string; required: boolean } }).applianceType?.type, "select");
  assert.equal((c.formSchema as { faultDescription?: { required: boolean } }).faultDescription?.required, true);

  /* 出厂审查：validateAmmoConfig 静态 Linter 全项通过 */
  const verdict = validateAmmoConfig(c);
  assert.deepEqual(verdict, { ok: true });
});

test("工厂出厂验证：assembleAmmo 二次出厂 ok + 全图 deepFreeze 冻结不可变", () => {
  const assembled = assembleAmmo(APPLIANCE_REPAIR_HOLOGRAPHIC_CONFIG);
  assert.equal(assembled.ok, true);
  assert.ok(assembled.ok && Object.isFrozen(assembled.ammo));
  assert.ok(assembled.ok && Object.isFrozen(applianceRepairAmmo.holographic));
  assert.ok(assembled.ok && Object.isFrozen(applianceRepairAmmo.holographic?.splitRules));
  if (assembled.ok) {
    assert.equal(assembled.ammo.ammoId, "appliance-repair-v1");
    assert.equal(assembled.ammo.maxSurchargeRatio, 0.5);
    assert.equal(assembled.ammo.autoAcceptanceTimeoutHours, 48);
  }
});

/* =====================================================================
 * 2. 注册表挂载与中文别名直拨
 * ===================================================================== */

test("注册表：APPLIANCE_REPAIR 类目键精确解析整弹 + getAmmoById 反查", () => {
  assert.equal(getAmmoDefinition("APPLIANCE_REPAIR").ammoId, "appliance-repair-v1");
  assert.equal(getAmmoDefinition("appliance_repair").ammoId, "appliance-repair-v1");
  assert.equal(getAmmoById("appliance-repair-v1"), applianceRepairAmmo);
  assert.equal(getAmmoDefinition("不存在类目").ammoId, DEFAULT_AMMO.ammoId);
});

test("别名直拨：家电维修七连别名全部解析至 appliance-repair-v1", () => {
  const aliases = [
    "家电维修",
    "维修",
    "修空调",
    "修洗衣机",
    "修冰箱",
    "修油烟机",
    "水电维修",
  ];
  for (const a of aliases) {
    assert.equal(resolveAmmoIdForPublish(a), "appliance-repair-v1", `别名「${a}」直拨`);
  }
});

/* =====================================================================
 * 3. C3 准入门槛与资质拦截（三维信用 · 强合规隔离）
 * ===================================================================== */

test("C3 准入：持双证书达标技师（公安核验 + 技能 88）通过准入", () => {
  const r = evaluateTriCreditAdmission(TECH_WORKER, applianceRepairAmmo);
  assert.equal(r.isAdmitted, true, r.reason);
  assert.equal(applianceRepairAmmo.workerRequirement?.requiredCertificates?.[0], "ELECTRICIAN_CERT");
  assert.equal(
    applianceRepairAmmo.workerRequirement?.requiredCertificates?.[1],
    "APPLIANCE_MAINTENANCE_CERT"
  );
  assert.equal(applianceRepairAmmo.workerRequirement?.requiredIdentityLevel, "REAL_NAME");
});

test("C3 准入：无公安背调服务者被一票熔断（碰炸引信强合规）", () => {
  const r = evaluateTriCreditAdmission(NO_POLICE_WORKER, applianceRepairAmmo);
  assert.equal(r.isAdmitted, false);
  assert.ok(r.reason?.includes("police-verification-required"), r.reason);
});

test("C3 准入：技能分低于 70 门槛 → 垂直技能按类目隔离熔断", () => {
  const e = evaluateTriCreditAdmission(LOW_PQS_WORKER, applianceRepairAmmo);
  assert.equal(e.isAdmitted, false);
  assert.ok(e.reason?.includes("pqs[APPLIANCE_REPAIR]"), e.reason);
});

/* =====================================================================
 * 4. 碰炸引信核验（💥 IMPACT：背调 + 押金双主闸）
 * ===================================================================== */

test("碰炸引信：裸核验拦截（背调缺失 + 押金未冻结）+ 就绪放行", () => {
  const bare = evaluateAmmoFuze(applianceRepairAmmo.fuzePolicy, {});
  assert.equal(bare.pass, false);
  assert.ok(bare.checks.some((c) => c.rule === "backgroundCheck"));
  assert.ok(bare.checks.some((c) => c.rule === "deposit"));

  const armed = evaluateAmmoFuze(applianceRepairAmmo.fuzePolicy, {
    backgroundVerified: true,
    depositHeld: true,
  });
  assert.equal(armed.pass, true);
});

/* =====================================================================
 * 5. BOM 配件增项加价与 50% 熔断（S2 商业防脆弱）
 * ===================================================================== */

test("增项熔断：基础检测费 100 / 现场加价 50（= 50% 上限）→ 放行进入服务", async () => {
  const r = await advanceLifecycle({
    ammo: applianceRepairAmmo,
    orderId: "ar-gouge-ok",
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

test("增项熔断：基础检测费 100 / 现场加价 60（> 50 元上限）→ BLOCK ANTI_GOUGING_LIMIT_EXCEEDED", async () => {
  const r = await advanceLifecycle({
    ammo: applianceRepairAmmo,
    orderId: "ar-gouge-block",
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
  assert.match(r.reason ?? "", /anti-gouging-blocked/);
});

test("增项熔断：恰好 50% 边界（base 200 / 增项 100）→ 放行", async () => {
  const r = await advanceLifecycle({
    ammo: applianceRepairAmmo,
    orderId: "ar-gouge-boundary",
    from: "MATCHED",
    to: "IN_SERVICE",
    payload: {
      arrival: { confirmed: true, at: 1_750_000_000_000 },
      baseAmountYuan: 200,
      onsiteQuote: { items: ["整机除湿除垢"], totalYuan: BOUNDARY_SURCHARGE_YUAN * 2, approved: true },
    },
  });
  assert.equal(r.ok, true, r.reason);
  assert.equal(r.state, "IN_SERVICE");
});

/* =====================================================================
 * 6. 全生命周期（三算子钩子联动）
 * ===================================================================== */

test("全流程：MATCHED → IN_SERVICE（到点+增项确认）→ INSPECTED（双拍验收）→ SETTLED", async () => {
  const inService = await advanceLifecycle({
    ammo: applianceRepairAmmo,
    orderId: "ar-lifecycle-1",
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
  assert.equal(inService.hookOutcomes.length, 2);
  assert.ok(inService.hookOutcomes.some((h) => h.hookId === "operator.arrival-check" && h.ok));
  assert.ok(inService.hookOutcomes.some((h) => h.hookId === "operator.onsite-quote" && h.ok));

  const inspected = await advanceLifecycle({
    ammo: applianceRepairAmmo,
    orderId: "ar-lifecycle-1",
    from: "IN_SERVICE",
    to: "INSPECTED",
    payload: {
      photos: { before: ["ar-before.jpg"], after: ["ar-after-1.jpg", "ar-after-2.jpg"] },
    },
  });
  assert.equal(inspected.ok, true, inspected.reason);
  assert.equal(inspected.state, "INSPECTED");
  assert.equal(inspected.hookOutcomes[0].hookId, "operator.cleaning-check");
  assert.equal(inspected.hookOutcomes[0].ok, true);
  const evidence = inspected.afterData[0] as { evidence?: { before: string[]; after: string[] } };
  assert.deepEqual(evidence.evidence?.before, ["ar-before.jpg"]);

  const settled = await advanceLifecycle({
    ammo: applianceRepairAmmo,
    orderId: "ar-lifecycle-1",
    from: "INSPECTED",
    to: "SETTLED",
  });
  assert.equal(settled.ok, true, settled.reason);
  assert.equal(settled.state, "SETTLED");
});

/* =====================================================================
 * 7. 48h 验收期与 82/13/5 分账守恒
 * ===================================================================== */

test("分账守恒：总额 100 → 服务者 82 / 平台 13 / 保险 5（三方 ≡ 总额）", () => {
  const file = buildSettlementLedger({
    ammo: applianceRepairAmmo,
    orderId: "ar-settle-1",
    amount: 100,
  });
  const split = file.split;
  assert.ok(split);
  assert.equal(split.providerIncome, 82);
  assert.equal(split.platformIncome, 13);
  assert.equal(split.insuranceFee, 5);
  const sum = split.providerIncome + split.platformIncome + (split.insuranceFee ?? 0);
  assert.equal(sum, 100);
});

test("分账守恒：大额单 2600 元 → 2132/338/130 三比精确守恒", () => {
  const file = buildSettlementLedger({
    ammo: applianceRepairAmmo,
    orderId: "ar-settle-2",
    amount: 2600,
  });
  const split = file.split;
  assert.ok(split);
  assert.equal(split.providerIncome, 2132);
  assert.equal(split.platformIncome, 338);
  assert.equal(split.insuranceFee, 130);
  assert.equal(split.providerIncome + split.platformIncome + (split.insuranceFee ?? 0), 2600);
});

/* =====================================================================
 * 8. 逆向违约阶梯（D6 资金三维度边界）
 * ===================================================================== */

test("违约阶梯：四阶梯结构完整且资金维度合法（比例 ∈[0,1]、补偿 ≥0）", () => {
  const tiers = APPLIANCE_REPAIR_HOLOGRAPHIC_CONFIG.cancellationTiers ?? [];
  assert.equal(tiers.length, 4);
  for (const t of tiers) {
    assert.ok(t.demanderRefundRatio >= 0 && t.demanderRefundRatio <= 1, `stage ${t.stage}`);
    assert.ok(t.deductDepositRatio >= 0 && t.deductDepositRatio <= 1, `stage ${t.stage}`);
    assert.ok(t.providerCompensationYuan >= 0, `stage ${t.stage}`);
  }
  /* ON_SITE 守恒语义（¥30 上门检测费 = D2 baseRate）：0.7 退款 + 30 元 = 100 元整单 */
  const onsite = tiers[2];
  assert.equal(onsite.demanderRefundRatio * 100 + onsite.providerCompensationYuan, 100);
});