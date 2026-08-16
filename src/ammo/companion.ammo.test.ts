/**
 * 标杆弹药 companion-v1 全流程测试（Phase 3 · 同城陪玩/交友 · 纯 📡 近炸引信）：
 * 发布陪玩（PUBLISHED）→ 匹配锁定（MATCHED，近炸引信前置核验）→
 * 隐私盾三闸挂载进入服务（IN_SERVICE，PrivacyShieldHook BLOCK）→
 * 验收（INSPECTED）→ 300m 离开自动结账停表（SETTLED，DepartureFinishHook
 * 含超时 ×1.2 与信用分奖励），含骚扰违约终止事件与注册表全键解析。
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  COMPANION_DEPARTURE_METERS,
  COMPANION_HOURLY_RATE,
  COMPANION_MIN_HOURS,
  COMPANION_OVERTIME_RATE,
  COMPANION_SAFETY_GATES,
  DEPARTURE_FINISH_HOOK_ID,
  PRIVACY_SHIELD_HOOK_ID,
  companionAmmo,
  departureFinishHook,
  privacyShieldHook,
} from "./companion.ammo.ts";
import {
  advanceLifecycle,
  evaluateAmmoFuze,
} from "../base/ammo/runner.ts";
import { PROXIMITY_FUZE_TEMPLATE } from "../types/fuze-policy.ts";
import {
  DEFAULT_AMMO,
  getAmmoById,
  getAmmoDefinition,
  resolveAmmoIdForPublish,
} from "./registry.ts";

/* =====================================================================
 * 1. 弹药装备完整性
 * ===================================================================== */

test("弹药装备完整性：companion-v1 声明式装填无误", () => {
  assert.equal(companionAmmo.ammoId, "companion-v1");
  assert.equal(companionAmmo.category, "companion");
  assert.equal(companionAmmo.version, "1.0.0");
  assert.deepEqual(companionAmmo.pricingModel, {
    kind: "HOURLY",
    rateYuan: COMPANION_HOURLY_RATE,
    minHours: COMPANION_MIN_HOURS,
  });
  assert.deepEqual(companionAmmo.fuzePolicy, PROXIMITY_FUZE_TEMPLATE);
  assert.equal(companionAmmo.fuzePolicy.fuzeTypes.length, 1);
  assert.deepEqual(companionAmmo.fuzePolicy.fuzeTypes, ["PROXIMITY"]);
  assert.equal(companionAmmo.fiveStateHooks.length, 2);
  assert.ok(companionAmmo.fiveStateHooks.includes(privacyShieldHook));
  assert.ok(companionAmmo.fiveStateHooks.includes(departureFinishHook));
  assert.equal(companionAmmo.sop?.capacityDefault, 1);
  assert.equal(companionAmmo.sop?.depositDefault, false);
  assert.equal(companionAmmo.dispatchRule?.weights.credit, 40);
  assert.deepEqual(companionAmmo.dispatchRule?.hardGates?.requiresVerified, [
    "陪玩",
    "交友",
    "约会",
  ]);
});

test("领域常量：¥100/h 起步 1h / 超时 ×1.2 / 离开 300m / 隐私盾三闸", () => {
  assert.equal(COMPANION_HOURLY_RATE, 100);
  assert.equal(COMPANION_MIN_HOURS, 1);
  assert.equal(COMPANION_OVERTIME_RATE, 1.2);
  assert.equal(COMPANION_DEPARTURE_METERS, 300);
  assert.deepEqual(
    COMPANION_SAFETY_GATES.map((g) => g.gate),
    ["virtualNumberBound", "journeyGuardArmed", "sensitiveWordListening"],
  );
});

/* =====================================================================
 * 2. 近炸引信核验（纯 📡 PROXIMITY_FUZE_TEMPLATE）
 * ===================================================================== */

test("近炸引信核验：隐私号会话未就绪 → 拦截（隐私盾主闸）", () => {
  const r = evaluateAmmoFuze(companionAmmo.fuzePolicy, {});
  assert.equal(r.pass, false);
  assert.ok(r.checks.some((c) => c.fuzeType === "PROXIMITY" && c.rule === "privacy"));
});

test("近炸引信核验：隐私号会话就绪 → 全项放行（虚拟号/敏感词/SOS 联动就绪）", () => {
  const r = evaluateAmmoFuze(companionAmmo.fuzePolicy, { privacyReady: true });
  assert.equal(r.pass, true);
  assert.deepEqual(r.checks, []);
  assert.equal(companionAmmo.fuzePolicy.privacy.virtualNumber, true);
  assert.equal(companionAmmo.fuzePolicy.privacy.blurLocation, true);
  assert.equal(companionAmmo.fuzePolicy.privacy.sensitiveWordIntervention, true);
  assert.equal(companionAmmo.fuzePolicy.sos.enabled, true);
  assert.equal(companionAmmo.fuzePolicy.sos.autoLocationReport, true);
  assert.equal(companionAmmo.fuzePolicy.sos.autoEvidenceAppend, true);
  assert.equal(companionAmmo.fuzePolicy.sos.notifyEmergencyContacts, true);
  assert.equal(companionAmmo.fuzePolicy.backgroundCheck, "STANDARD");
});

/* =====================================================================
 * 3. PrivacyShieldHook（IN_SERVICE 前置 · BLOCK）
 * ===================================================================== */

test("隐私盾钩子：无载荷 → BLOCK 阻止进入服务", async () => {
  const r = await advanceLifecycle({
    ammo: companionAmmo,
    orderId: "cp-1",
    from: "MATCHED",
    to: "IN_SERVICE",
  });
  assert.equal(r.ok, false);
  assert.equal(r.state, "MATCHED");
  assert.ok(r.reason?.includes("privacy-shield-required"));
});

test("隐私盾钩子：三闸部分未就绪 → BLOCK 并列出缺项闸名", async () => {
  const r = await advanceLifecycle({
    ammo: companionAmmo,
    orderId: "cp-2",
    from: "MATCHED",
    to: "IN_SERVICE",
    payload: {
      privacyShield: { virtualNumberBound: true, journeyGuardArmed: false },
    },
  });
  assert.equal(r.ok, false);
  assert.equal(r.state, "MATCHED");
  assert.ok(r.reason?.includes("journeyGuardArmed"));
});

test("隐私盾钩子：三闸全就绪 → 放行并透传武装确认", async () => {
  const r = await advanceLifecycle({
    ammo: companionAmmo,
    orderId: "cp-3",
    from: "MATCHED",
    to: "IN_SERVICE",
    payload: {
      privacyShield: {
        virtualNumberBound: true,
        journeyGuardArmed: true,
        sensitiveWordListening: true,
      },
    },
  });
  assert.equal(r.ok, true);
  assert.equal(r.state, "IN_SERVICE");
  assert.equal(r.hookOutcomes.length, 1);
  assert.equal(r.hookOutcomes[0].hookId, PRIVACY_SHIELD_HOOK_ID);
  assert.equal(r.hookOutcomes[0].ok, true);
  assert.equal(r.hookOutcomes[0].fallbackUsed, "NONE");
});

/* =====================================================================
 * 4. DepartureFinishHook（SETTLED 后置 · 300m 离开自动停表）
 * ===================================================================== */

const NOW = 1_800_000_000_000;

test("离开停表钩子：距离 < 300m → 记不满足（AFTER 不阻断终局）", async () => {
  const r = await advanceLifecycle({
    ammo: companionAmmo,
    orderId: "cp-4",
    from: "INSPECTED",
    to: "SETTLED",
    now: NOW,
    payload: {
      departure: { distanceMeters: 120, startedAt: NOW - 90 * 60_000 },
    },
  });
  assert.equal(r.ok, true);
  assert.equal(r.state, "SETTLED");
  assert.equal(r.hookOutcomes.length, 1);
  assert.equal(r.hookOutcomes[0].ok, false);
  assert.ok(r.hookOutcomes[0].reason?.includes("departure-within-safe-radius"));
});

test("离开停表钩子：≥300m 自动结账停表（1h 内按时薪，超出 ×1.2）", async () => {
  const r = await advanceLifecycle({
    ammo: companionAmmo,
    orderId: "cp-5",
    from: "INSPECTED",
    to: "SETTLED",
    now: NOW,
    payload: {
      at: NOW,
      departure: {
        distanceMeters: 480,
        startedAt: NOW - 45 * 60_000,
      },
    },
  });
  assert.equal(r.ok, true);
  assert.equal(r.state, "SETTLED");
  const settle = r.afterData[0] as {
    elapsedMinutes?: number;
    billedYuan?: number;
    rateYuan?: number;
    credit?: { bonus?: number };
  };
  assert.equal(settle.elapsedMinutes, 45);
  assert.equal(settle.billedYuan, 100);
  assert.equal(settle.credit?.bonus, 5);
});

test("离开停表钩子：超时 2.5h → 起步 1h + 超出 1.5h ×1.2（100 + 180 = 280）", async () => {
  const r = await advanceLifecycle({
    ammo: companionAmmo,
    orderId: "cp-6",
    from: "INSPECTED",
    to: "SETTLED",
    now: NOW,
    payload: {
      at: NOW,
      departure: {
        distanceMeters: 300,
        startedAt: NOW - 150 * 60_000,
      },
    },
  });
  assert.equal(r.ok, true);
  const settle = r.afterData[0] as { elapsedMinutes?: number; billedYuan?: number };
  assert.equal(settle.elapsedMinutes, 150);
  assert.equal(settle.billedYuan, 280);
});

test("离开停表钩子：缺载荷 → 记 reason（SKIP 降级不阻塞）", async () => {
  const r = await advanceLifecycle({
    ammo: companionAmmo,
    orderId: "cp-7",
    from: "INSPECTED",
    to: "SETTLED",
    now: NOW,
  });
  assert.equal(r.ok, true);
  assert.equal(r.state, "SETTLED");
  assert.equal(r.hookOutcomes[0].ok, false);
  assert.equal(r.hookOutcomes[0].reason, "departure-data-required");
  assert.equal(r.hookOutcomes[0].fallbackUsed, "SKIP");
});

/* =====================================================================
 * 5. 五态全流程流转（近炸引信 + 双钩子全链）
 * ===================================================================== */

test("全流程：发布→匹配→隐私盾挂载→服务→验收→300m 离开自动结算", async () => {
  const orderId = "cp-full-1";

  const published = await advanceLifecycle({
    ammo: companionAmmo,
    orderId,
    from: "PUBLISHED",
    to: "MATCHED",
  });
  assert.equal(published.ok, true);
  assert.equal(published.state, "MATCHED");

  const inService = await advanceLifecycle({
    ammo: companionAmmo,
    orderId,
    from: "MATCHED",
    to: "IN_SERVICE",
    now: NOW - 2 * 3600_000,
    payload: {
      privacyShield: {
        virtualNumberBound: true,
        journeyGuardArmed: true,
        sensitiveWordListening: true,
      },
    },
  });
  assert.equal(inService.ok, true);
  assert.equal(inService.state, "IN_SERVICE");

  const inspected = await advanceLifecycle({
    ammo: companionAmmo,
    orderId,
    from: "IN_SERVICE",
    to: "INSPECTED",
    now: NOW - 30 * 60_000,
  });
  assert.equal(inspected.ok, true);
  assert.equal(inspected.state, "INSPECTED");

  const settled = await advanceLifecycle({
    ammo: companionAmmo,
    orderId,
    from: "INSPECTED",
    to: "SETTLED",
    now: NOW,
    payload: {
      at: NOW,
      departure: {
        distanceMeters: 520,
        startedAt: NOW - 2 * 3600_000,
      },
    },
  });
  assert.equal(settled.ok, true);
  assert.equal(settled.state, "SETTLED");
  assert.equal(settled.hookOutcomes.length, 1);
  assert.equal(settled.hookOutcomes[0].hookId, DEPARTURE_FINISH_HOOK_ID);
  const settle = settled.afterData[0] as { billedYuan?: number; elapsedMinutes?: number };
  // 2h = 起步 1h(100) + 超出 1h ×1.2(120) = 220
  assert.equal(settle.billedYuan, 220);
  assert.equal(settle.elapsedMinutes, 120);
});

test("骚扰违约终止：BREACH_SETTLED 载荷强制流转 SETTLED（隔离墙语义）", async () => {
  const r = await advanceLifecycle({
    ammo: companionAmmo,
    orderId: "cp-breach-1",
    from: "IN_SERVICE",
    to: "SETTLED",
    now: NOW,
    termination: {
      kind: "BREACH_SETTLED",
      payload: {
        breach: "harassment",
        refundYuan: 100,
        blocked: true,
      },
    },
  });
  assert.equal(r.ok, true);
  assert.equal(r.state, "SETTLED");
  assert.deepEqual(r.termination?.kind, "BREACH_SETTLED");
  assert.deepEqual(r.termination?.payload, { breach: "harassment", refundYuan: 100, blocked: true });
});

/* =====================================================================
 * 6. 注册表挂载（三大标杆弹药大满贯）
 * ===================================================================== */

test("注册表：companion/dating/escort 全键解析到 companion-v1", () => {
  for (const c of ["companion", "dating", "escort"]) {
    assert.equal(getAmmoDefinition(c).ammoId, "companion-v1");
    assert.equal(getAmmoDefinition(c).fuzePolicy.fuzeTypes.length, 1);
  }
});

test("注册表：中文品类归一化 → companion-v1（陪玩/交友/约会/约拍）", () => {
  assert.equal(resolveAmmoIdForPublish("陪玩"), "companion-v1");
  assert.equal(resolveAmmoIdForPublish("交友"), "companion-v1");
  assert.equal(resolveAmmoIdForPublish("约会"), "companion-v1");
  assert.equal(resolveAmmoIdForPublish("摄影师约拍"), "companion-v1");
  assert.equal(resolveAmmoIdForPublish("约拍"), "companion-v1");
});

test("注册表：三大标杆弹药大满贯（家政/组局/陪玩全品类覆盖）", () => {
  assert.equal(getAmmoDefinition("housekeeping").ammoId, "housekeeping-v1");
  assert.equal(getAmmoDefinition("meetup").ammoId, "meetup-social-v1");
  assert.equal(getAmmoDefinition("companion").ammoId, "companion-v1");
  const keys = ["housekeeping", "meetup", "companion"];
  for (const k of keys) {
    assert.ok(getAmmoDefinition(k).fiveStateHooks.length >= 2);
  }
});

test("注册表：getAmmoById 反查整弹 / 未配置类目仍保底", () => {
  assert.equal(getAmmoById("companion-v1"), companionAmmo);
  assert.equal(getAmmoById("housekeeping-v1").ammoId, "housekeeping-v1");
  assert.equal(getAmmoDefinition("不存在类目").ammoId, DEFAULT_AMMO.ammoId);
  assert.equal(getAmmoDefinition("不存在类目").fuzePolicy.fuzeTypes.length, 0);
});

test("注册表：dating 类目自 meetup 迁移至 companion（同人风险归近炸引信）", () => {
  assert.equal(getAmmoDefinition("dating").ammoId, "companion-v1");
  assert.notEqual(getAmmoDefinition("dating").ammoId, "meetup-social-v1");
});
