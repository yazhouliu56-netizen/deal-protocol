import { test } from "node:test";
import assert from "node:assert/strict";
import {
  CATEGORY_PRICING,
  DEFAULT_PRICING,
  pricingForCategory,
} from "./pricing-formula.ts";
import {
  CATEGORY_DISPATCH,
  DEFAULT_DISPATCH,
  dispatchRuleFor,
} from "./dispatch-rule.ts";
import { isRuleEnabled, riskRulesFor } from "./risk-rule.ts";
import { DEFAULT_SOP, sopForCategory } from "./sop.ts";

test("pricingForCategory 命中已配置类目", () => {
  const p = pricingForCategory("家电维修");
  assert.equal(p.minPriceYuan, 80);
  assert.equal(p.hourlyRates?.[1], 100);
  assert.ok(p.warrantyText);
});

test("pricingForCategory 未配置类目回退默认", () => {
  const p = pricingForCategory("不存在类目");
  assert.equal(p, DEFAULT_PRICING);
});

test("弹药表覆盖多项配置的类目", () => {
  assert.ok(CATEGORY_PRICING["水电维修"]);
  assert.ok(CATEGORY_PRICING["家政保洁"]);
  assert.ok(CATEGORY_PRICING["搬家"]);
  assert.ok(CATEGORY_PRICING["按摩"]);
});

test("dispatchRuleFor 覆盖权重不污染默认", () => {
  const rule = dispatchRuleFor("家政保洁");
  assert.equal(rule.weights.distance, 40);
  assert.equal(rule.weights.credit, 25);
  const def = dispatchRuleFor("羽毛球");
  assert.equal(def.weights.distance, DEFAULT_DISPATCH.weights.distance);
  assert.equal(def, DEFAULT_DISPATCH);
});

test("C4 hardGates 结构化对齐（banned/online 默认开启）", () => {
  const def = dispatchRuleFor("羽毛球");
  assert.equal(def.hardGates.banned, true);
  assert.equal(def.hardGates.online, true);
  assert.ok(def.hardGates.requiresVerified?.includes("家政保洁"));
  const 水电 = dispatchRuleFor("水电维修");
  assert.deepEqual(水电.hardGates.requiresVerified, ["上门"]);
});

test("sopForCategory 命中/回退（SOP 弹药表）", () => {
  const 保洁 = sopForCategory("家政保洁");
  assert.equal(保洁.depositDefault, true);
  assert.equal(保洁.capacityDefault, 1);
  assert.equal(保洁.depositRate, 0.2);
  const 羽毛 = sopForCategory("羽毛球");
  assert.equal(羽毛.capacityDefault, 4);
  assert.equal(羽毛.buffSeats, 1);
  const def = sopForCategory("不存在类目");
  assert.equal(def, DEFAULT_SOP);
});