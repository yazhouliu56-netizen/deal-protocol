/**
 * 标杆弹药 meetup-social-v1 全流程测试（Phase 2 · 组局社交）：
 * 组局发布（PUBLISHED）→ 拼单锁定（MATCHED，防鸽子引信前置）→
 * 到场验真解锁（IN_SERVICE，ArrivalCheckHook）→ 验收（INSPECTED）→
 * AA 自动分账结算（SETTLED，AASplitSettleHook），
 * 含爽约违约终止事件（BREACH_SETTLED）与双引信（⏳延期 + 📡近炸）并联核验。
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  AA_SPLIT_SETTLE_HOOK_ID,
  ARRIVAL_CHECK_HOOK_ID,
  MEETUP_DUAL_FUZE,
  MEETUP_EVIDENCE,
  MEETUP_REFUND_RULES,
  MEETUP_STAGES,
  aaSplitSettleHook,
  arrivalCheckHook,
  meetupAmmo,
} from "./meetup.ammo.ts";
import {
  advanceLifecycle,
  evaluateAmmoFuze,
  toAtomicFiveState,
} from "../base/ammo/runner.ts";
import { DELAY_FUZE_TEMPLATE, PROXIMITY_FUZE_TEMPLATE } from "../types/fuze-policy.ts";
import { getAmmoDefinition, DEFAULT_AMMO, isConfiguredCategory } from "./registry.ts";
import { housekeepingAmmo } from "./housekeeping.ammo.ts";

/* =====================================================================
 * 1. 弹药装备完整性
 * ===================================================================== */

test("弹药装备完整性：meetup-social-v1 声明式装填无误", () => {
  assert.equal(meetupAmmo.ammoId, "meetup-social-v1");
  assert.equal(meetupAmmo.category, "social");
  assert.equal(meetupAmmo.version, "1.0.0");
  assert.deepEqual(meetupAmmo.pricingModel, { kind: "PER_SEAT", perSeatYuan: 80, minSeats: 2 });
  assert.equal(meetupAmmo.sop?.depositDefault, true);
  assert.equal(meetupAmmo.sop?.depositRate, 0.3);
  assert.equal(meetupAmmo.sop?.capacityDefault, 4);
  assert.equal(meetupAmmo.sop?.buffSeats, 1);
  assert.equal(meetupAmmo.dispatchRule?.weights.credit, 35);
  assert.equal(meetupAmmo.fiveStateHooks.length, 2);
  assert.ok(meetupAmmo.fiveStateHooks.includes(arrivalCheckHook));
  assert.ok(meetupAmmo.fiveStateHooks.includes(aaSplitSettleHook));
});

test("存量协议资产升级：六阶段/退款规则/证据契约投影完整", () => {
  assert.deepEqual(MEETUP_STAGES, [
    "NOT_ACCEPTED",
    "ACCEPTED",
    "DEPARTED",
    "ARRIVED",
    "IN_PROGRESS",
    "DONE",
  ]);
  assert.equal(MEETUP_REFUND_RULES.length, 6);
  assert.equal(MEETUP_REFUND_RULES[2].policy, "no-show-penalty");
  assert.equal(MEETUP_REFUND_RULES[3].policy, "arrived-refund");
  assert.equal(MEETUP_REFUND_RULES[5].policy, "settle");
  assert.equal(MEETUP_EVIDENCE.arrivalGps.required, true);
  assert.equal(MEETUP_EVIDENCE.activityPhoto.maxCount, 3);
});

/* =====================================================================
 * 2. 双引信并联（⏳ 延期 + 📡 近炸）
 * ===================================================================== */

test("双引信并联：DELAY+PROXIMITY 并集装填，防护等级取最高", () => {
  assert.deepEqual(MEETUP_DUAL_FUZE.fuzeTypes, ["DELAY", "PROXIMITY"]);
  assert.equal(MEETUP_DUAL_FUZE.fuzeId, "fuze-meetup-dual");
  assert.equal(MEETUP_DUAL_FUZE.advanceFreeze.enabled, true);
  assert.equal(MEETUP_DUAL_FUZE.advanceFreeze.ratio, DELAY_FUZE_TEMPLATE.advanceFreeze.ratio);
  assert.equal(MEETUP_DUAL_FUZE.geoFence.enabled, true);
  assert.equal(MEETUP_DUAL_FUZE.geoFence.radiusM, DELAY_FUZE_TEMPLATE.geoFence.radiusM);
  assert.equal(MEETUP_DUAL_FUZE.geoFence.unlockOnArrival, true);
  assert.equal(MEETUP_DUAL_FUZE.antiFraudFilter, true);
  assert.equal(MEETUP_DUAL_FUZE.privacy.virtualNumber, true);
  assert.equal(MEETUP_DUAL_FUZE.privacy.blurLocation, true);
  assert.equal(MEETUP_DUAL_FUZE.privacy.sensitiveWordIntervention, true);
  assert.equal(MEETUP_DUAL_FUZE.sos.enabled, true);
  assert.equal(MEETUP_DUAL_FUZE.sos.autoLocationReport, true);
  assert.equal(MEETUP_DUAL_FUZE.sos.autoEvidenceAppend, true);
  assert.equal(MEETUP_DUAL_FUZE.sos.notifyEmergencyContacts, true);
  assert.equal(MEETUP_DUAL_FUZE.backgroundCheck, PROXIMITY_FUZE_TEMPLATE.backgroundCheck);
});

test("近炸隐私保护：虚拟号/模糊定位未就绪时拦截，就绪后放行", () => {
  const blocked = evaluateAmmoFuze(MEETUP_DUAL_FUZE, {
    depositHeld: true,
    atArrival: true,
    privacyReady: false,
  });
  assert.equal(blocked.pass, false);
  assert.ok(blocked.checks.some((c) => c.fuzeType === "PROXIMITY" && c.rule === "privacy"));

  const ready = evaluateAmmoFuze(MEETUP_DUAL_FUZE, {
    depositHeld: true,
    atArrival: true,
    privacyReady: true,
  });
  assert.equal(ready.pass, true);
  assert.deepEqual(ready.checks, []);
});

/* =====================================================================
 * 3. 防鸽子：延期引信拦截（未预付冻结阻断 MATCHED）
 * ===================================================================== */

test("防鸽子：未预付定金阻断拼单锁定（MATCHED 前置引信拦截）", () => {
  const noDeposit = evaluateAmmoFuze(MEETUP_DUAL_FUZE, {
    depositHeld: false,
    atArrival: false,
    privacyReady: true,
  });
  assert.equal(noDeposit.pass, false);
  assert.ok(
    noDeposit.checks.some((c) => c.fuzeType === "DELAY" && c.rule === "advanceFreeze")
  );

  const depositOnly = evaluateAmmoFuze(MEETUP_DUAL_FUZE, {
    depositHeld: true,
    atArrival: false,
    privacyReady: true,
  });
  assert.equal(depositOnly.pass, false);
  assert.ok(depositOnly.checks.some((c) => c.fuzeType === "DELAY" && c.rule === "geoFence"));

  const allArmed = evaluateAmmoFuze(MEETUP_DUAL_FUZE, {
    depositHeld: true,
    atArrival: true,
    privacyReady: true,
  });
  assert.equal(allArmed.pass, true);
});

test("双引信并集：任一引信规则不满足即拦截（防鸽子同时防护近炸）", () => {
  const r = evaluateAmmoFuze(MEETUP_DUAL_FUZE, {
    depositHeld: false,
    atArrival: false,
    privacyReady: false,
  });
  assert.equal(r.pass, false);
  const rules = r.checks.map((c) => c.rule);
  assert.ok(rules.includes("advanceFreeze"));
  assert.ok(rules.includes("geoFence"));
  assert.ok(rules.includes("privacy"));
});

/* =====================================================================
 * 4. 五态全流程：发布 → 拼单 → 到场验真 → 验收 → AA 结算
 * ===================================================================== */

test("五态全流程：组局发布→拼单锁定→到场验真解锁→验收→AA 自动分账", async () => {
  const matched = await advanceLifecycle({
    ammo: meetupAmmo,
    orderId: "mtg-1",
    from: "PUBLISHED",
    to: "MATCHED",
  });
  assert.equal(matched.ok, true);
  assert.equal(matched.state, "MATCHED");

  const inService = await advanceLifecycle({
    ammo: meetupAmmo,
    orderId: "mtg-1",
    from: "MATCHED",
    to: "IN_SERVICE",
    payload: { arrival: { viaGps: true, checkedInSeats: 3 } },
  });
  assert.equal(inService.ok, true);
  assert.equal(inService.state, "IN_SERVICE");
  assert.deepEqual(inService.afterData, []);
  assert.equal(inService.hookOutcomes[0].ok, true);

  const unlock = arrivalCheckHook.run({
    ammoId: meetupAmmo.ammoId,
    orderId: "mtg-1",
    from: "MATCHED",
    to: "IN_SERVICE",
    payload: { arrival: { viaGps: true, checkedInSeats: 3 } },
  }) as { ok: boolean; data: unknown };
  assert.deepEqual(unlock.data, { unlocked: true, checkedInSeats: 3, method: "gps" });

  const inspected = await advanceLifecycle({
    ammo: meetupAmmo,
    orderId: "mtg-1",
    from: "IN_SERVICE",
    to: "INSPECTED",
  });
  assert.equal(inspected.ok, true);
  assert.equal(inspected.state, "INSPECTED");

  const settled = await advanceLifecycle({
    ammo: meetupAmmo,
    orderId: "mtg-1",
    from: "INSPECTED",
    to: "SETTLED",
    payload: {
      settlement: {
        venueCostYuan: 300,
        seats: [
          { userId: "u1", paidYuan: 80, present: true },
          { userId: "u2", paidYuan: 80, present: true },
        ],
      },
    },
  });
  assert.equal(settled.ok, true);
  assert.equal(settled.state, "SETTLED");
  assert.equal(settled.afterData.length, 1);
  const aa = settled.afterData[0] as {
    aa: { userId: string; settleYuan: number }[];
    penalty: unknown;
  };
  assert.equal(aa.aa.length, 2);
  assert.equal(aa.aa[0].userId, "u1");
  assert.equal(aa.aa[0].settleYuan, -70);
  assert.equal(aa.aa[1].settleYuan, -70);
  assert.equal(aa.penalty, null);
});

test("五态投影桥：拼单 accepted → MATCHED；申报后 → IN_SERVICE", () => {
  assert.equal(toAtomicFiveState({ claimStatus: "accepted" }), "MATCHED");
  assert.equal(toAtomicFiveState({ claimStatus: "joined" }), "MATCHED");
  assert.equal(
    toAtomicFiveState({ claimStatus: "accepted", fulfilmentStatus: "reported" }),
    "IN_SERVICE"
  );
  assert.equal(toAtomicFiveState({ claimStatus: "accepted", isSettled: true }), "SETTLED");
});

/* =====================================================================
 * 5. 到场验真与超时违约
 * ===================================================================== */

test("到场验真：未验真 BLOCK 阻止进入服务（冻结不解锁）", async () => {
  const blocked = await advanceLifecycle({
    ammo: meetupAmmo,
    orderId: "mtg-2",
    from: "MATCHED",
    to: "IN_SERVICE",
  });
  assert.equal(blocked.ok, false);
  assert.equal(blocked.state, "MATCHED");
  assert.equal(blocked.reason, "hook-blocked: meetup.arrival-check · arrival-verification-required");

  const notVerified = await advanceLifecycle({
    ammo: meetupAmmo,
    orderId: "mtg-3",
    from: "MATCHED",
    to: "IN_SERVICE",
    payload: { arrival: { viaGps: false } },
  });
  assert.equal(notVerified.ok, false);
  assert.equal(notVerified.state, "MATCHED");
  assert.equal(notVerified.reason, "hook-blocked: meetup.arrival-check · arrival-not-verified");
});

test("到场验真：双方扫码确认到场同样放行（scanCode ≥8 位）", async () => {
  const r = await advanceLifecycle({
    ammo: meetupAmmo,
    orderId: "mtg-4",
    from: "MATCHED",
    to: "IN_SERVICE",
    payload: { arrival: { scanCode: "meetup-9f3k2a", checkedInSeats: 2 } },
  });
  assert.equal(r.ok, true);
  assert.equal(r.state, "IN_SERVICE");
  const scanUnlock = arrivalCheckHook.run({
    ammoId: meetupAmmo.ammoId,
    orderId: "mtg-4",
    from: "MATCHED",
    to: "IN_SERVICE",
    payload: { arrival: { scanCode: "meetup-9f3k2a", checkedInSeats: 2 } },
  }) as { ok: boolean; data: unknown };
  assert.deepEqual(scanUnlock.data, { unlocked: true, checkedInSeats: 2, method: "scan" });
});

test("超时违约：爽约触发 BREACH_SETTLED 终止事件，违约金归守约方", async () => {
  const start = Date.UTC(2026, 7, 15, 10, 0, 0);
  const breach = await advanceLifecycle({
    ammo: meetupAmmo,
    orderId: "mtg-9",
    from: "MATCHED",
    to: "SETTLED",
    now: start + 25 * 3600_000,
    termination: {
      kind: "BREACH_SETTLED",
      payload: {
        settlement: {
          venueCostYuan: 200,
          seats: [
            { userId: "u1", paidYuan: 80, present: true },
            { userId: "u3", paidYuan: 80, present: false },
          ],
          penalty: { breacherId: "u3", forfeitYuan: 80, receiverId: "u1" },
        },
      },
    },
  });
  assert.equal(breach.ok, true);
  assert.equal(breach.state, "SETTLED");
  assert.equal(breach.termination?.kind, "BREACH_SETTLED");
  assert.equal(breach.termination?.from, "MATCHED");
  assert.equal(breach.termination?.at, start + 25 * 3600_000);
  assert.equal(breach.afterData.length, 1);
  const result = breach.afterData[0] as {
    aa: { userId: string; settleYuan: number }[];
    penalty: { breacherId: string; forfeitYuan: number; receiverId: string };
    credit: { honored: unknown[]; breached: { userId: string; forfeitYuan: number }[] };
  };
  assert.equal(result.aa.length, 1);
  assert.equal(result.penalty.forfeitYuan, 80);
  assert.equal(result.penalty.receiverId, "u1");
  assert.equal(result.credit.breached[0].userId, "u3");
  assert.equal(result.credit.honored.length, 1);
});

test("违约方 AA 保障金按双押金语义全失（no-show-penalty 规则落定）", () => {
  const rule = MEETUP_REFUND_RULES.find((r) => r.policy === "no-show-penalty");
  assert.equal(rule?.stage, 2);
  assert.ok(rule?.note.includes("爽约方保障金全失"));
});

/* =====================================================================
 * 6. 注册表挂载
 * ===================================================================== */

test("注册表：meetup/dating/social 类目直接解析到 meetup-social-v1", () => {
  for (const c of ["meetup", "dating", "social"]) {
    assert.equal(getAmmoDefinition(c).ammoId, "meetup-social-v1");
    assert.equal(getAmmoDefinition(c).fuzePolicy.fuzeTypes.length, 2);
  }
});

test("注册表：housekeeping 类目解析到官方 housekeeping-v1，未配置类目仍保底", () => {
  assert.equal(getAmmoDefinition("housekeeping").ammoId, "housekeeping-v1");
  assert.equal(getAmmoDefinition("housekeeping"), housekeepingAmmo);
  assert.equal(getAmmoDefinition("不存在类目").ammoId, DEFAULT_AMMO.ammoId);
});

test("钩子 ID 唯一性：与既有 housekeeping 钩子不冲突", () => {
  const ids = [
    ARRIVAL_CHECK_HOOK_ID,
    AA_SPLIT_SETTLE_HOOK_ID,
    "housekeeping.onsite-quote",
    "housekeeping.cleaning-check",
  ];
  assert.equal(new Set(ids).size, ids.length);
});

test("AA 结算钩子：缺失结算载荷 SKIP 降级，不阻塞终态推进", async () => {
  const r = await advanceLifecycle({
    ammo: meetupAmmo,
    orderId: "mtg-5",
    from: "INSPECTED",
    to: "SETTLED",
  });
  assert.equal(r.ok, true);
  assert.equal(r.state, "SETTLED");
  assert.equal(r.afterData.length, 0);
  assert.equal(r.hookOutcomes.at(-1)?.hookId, AA_SPLIT_SETTLE_HOOK_ID);
  assert.equal(r.hookOutcomes.at(-1)?.ok, false);
  assert.equal(r.hookOutcomes.at(-1)?.reason, "settlement-required");
  assert.equal(r.hookOutcomes.at(-1)?.fallbackUsed, "SKIP");
});

test("AA 分账：到场者混合补缴/退款（多退少补）", async () => {
  const settled = await advanceLifecycle({
    ammo: meetupAmmo,
    orderId: "mtg-6",
    from: "INSPECTED",
    to: "SETTLED",
    payload: {
      settlement: {
        venueCostYuan: 300,
        seats: [
          { userId: "u1", paidYuan: 100, present: true },
          { userId: "u2", paidYuan: 80, present: true },
          { userId: "u3", paidYuan: 80, present: true },
        ],
      },
    },
  });
  assert.equal(settled.ok, true);
  const aa = settled.afterData[0] as {
    aa: { userId: string; settleYuan: number }[];
    credit: { honored: unknown[]; breached: unknown[] };
  };
  assert.equal(aa.aa.length, 3);
  const byUser = new Map(aa.aa.map((s) => [s.userId, s.settleYuan]));
  assert.equal(byUser.get("u1"), 0);
  assert.equal(byUser.get("u2"), -20);
  assert.equal(byUser.get("u3"), -20);
  assert.equal(aa.credit.breached.length, 0);
  assert.equal(aa.credit.honored.length, 3);
});

test("超时关闭：EXPIRED 终止事件携带全退载荷流转 SETTLED", async () => {
  const start = Date.UTC(2026, 7, 15, 20, 0, 0);
  const r = await advanceLifecycle({
    ammo: meetupAmmo,
    orderId: "mtg-7",
    from: "PUBLISHED",
    to: "SETTLED",
    now: start + 25 * 3600_000,
    termination: {
      kind: "EXPIRED",
      payload: { refundYuan: 160, reason: "24h 未成局自动关闭" },
    },
  });
  assert.equal(r.ok, true);
  assert.equal(r.state, "SETTLED");
  assert.deepEqual(r.termination?.kind, "EXPIRED");
  assert.deepEqual(r.termination?.from, "PUBLISHED");
  assert.deepEqual(r.termination?.payload, { refundYuan: 160, reason: "24h 未成局自动关闭" });
});

test("注册表：官方直挂优先于默认保底（social 未配置四表仍解析官方弹药）", () => {
  assert.equal(isConfiguredCategory("social"), false);
  assert.equal(getAmmoDefinition("social").ammoId, "meetup-social-v1");
  assert.equal(getAmmoDefinition("dating").ammoId, "meetup-social-v1");
  assert.equal(getAmmoDefinition("meetup").ammoId, "meetup-social-v1");
  const keys = ["housekeeping", "meetup", "dating", "social"];
  for (const k of keys) {
    assert.ok(getAmmoDefinition(k).fiveStateHooks.length >= 2);
  }
});
