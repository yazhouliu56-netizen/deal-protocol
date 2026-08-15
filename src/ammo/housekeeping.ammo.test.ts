/**
 * 标杆弹药 housekeeping-v1 全流程测试：
 * 下单（PUBLISHED）→ 抢单（MATCHED）→ 现场增项加价（BLOCK 未确认）→
 * 确认后进入服务（IN_SERVICE）→ 完工拍照验收（INSPECTED）→ 结算（SETTLED），
 * 含违约终止事件与引信核验。
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  HOUSEKEEPING_EVIDENCE,
  HOUSEKEEPING_REFUND_RULES,
  HOUSEKEEPING_STAGES,
  cleaningCheckHook,
  housekeepingAmmo,
  onsiteQuoteHook,
} from "./housekeeping.ammo.ts";
import {
  advanceLifecycle,
  evaluateAmmoFuze,
  toAtomicFiveState,
} from "../base/ammo/runner.ts";
import { IMPACT_FUZE_TEMPLATE } from "../types/fuze-policy.ts";

test("弹药装备完整性：housekeeping-v1 声明式装填无误", () => {
  assert.equal(housekeepingAmmo.ammoId, "housekeeping-v1");
  assert.equal(housekeepingAmmo.category, "housekeeping");
  assert.equal(housekeepingAmmo.version, "1.0.0");
  assert.deepEqual(housekeepingAmmo.pricingModel, { kind: "HOURLY", rateYuan: 60, minHours: 2 });
  assert.deepEqual(housekeepingAmmo.fuzePolicy, IMPACT_FUZE_TEMPLATE);
  assert.equal(housekeepingAmmo.sop?.depositDefault, true);
  assert.equal(housekeepingAmmo.dispatchRule?.weights.distance, 40);
  assert.equal(housekeepingAmmo.fiveStateHooks.length, 2);
  assert.ok(housekeepingAmmo.fiveStateHooks.includes(onsiteQuoteHook));
  assert.ok(housekeepingAmmo.fiveStateHooks.includes(cleaningCheckHook));
});

test("存量协议资产升级：六阶段/退款规则/证据契约投影完整", () => {
  assert.deepEqual(HOUSEKEEPING_STAGES, [
    "NOT_ACCEPTED",
    "ACCEPTED",
    "DEPARTED",
    "ARRIVED",
    "IN_PROGRESS",
    "DONE",
  ]);
  assert.equal(HOUSEKEEPING_REFUND_RULES.length, 6);
  assert.deepEqual(HOUSEKEEPING_REFUND_RULES[2], { stage: 2, providerRatio: 0.1, providerMax: 30, customerGets: "rest" });
  assert.equal(HOUSEKEEPING_EVIDENCE.beforePhoto.required, true);
  assert.equal(HOUSEKEEPING_EVIDENCE.afterPhoto.maxCount, 5);
});

test("全流程：发布→抢单→无增项直接进入服务", async () => {
  const published = await advanceLifecycle({
    ammo: housekeepingAmmo,
    orderId: "hk-1",
    from: "PUBLISHED",
    to: "MATCHED",
  });
  assert.equal(published.ok, true);
  assert.equal(published.state, "MATCHED");

  const inService = await advanceLifecycle({
    ammo: housekeepingAmmo,
    orderId: "hk-1",
    from: "MATCHED",
    to: "IN_SERVICE",
  });
  assert.equal(inService.ok, true);
  assert.equal(inService.state, "IN_SERVICE");
});

test("现场增项：未确认报价 BLOCK 阻止进入服务", async () => {
  const r = await advanceLifecycle({
    ammo: housekeepingAmmo,
    orderId: "hk-2",
    from: "MATCHED",
    to: "IN_SERVICE",
    payload: {
      onsiteQuote: { items: ["抽油烟机深度清洗"], totalYuan: 120, approved: false },
    },
  });
  assert.equal(r.ok, false);
  assert.equal(r.state, "MATCHED");
  assert.match(r.reason ?? "", /hook-blocked: housekeeping\.onsite-quote/);
  const outcome = r.hookOutcomes[0];
  assert.equal(outcome?.hookId, "housekeeping.onsite-quote");
  assert.equal(outcome?.fallbackUsed, "BLOCK");
  assert.equal(outcome?.reason, "onsite-quote-pending");
});

test("现场增项：需求方确认后放行并透传确认金额", async () => {
  const r = await advanceLifecycle({
    ammo: housekeepingAmmo,
    orderId: "hk-2",
    from: "MATCHED",
    to: "IN_SERVICE",
    payload: {
      onsiteQuote: { items: ["抽油烟机深度清洗"], totalYuan: 120, approved: true },
    },
  });
  assert.equal(r.ok, true);
  assert.equal(r.state, "IN_SERVICE");
  assert.equal(r.hookOutcomes[0]?.ok, true);
});

test("完工验收：双向照片齐全 → 验收达成 + 证据透传", async () => {
  const r = await advanceLifecycle({
    ammo: housekeepingAmmo,
    orderId: "hk-1",
    from: "IN_SERVICE",
    to: "INSPECTED",
    payload: {
      photos: { before: ["before-1.jpg"], after: ["after-1.jpg", "after-2.jpg"] },
    },
  });
  assert.equal(r.ok, true);
  assert.equal(r.state, "INSPECTED");
  assert.equal(r.afterData.length, 1);
  const evidence = r.afterData[0] as {
    evidence: { before: string[]; after: string[] };
    requiredMet: boolean;
  };
  assert.deepEqual(evidence.evidence.before, ["before-1.jpg"]);
  assert.equal(evidence.requiredMet, true);
});

test("完工验收：照片缺失 → AFTER SKIP 软失败，验收仍达成", async () => {
  const r = await advanceLifecycle({
    ammo: housekeepingAmmo,
    orderId: "hk-3",
    from: "IN_SERVICE",
    to: "INSPECTED",
    payload: { photos: { before: [], after: ["after-1.jpg"] } },
  });
  assert.equal(r.ok, true);
  assert.equal(r.state, "INSPECTED");
  const outcome = r.hookOutcomes[0];
  assert.equal(outcome?.hookId, "housekeeping.cleaning-check");
  assert.equal(outcome?.fallbackUsed, "SKIP");
  assert.equal(outcome?.reason, "evidence-photos-required");
});

test("全流程：INSPECTED → SETTLED 终局", async () => {
  const r = await advanceLifecycle({
    ammo: housekeepingAmmo,
    orderId: "hk-1",
    from: "INSPECTED",
    to: "SETTLED",
  });
  assert.equal(r.ok, true);
  assert.equal(r.state, "SETTLED");
});

test("违约终止：服务中 no-show → 携带结算载荷流转 SETTLED", async () => {
  const r = await advanceLifecycle({
    ammo: housekeepingAmmo,
    orderId: "hk-9",
    from: "IN_SERVICE",
    to: "INSPECTED",
    termination: { kind: "BREACH_SETTLED", payload: { forfeitYuan: 240, refundYuan: 0 } },
    now: 1_750_000_000_000,
  });
  assert.equal(r.ok, true);
  assert.equal(r.state, "SETTLED");
  assert.deepEqual(r.termination, {
    kind: "BREACH_SETTLED",
    at: 1_750_000_000_000,
    orderId: "hk-9",
    from: "IN_SERVICE",
    payload: { forfeitYuan: 240, refundYuan: 0 },
  });
});

test("引信核验：housekeeping 碰炸引信要求背调+押金齐备", () => {
  const bare = evaluateAmmoFuze(housekeepingAmmo.fuzePolicy, {});
  assert.equal(bare.pass, false);
  assert.ok(bare.checks.some((c) => c.rule === "backgroundCheck"));
  assert.ok(bare.checks.some((c) => c.rule === "deposit"));

  const armed = evaluateAmmoFuze(housekeepingAmmo.fuzePolicy, {
    backgroundVerified: true,
    depositHeld: true,
  });
  assert.equal(armed.pass, true);
});

test("五态投影整合视角：抢单 accepted → MATCHED；申报后 → IN_SERVICE", () => {
  assert.equal(
    toAtomicFiveState({ waveStatus: "claimed", claimStatus: "accepted" }),
    "MATCHED"
  );
  assert.equal(
    toAtomicFiveState({
      waveStatus: "claimed",
      claimStatus: "accepted",
      fulfilmentStatus: "reported",
    }),
    "IN_SERVICE"
  );
  assert.equal(
    toAtomicFiveState({
      waveStatus: "claimed",
      claimStatus: "accepted",
      fulfilmentStatus: "confirmed",
    }),
    "INSPECTED"
  );
});
/* ============ S2 防坐地起价熔断（50% 上限） ============ */

test("熔断：增项 60% 超限（base 100 / 增项 60 > 50 上限）→ BLOCK ANTI_GOUGING_LIMIT_EXCEEDED", async () => {
  const r = await advanceLifecycle({
    ammo: housekeepingAmmo,
    orderId: "hk-gouge-1",
    from: "MATCHED",
    to: "IN_SERVICE",
    payload: {
      baseAmountYuan: 100,
      onsiteQuote: { items: ["深度除螨"], totalYuan: 60, approved: true },
    },
  });
  assert.equal(r.ok, false);
  assert.equal(r.state, "MATCHED");
  assert.match(r.reason ?? "", /ANTI_GOUGING_LIMIT_EXCEEDED/);
  assert.match(r.reason ?? "", /anti-gouging-blocked/);
});

test("熔断：增项 30% 未超限（base 100 / 增项 30 ≤ 50 上限）→ 放行进入服务", async () => {
  const r = await advanceLifecycle({
    ammo: housekeepingAmmo,
    orderId: "hk-gouge-2",
    from: "MATCHED",
    to: "IN_SERVICE",
    payload: {
      baseAmountYuan: 100,
      onsiteQuote: { items: ["深度除螨"], totalYuan: 30, approved: true },
    },
  });
  assert.equal(r.ok, true);
  assert.equal(r.state, "IN_SERVICE");
});

test("熔断：恰好 50% 边界（base 200 / 增项 100）→ 放行", async () => {
  const r = await advanceLifecycle({
    ammo: housekeepingAmmo,
    orderId: "hk-gouge-3",
    from: "MATCHED",
    to: "IN_SERVICE",
    payload: {
      baseAmountYuan: 200,
      onsiteQuote: { items: ["空调清洗"], totalYuan: 100, approved: true },
    },
  });
  assert.equal(r.ok, true);
  assert.equal(r.state, "IN_SERVICE");
});

test("熔断：escrowPayload.amount 作为基准价（未显式注入 baseAmountYuan）", async () => {
  const r = await advanceLifecycle({
    ammo: housekeepingAmmo,
    orderId: "hk-gouge-4",
    from: "MATCHED",
    to: "IN_SERVICE",
    payload: {
      escrowPayload: { amount: 200, depositRate: 0.3 },
      onsiteQuote: { items: ["开荒保洁加项"], totalYuan: 130, approved: true },
    },
  });
  assert.equal(r.ok, false);
  assert.match(r.reason ?? "", /ANTI_GOUGING_LIMIT_EXCEEDED/);
});

test("熔断：弹药未声明 maxSurchargeRatio → 校验跳过（零回归兜底）", async () => {
  const r = await advanceLifecycle({
    ammo: {
      ammoId: "no-cap-ammo",
      category: "test",
      version: "1.0.0",
      fiveStateHooks: [],
      pricingModel: { kind: "FIXED", amountYuan: 100 },
      fuzePolicy: IMPACT_FUZE_TEMPLATE,
    },
    orderId: "hk-gouge-5",
    from: "MATCHED",
    to: "IN_SERVICE",
    payload: {
      baseAmountYuan: 100,
      onsiteQuote: { items: ["任意加项"], totalYuan: 90, approved: true },
    },
  });
  assert.equal(r.ok, true);
  assert.equal(r.state, "IN_SERVICE");
});

test("弹药装备：S1 准入 + 定向信用折抵 + 上限比例声明完整", () => {
  assert.equal(housekeepingAmmo.maxSurchargeRatio, 0.5);
  assert.deepEqual(housekeepingAmmo.workerRequirement, {
    requiredCertificates: ["HEALTH_CERT"],
    minSafetyScore: 60,
    requiredIdentityLevel: "REAL_NAME",
  });
  assert.equal(housekeepingAmmo.creditWaiverRule?.allowedCreditDimension, "SAFETY_BACKGROUND");
  assert.equal(housekeepingAmmo.creditWaiverRule?.maxWaiverPercentage, 0.5);
});
