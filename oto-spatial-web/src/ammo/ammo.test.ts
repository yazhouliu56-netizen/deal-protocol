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

test("riskRulesFor 全局规则 + 类目额外引信", () => {
  const rules = riskRulesFor("水电维修");
  assert.ok(isRuleEnabled(rules, "anti-self-boost"));
  assert.ok(isRuleEnabled(rules, "home-access-verification"));
  assert.ok(CATEGORY_DISPATCH);
});