/**
 * Microkernel 2.0 战役 3 · 工厂真·全自动考卷（三件套）：
 * ① 官方三协议投影字节级指纹快照（专线退役 → 数据字典重构的等价锁）；
 * ② registerDynamicAmmo 新弹「六引擎路」零外部开户全自动命中；
 * ③ 未知类目四表引擎默认兜底不抛异常。
 */

import { test } from "node:test";
import assert from "node:assert/strict";
import { getProtocol } from "./protocol-definitions.ts";
import {
  pricingForCategory,
  DEFAULT_PRICING,
} from "../../ammo/pricing-formula.ts";
import { dispatchRuleFor, DEFAULT_DISPATCH } from "../../ammo/dispatch-rule.ts";
import { riskRulesFor, homeAccessKeywordsFor, GLOBAL_RISK_RULES } from "../../ammo/risk-rule.ts";
import { sopForCategory, DEFAULT_SOP } from "../../ammo/sop.ts";
import { registerDynamicAmmo, DYNAMIC_AMMO_POOL } from "../../ammo/factory.ts";
import type { IHolographicAmmoConfig } from "../../types/ammo-schema.ts";
import { IMPACT_FUZE_TEMPLATE } from "../../types/fuze-policy.ts";

/* ══════════════════════════════════════════════════════════════════════
 * ① 官方三协议投影字节级指纹快照
 * （专线函数退役为 CATEGORY_PROTOCOL_META 数据字典，输出必须逐键等价）
 * ══════════════════════════════════════════════════════════════════════ */

test("快照：protocol_housekeeping 投影指纹与重构前逐键等价", () => {
  const d = getProtocol("protocol_housekeeping");
  assert.ok(d, "protocol_housekeeping 必须存在");
  assert.equal(d!.id, "protocol_housekeeping");
  assert.equal(d!.name, "家政");
  assert.equal(d!.category, "life_service");
  assert.equal(d!.states.length, 7);
  assert.equal(d!.transitions.length, 17);
  assert.equal(d!.funding.fees.platform_commission, 0.15);
  assert.equal(d!.funding.fees.satisfaction_hold, 0.1);
  assert.equal(d!.funding.autoReleaseTimeout, 7 * 86400);
  assert.deepEqual(d!.slaPhases, { ACCEPTED: 1800, DEPARTED: 3600 });
  assert.equal(d!.refundRules?.length, 6);
  assert.deepEqual(
    d!.evidence.map((e) => e.type),
    ["before_photo", "after_photo", "chat_log", "gps_track", "receipt"],
  );
  assert.equal(d!.review.dimensions.length, 5);
});

test("快照：protocol_meetup 投影指纹与重构前逐键等价", () => {
  const d = getProtocol("protocol_meetup");
  assert.ok(d, "protocol_meetup 必须存在");
  assert.equal(d!.id, "protocol_meetup");
  assert.equal(d!.name, "组局");
  assert.equal(d!.category, "social");
  assert.equal(d!.states.length, 6);
  assert.equal(d!.transitions.length, 12);
  assert.equal(d!.funding.mode, "commitment");
  assert.equal(d!.funding.fees.platform_commission, 0.12);
  assert.equal(d!.funding.autoReleaseTimeout, 6 * 3600);
  assert.deepEqual(d!.slaPhases, { ACCEPTED: 900 });
  assert.ok(d!.refundRules && d!.refundRules.length > 0);
  assert.deepEqual(
    d!.evidence.map((e) => e.type),
    ["gps_track", "scan_check", "photo"],
  );
});

test("快照：protocol_dating 投影指纹与重构前逐键等价", () => {
  const d = getProtocol("protocol_dating");
  assert.ok(d, "protocol_dating 必须存在");
  assert.equal(d!.id, "protocol_dating");
  assert.equal(d!.name, "陪玩/约会");
  assert.equal(d!.states.length, 6);
  assert.equal(d!.transitions.length, 12);
  assert.equal(d!.funding.mode, "commitment");
  assert.equal(d!.completion.trigger, "mutual_confirm");
});

test("快照：三官方投影 JSON 序列化稳定性（同进程两次投影逐字节一致）", () => {
  for (const id of ["protocol_housekeeping", "protocol_meetup", "protocol_dating"]) {
    const a = JSON.stringify(getProtocol(id));
    const b = JSON.stringify(getProtocol(id));
    assert.equal(a, b, `${id} 投影必须确定性`);
    assert.ok((a ?? "").length > 500, `${id} 投影非退化`);
  }
});

/* ══════════════════════════════════════════════════════════════════════
 * ② 动态新弹六引擎路全自动命中（零外部静态表编辑）
 * ══════════════════════════════════════════════════════════════════════ */

const PET_CATEGORY = "宠物寄养";

const petConfig: IHolographicAmmoConfig = {
  ammoId: "pet-boarding-v1",
  category: PET_CATEGORY,
  version: "1.0.0",
  supplyCluster: "C2_IN_HOME",
  workerRequirement: {
    requiredCertificates: ["PET_CARE_CERT"],
    minSafetyScore: 60,
    isPoliceVerified: true,
  },
  pricingModel: { kind: "FIXED", amountYuan: 88 },
  minFloorPrice: 6000,
  maxCeilingPrice: 50000,
  maxSurchargeRatio: 0.5,
  fuzePolicy: { ...IMPACT_FUZE_TEMPLATE, fuzeId: "fuze-pet-boarding" },
  requiredSensors: ["GPS_GEOFENCE"],
  forwardHooks: ["ArrivalCheckHook"],
  cancellationTiers: [
    { stage: "BEFORE_MATCH", demanderRefundRatio: 1, providerCompensationYuan: 0, deductDepositRatio: 0 },
    { stage: "IN_SERVICE", demanderRefundRatio: 0, providerCompensationYuan: 0, deductDepositRatio: 1 },
  ],
  fundingMode: "full_prepay",
  autoAcceptanceTimeoutHours: 24,
  splitRules: { providerRatio: 0.85, platformRatio: 0.1, insuranceRatio: 0.05 },
  theme: "default",
  aliases: [PET_CATEGORY, "寄养"],
  /* 战役 3 · 8D 自包含声明（零外部表编辑） */
  homeAccessKeywords: ["寄养看护", "上门喂宠"],
  declaredRiskRules: ["home-access-verification"],
  dispatchRule: {
    weights: { distance: 35, credit: 30, custom: 25, verifiedBonus: 10 },
    hardGates: { requiresVerified: ["宠物寄养"], banned: true, online: true },
  },
  sop: {
    depositDefault: true,
    expiresInMs: 4 * 3600_000,
    capacityDefault: 2,
    maxRounds: 2,
    reviewWindowMs: 24 * 3600_000,
    depositRate: 0.15,
  },
};

test("战役3终态：registerDynamicAmmo 后六引擎路零编辑全自动生效", async () => {
  const r = registerDynamicAmmo(petConfig);
  assert.equal(r.ok, true, `动态弹装配被拒: ${!r.ok ? r.errors.join("; ") : ""}`);
  if (!r.ok) return;

  // 路1 计价：FIXED 模型合成最小公式（无表行 → 弹药自带生效）
  const pricing = pricingForCategory(PET_CATEGORY);
  assert.equal(pricing.baseRateYuan, 88);
  assert.equal(pricing.minPriceYuan, 60); // minFloorPrice 6000 分 → 60 元

  // 路2 派单：弹自带 dispatchRule 直通
  const dispatch = dispatchRuleFor(PET_CATEGORY);
  assert.deepEqual(dispatch.weights, petConfig.dispatchRule!.weights);

  // 路3 风控：declaredRiskRules 并入 enabled 集（home-access 引信点亮）
  // 路4 进家词表：holographic.homeAccessKeywords 整表生效
  assert.deepEqual(homeAccessKeywordsFor(PET_CATEGORY), ["寄养看护", "上门喂宠"]);

  // 路5 SOP：弹自带 sop 覆盖默认
  const sop = sopForCategory(PET_CATEGORY);
  assert.equal(sop.depositDefault, true);
  assert.equal(sop.capacityDefault, 2);

  // 路6 协议：getProtocol 全真解析动态池弹药（BASE 骨架兜底投影）
  const proto = getProtocol("pet-boarding-v1") ?? getProtocol(PET_CATEGORY);
  assert.ok(proto, "动态弹药协议应可全真解析");
  assert.equal(proto!.id, "protocol_pet-boarding-v1");
  assert.equal(proto!.funding.mode, "full_prepay");
  assert.ok(proto!.evidence.some((e) => e.type === "gps_track"));
});

test("战役3回归护栏：官方类目行为不被动态链污染", () => {
  assert.equal(DYNAMIC_AMMO_POOL.has("家政保洁"), false);
  assert.equal(dispatchRuleFor("家政保洁").weights.distance, 40);
  assert.equal(sopForCategory("家政保洁").depositRate, 0.2);
  assert.deepEqual(
    homeAccessKeywordsFor("家政保洁"),
    ["保洁", "上门", "入户", "打扫", "做卫生", "擦玻璃", "家政"],
  );
});

/* ══════════════════════════════════════════════════════════════════════
 * ③ 未知类目默认兜底（零异常）
 * ══════════════════════════════════════════════════════════════════════ */

test("兜底：未知类目四表引擎回落默认值且零异常", () => {
  assert.deepEqual(pricingForCategory("不存在的类目"), DEFAULT_PRICING);
  assert.deepEqual(dispatchRuleFor("不存在的类目"), DEFAULT_DISPATCH);
  assert.deepEqual(sopForCategory("不存在的类目"), DEFAULT_SOP);
  assert.deepEqual(riskRulesFor("不存在的类目"), GLOBAL_RISK_RULES);
  assert.deepEqual(homeAccessKeywordsFor("不存在的类目"), [
    "家政",
    "保洁",
    "厨师",
    "上门",
    "陪诊",
    "按摩",
    "遛狗",
  ]);
  assert.equal(getProtocol("protocol_不存在"), undefined);
});
