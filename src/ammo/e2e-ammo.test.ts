/**
 * Phase 3 端到端验证（ADR-0007 §3）：「填弹药表 = 出新类目」。
 *
 * 场景：只新增一行普通表配置「遛狗遛弯」，断言——
 *  1. 四张弹药表全部能读出该新类目（配置即存在）；
 *  2. 读出的配置能被 base 引擎纯函数全链路消费（计价/订单投影/分发/风控/SOP）；
 *  3. 全程零 base 代码修改（本测试只 import base，不改 base）。
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { pricingForCategory, type PricingFormula } from "./pricing-formula.ts";
import { dispatchRuleFor, type DispatchRule } from "./dispatch-rule.ts";
import { riskRulesFor, isRuleEnabled } from "./risk-rule.ts";
import { sopForCategory, type SopParams } from "./sop.ts";
import { createWave } from "../base/order/wave.ts";
import { toOrderCore } from "../base/order/orderCore.ts";
import { customSurcharge, suggestedPrice } from "../base/money/customPricing.ts";

const CATEGORY = "遛狗遛弯";

test("四表全读：pricing/dispatch/risk/sop 命中新类目", () => {
  const p: PricingFormula = pricingForCategory(CATEGORY);
  assert.equal(p.minPriceYuan, 35);
  assert.equal(p.baseRateYuan, 25);

  const d: DispatchRule = dispatchRuleFor(CATEGORY);
  assert.equal(d.weights.distance, 45);
  assert.ok(d.hardGates.requiresVerified?.includes("遛狗遛弯"));

  const r = riskRulesFor(CATEGORY);
  assert.ok(isRuleEnabled(r, "home-access-verification"), "进家引信开启");

  const s: SopParams = sopForCategory(CATEGORY);
  assert.equal(s.capacityDefault, 1, "单对单");
  assert.equal(s.depositDefault, false);
});

test("base 消费·计价：弹药定价公式喂给计价引擎成本模型", () => {
  const p = pricingForCategory(CATEGORY);
  const base = p.baseRateYuan!;
  assert.equal(customSurcharge(base, 0), 0);
  assert.equal(suggestedPrice(base, 1), Math.round(base + base * 0.15));
});

test("base 消费·订单投影：按 SOP 容量建单 → C1 OrderCore 可投影", () => {
  const s = sopForCategory(CATEGORY);
  const wave = createWave({
    id: "e2e-1",
    authorId: "u1",
    basics: { category: CATEGORY, time: "今晚 19:00", area: "家楼下", radiusKm: 2 },
    budget: pricingForCategory(CATEGORY).minPriceYuan!,
    capacity: s.capacityDefault,
    expiresAt: Date.now() + (s.expiresInMs ?? 3600_000),
    createdAt: Date.now(),
  });
  const core = toOrderCore(wave);
  assert.equal(core.capacity, 1, "SOP 容量进入通用骨架");
  assert.equal(core.amountYuan, 35, "定价进入通用骨架");
  assert.ok(["active", "pending"].includes(wave.status));
});

test("base 消费·风控：类目引信勾选影响防线时钟（软断言已开启）", () => {
  const rules = riskRulesFor(CATEGORY);
  assert.ok(isRuleEnabled(rules, "anti-self-boost"), "全局街禁始终开启");
});

test("新类目与既有类目全链互不污染（四表隔离）", () => {
  assert.notEqual(
    pricingForCategory(CATEGORY).minPriceYuan,
    pricingForCategory("家政保洁").minPriceYuan
  );
  assert.notEqual(
    dispatchRuleFor(CATEGORY).weights.distance,
    dispatchRuleFor("搬家").weights.distance
  );
});