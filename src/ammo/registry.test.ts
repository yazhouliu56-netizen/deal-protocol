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
  listAmmoPillDescriptors,
  listRegisteredAmmos,
  resolveAmmoRequirementForText,
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

test("listRegisteredAmmos：官方四唯一弹药（别名键去重不重复计）", () => {
  const ammos = listRegisteredAmmos();
  const ammoIds = ammos.map((a) => a.ammoId);
  assert.equal(ammoIds.length, new Set(ammoIds).size, "不得出现重复 ammoId");
  for (const id of [
    "housekeeping-v1",
    "meetup-social-v1",
    "companion-v1",
    "appliance-repair-v1",
  ]) {
    assert.ok(ammoIds.includes(id), `应包含 ${id}`);
  }
  // OFFICIAL_AMMO 别名键（dating/escort/social/APPLIANCE_REPAIR）指向同一产物，不得重复计数
  assert.ok(ammoIds.filter((id) => id === "companion-v1").length === 1);
});

test("listAmmoPillDescriptors：官方四枚胶囊元数据（图标/名称/主题）", () => {
  const pills = listAmmoPillDescriptors();
  const byId = new Map(pills.map((p) => [p.ammoId, p]));
  assert.deepEqual(byId.get("housekeeping-v1")?.label, "家政保洁");
  assert.deepEqual(byId.get("housekeeping-v1")?.icon, "🧽");
  assert.deepEqual(byId.get("housekeeping-v1")?.theme, "housekeeping");
  assert.deepEqual(byId.get("meetup-social-v1")?.label, "组局社交");
  assert.deepEqual(byId.get("meetup-social-v1")?.icon, "🏸");
  assert.deepEqual(byId.get("meetup-social-v1")?.theme, "meetup");
  assert.deepEqual(byId.get("companion-v1")?.label, "陪伴交友");
  assert.deepEqual(byId.get("companion-v1")?.icon, "📷");
  assert.deepEqual(byId.get("companion-v1")?.theme, "companion");
  assert.deepEqual(byId.get("appliance-repair-v1")?.label, "家电维修");
  assert.deepEqual(byId.get("appliance-repair-v1")?.icon, "🔧");
  assert.deepEqual(byId.get("appliance-repair-v1")?.theme, "default", "appliance-repair 目前声明 theme=default");
  assert.equal(pills.length, 4, "无动态池时胶囊 = 官方四枚");
});

test("listAmmoPillDescriptors：limit 截断生效（默认仅官方四枚）", () => {
  const limited = listAmmoPillDescriptors(2);
  assert.equal(limited.length, 2);
  assert.deepEqual(limited[0].ammoId, "housekeeping-v1");
});

test("resolveAmmoRequirementForText：注册表单一真理源文本→门槛", () => {
  const hk = resolveAmmoRequirementForText("深度保洁 · 180㎡");
  assert.ok(hk);
  assert.deepEqual(hk.requiredCertificates, ["HEALTH_CERT"]);
  assert.deepEqual(hk.minSafetyScore, 60);
  assert.deepEqual(hk.isPoliceVerified, true);
  const mu = resolveAmmoRequirementForText("羽毛球 4 人双打");
  assert.deepEqual(mu?.requiredIdentityLevel, "BASIC");
  const tech = resolveAmmoRequirementForText("空调坏了，需要修空调");
  assert.deepEqual(tech?.requiredCertificates, [
    "ELECTRICIAN_CERT",
    "APPLIANCE_MAINTENANCE_CERT",
  ]);
  assert.equal(resolveAmmoRequirementForText("日系写真 · 滨江"), undefined, "写实类不在注册表别名 → 无门槛");
  assert.equal(resolveAmmoRequirementForText("无关文本"), undefined);
});
