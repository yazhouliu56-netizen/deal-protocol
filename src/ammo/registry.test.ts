/**
 * 弹药注册表 · 存量聚合器测试（ADR-0007 Phase 3 e2e 同构）：
 * 验证全部既有类目均可无缝聚合为符合 IAmmoDefinition 的标准弹药，
 * 未配置类目自动落默认保底弹药。
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  DEFAULT_AMMO,
  getAmmoDefinition,
  isConfiguredCategory,
  toDispatchRule,
  toFuzePolicy,
  toPricingModel,
} from "./registry.ts";
import { CATEGORY_PRICING } from "./pricing-formula.ts";
import { DEFAULT_FUZE_POLICY, IMPACT_FUZE_TEMPLATE } from "../types/fuze-policy.ts";

test("全部 7 个既有类目均可聚合为标准弹药", () => {
  const categories = Object.keys(CATEGORY_PRICING);
  assert.equal(categories.length, 7);
  for (const c of categories) {
    const ammo = getAmmoDefinition(c);
    assert.equal(ammo.category, c);
    assert.equal(ammo.ammoId, c);
    assert.ok(["FIXED", "HOURLY", "PER_SEAT", "FORMULA"].includes(ammo.pricingModel.kind));
    assert.ok(ammo.fuzePolicy);
    assert.ok(ammo.dispatchRule);
    assert.ok(ammo.sop);
    assert.ok(Array.isArray(ammo.fiveStateHooks));
  }
});

test("家政保洁 → HOURLY 计价 + 💥碰炸引信 + 进家 SOP + 重距离派单", () => {
  const ammo = getAmmoDefinition("家政保洁");
  assert.deepEqual(ammo.pricingModel, { kind: "HOURLY", rateYuan: 60, minHours: 1 });
  assert.deepEqual(ammo.fuzePolicy, IMPACT_FUZE_TEMPLATE);
  assert.deepEqual(ammo.sop?.depositDefault, true);
  assert.deepEqual(ammo.sop?.depositRate, 0.2);
  assert.equal(ammo.dispatchRule?.weights.distance, 40);
  assert.ok(ammo.dispatchRule?.hardGates?.requiresVerified?.includes("家政保洁"));
});

test("遛狗遛弯（Phase 3 新弹药）→ HOURLY 55 + 碰炸引信 + 短有效期", () => {
  const ammo = getAmmoDefinition("遛狗遛弯");
  assert.deepEqual(ammo.pricingModel, { kind: "HOURLY", rateYuan: 55, minHours: 1 });
  assert.deepEqual(ammo.fuzePolicy, IMPACT_FUZE_TEMPLATE);
  assert.equal(ammo.sop?.expiresInMs, 90 * 60_000);
  assert.equal(ammo.dispatchRule?.weights.distance, 45);
});

test("羽毛球（仅 SOP 表登记）→ 已配置：兜底定价 + 零防护引信 + 拼位 SOP", () => {
  assert.equal(isConfiguredCategory("羽毛球"), true);
  const ammo = getAmmoDefinition("羽毛球");
  // 定价表未配置 → 需求局默认公式（时薪 80）
  assert.deepEqual(ammo.pricingModel, { kind: "HOURLY", rateYuan: 80, minHours: 1 });
  assert.deepEqual(ammo.fuzePolicy, DEFAULT_FUZE_POLICY);
  assert.equal(ammo.sop?.capacityDefault, 4);
  assert.equal(ammo.sop?.buffSeats, 1);
  assert.equal(ammo.sop?.maxRounds, 2);
});

test("夜骑巡航（age-required 类目）→ 引信零防护（合规由 ageGate 域独立执行）", () => {
  const ammo = getAmmoDefinition("夜骑巡航");
  assert.deepEqual(ammo.fuzePolicy, DEFAULT_FUZE_POLICY);
});

test("未配置类目 → 默认保底弹药（default-ammo，零钩子零防护）", () => {
  assert.equal(isConfiguredCategory("不存在类目"), false);
  const ammo = getAmmoDefinition("不存在类目");
  assert.equal(ammo.ammoId, "default-ammo");
  assert.equal(ammo.category, "不存在类目");
  assert.deepEqual(ammo.fiveStateHooks, []);
  assert.deepEqual(ammo.fuzePolicy, DEFAULT_FUZE_POLICY);
  assert.equal(ammo.dispatchRule?.weights.distance, DEFAULT_AMMO.dispatchRule?.weights.distance);
});

test("toPricingModel 投影：无时薪表 → FIXED（起步价兜底地板价）", () => {
  assert.deepEqual(toPricingModel({ minPriceYuan: 50 }), { kind: "FIXED", amountYuan: 50 });
  assert.deepEqual(toPricingModel({ baseRateYuan: 30, minPriceYuan: 50 }), {
    kind: "FIXED",
    amountYuan: 30,
  });
  assert.deepEqual(toPricingModel({}), { kind: "FIXED", amountYuan: 0 });
});

test("toFuzePolicy 聚合：进家类目命中碰炸模板，其余默认", () => {
  assert.deepEqual(toFuzePolicy("水电维修"), IMPACT_FUZE_TEMPLATE);
  assert.deepEqual(toFuzePolicy("搬家"), DEFAULT_FUZE_POLICY);
});

test("toDispatchRule 聚合：覆盖类目权重生效，未覆盖走全局默认", () => {
  const 家政 = toDispatchRule("家政保洁");
  assert.equal(家政.weights.distance, 40);
  const 搬家 = toDispatchRule("搬家");
  assert.equal(搬家.weights.distance, 20);
  const def = toDispatchRule("不存在类目");
  assert.equal(def.weights.distance, 30);
  assert.equal(def.weights.credit, 30);
  assert.equal(def.weights.custom, 25);
  assert.equal(def.weights.verifiedBonus, 5);
});

test("四表聚合互不污染：家政与遛狗计价/派单不同", () => {
  const 家政 = getAmmoDefinition("家政保洁");
  const 遛狗 = getAmmoDefinition("遛狗遛弯");
  assert.notDeepEqual(家政.pricingModel, 遛狗.pricingModel);
  assert.notEqual(家政.dispatchRule?.weights.distance, 遛狗.dispatchRule?.weights.distance);
});
