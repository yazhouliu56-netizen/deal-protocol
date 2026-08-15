/**
 * AmmoRunner 引擎测试：五态投影桥映射 / 跃迁矩阵校验 / 钩子调度
 * （BLOCK 阻止 / SKIP 忽略 / DEFER 暂存）/ 终止事件捕获 / 引信核验。
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  advanceLifecycle,
  evaluateAmmoFuze,
  toAtomicFiveState,
  type AdvanceResult,
} from "./runner.ts";
import type { IAmmoDefinition, ISubEventHook } from "../../types/ammo-schema.ts";
import {
  DEFAULT_FUZE_POLICY,
  DELAY_FUZE_TEMPLATE,
  IMPACT_FUZE_TEMPLATE,
  PROXIMITY_FUZE_TEMPLATE,
} from "../../types/fuze-policy.ts";

const emptyAmmo: IAmmoDefinition = {
  ammoId: "test-ammo",
  category: "test",
  version: "1.0.0",
  fiveStateHooks: [],
  pricingModel: { kind: "FIXED", amountYuan: 100 },
  fuzePolicy: DEFAULT_FUZE_POLICY,
};

/* ============ 1. 五态投影桥 ============ */

test("投影桥：资金终局 → SETTLED", () => {
  assert.equal(toAtomicFiveState({ isSettled: true }), "SETTLED");
  assert.equal(
    toAtomicFiveState({ waveStatus: "assembled", isSettled: true }),
    "SETTLED"
  );
});

test("投影桥：验收确认 → INSPECTED，申报未验收 → IN_SERVICE", () => {
  assert.equal(toAtomicFiveState({ fulfilmentStatus: "confirmed" }), "INSPECTED");
  assert.equal(
    toAtomicFiveState({ claimStatus: "accepted", fulfilmentStatus: "reported" }),
    "IN_SERVICE"
  );
});

test("投影桥：已接单/锁定/成局 → MATCHED", () => {
  assert.equal(toAtomicFiveState({ waveStatus: "claimed" }), "MATCHED");
  assert.equal(toAtomicFiveState({ waveStatus: "locked" }), "MATCHED");
  assert.equal(toAtomicFiveState({ waveStatus: "assembled" }), "MATCHED");
  assert.equal(toAtomicFiveState({ claimStatus: "accepted" }), "MATCHED");
  assert.equal(toAtomicFiveState({ claimStatus: "joined" }), "MATCHED");
});

test("投影桥：发布/待付 → PUBLISHED，未知状态保守兜底", () => {
  assert.equal(toAtomicFiveState({ waveStatus: "pending" }), "PUBLISHED");
  assert.equal(toAtomicFiveState({ waveStatus: "active" }), "PUBLISHED");
  assert.equal(toAtomicFiveState({}), "PUBLISHED");
  assert.equal(toAtomicFiveState({ waveStatus: "closed" }), "PUBLISHED");
});

/* ============ 2. 生命周期调度器 ============ */

test("调度：合法跃迁推进（无钩子弹药）", async () => {
  const r = await advanceLifecycle({
    ammo: emptyAmmo,
    orderId: "w1",
    from: "PUBLISHED",
    to: "MATCHED",
  });
  assert.equal(r.ok, true);
  assert.equal(r.state, "MATCHED");
  assert.equal(r.termination, undefined);
  assert.deepEqual(r.hookOutcomes, []);
});

test("调度：非法跃迁被矩阵拒绝（MATCHED → SETTLED 跳级）", async () => {
  const r = await advanceLifecycle({
    ammo: emptyAmmo,
    orderId: "w1",
    from: "MATCHED",
    to: "SETTLED",
  });
  assert.equal(r.ok, false);
  assert.equal(r.state, "MATCHED");
  assert.match(r.reason ?? "", /illegal-transition/);
});

test("调度：非法跃迁被矩阵拒绝（PUBLISHED → IN_SERVICE 跳级）", async () => {
  const r = await advanceLifecycle({
    ammo: emptyAmmo,
    orderId: "w1",
    from: "PUBLISHED",
    to: "IN_SERVICE",
  });
  assert.equal(r.ok, false);
  assert.equal(r.state, "PUBLISHED");
});

test("调度：BEFORE 钩子 BLOCK 阻止跃迁", async () => {
  const blockHook: ISubEventHook = {
    hookId: "block-on-service",
    on: { to: "IN_SERVICE" },
    phase: "BEFORE",
    fallback: "BLOCK",
    run: () => ({ ok: false, reason: "quote-not-confirmed" }),
  };
  const r = await advanceLifecycle({
    ammo: { ...emptyAmmo, fiveStateHooks: [blockHook] },
    orderId: "w1",
    from: "MATCHED",
    to: "IN_SERVICE",
  });
  assert.equal(r.ok, false);
  assert.equal(r.state, "MATCHED");
  assert.match(r.reason ?? "", /hook-blocked: block-on-service/);
  assert.equal(r.hookOutcomes[0]?.fallbackUsed, "BLOCK");
});

test("调度：BEFORE 钩子 SKIP 失败不阻断跃迁", async () => {
  const skipHook: ISubEventHook = {
    hookId: "skip-hook",
    on: { to: "IN_SERVICE" },
    phase: "BEFORE",
    fallback: "SKIP",
    run: () => ({ ok: false, reason: "soft-fail" }),
  };
  const r = await advanceLifecycle({
    ammo: { ...emptyAmmo, fiveStateHooks: [skipHook] },
    orderId: "w1",
    from: "MATCHED",
    to: "IN_SERVICE",
  });
  assert.equal(r.ok, true);
  assert.equal(r.state, "IN_SERVICE");
  assert.equal(r.hookOutcomes[0]?.fallbackUsed, "SKIP");
});

test("调度：BEFORE 钩子 DEFER 失败记录待重试", async () => {
  const deferHook: ISubEventHook = {
    hookId: "defer-hook",
    on: { to: "INSPECTED" },
    phase: "BEFORE",
    fallback: "DEFER",
    run: () => ({ ok: false, reason: "weak-network" }),
  };
  const r = await advanceLifecycle({
    ammo: { ...emptyAmmo, fiveStateHooks: [deferHook] },
    orderId: "w1",
    from: "IN_SERVICE",
    to: "INSPECTED",
  });
  assert.equal(r.ok, true);
  assert.equal(r.state, "INSPECTED");
  assert.equal(r.hookOutcomes[0]?.fallbackUsed, "DEFER");
});

test("调度：BEFORE 钩子抛异常按 BLOCK 处理", async () => {
  const throwHook: ISubEventHook = {
    hookId: "throw-hook",
    on: { to: "MATCHED" },
    phase: "BEFORE",
    fallback: "BLOCK",
    run: () => {
      throw new Error("boom");
    },
  };
  const r = await advanceLifecycle({
    ammo: { ...emptyAmmo, fiveStateHooks: [throwHook] },
    orderId: "w1",
    from: "PUBLISHED",
    to: "MATCHED",
  });
  assert.equal(r.ok, false);
  assert.equal(r.state, "PUBLISHED");
  assert.match(r.hookOutcomes[0]?.reason ?? "", /boom/);
});

test("调度：AFTER 钩子成功后透传数据（验收证据）", async () => {
  const afterHook: ISubEventHook = {
    hookId: "photo-proof",
    on: { to: "INSPECTED" },
    phase: "AFTER",
    fallback: "SKIP",
    run: () => ({ ok: true, data: { photos: ["clean-before.jpg", "clean-after.jpg"] } }),
  };
  const r = await advanceLifecycle({
    ammo: { ...emptyAmmo, fiveStateHooks: [afterHook] },
    orderId: "w1",
    from: "IN_SERVICE",
    to: "INSPECTED",
  });
  assert.equal(r.ok, true);
  assert.equal(r.state, "INSPECTED");
  assert.deepEqual(r.afterData, [{ photos: ["clean-before.jpg", "clean-after.jpg"] }]);
});

test("调度：AFTER 钩子失败不改变已推进状态（SKIP）", async () => {
  const afterFail: ISubEventHook = {
    hookId: "after-fail",
    on: { to: "INSPECTED" },
    phase: "AFTER",
    fallback: "SKIP",
    run: () => ({ ok: false, reason: "camera-unavailable" }),
  };
  const r = await advanceLifecycle({
    ammo: { ...emptyAmmo, fiveStateHooks: [afterFail] },
    orderId: "w1",
    from: "IN_SERVICE",
    to: "INSPECTED",
  });
  assert.equal(r.ok, true);
  assert.equal(r.state, "INSPECTED");
  assert.equal(r.hookOutcomes[0]?.fallbackUsed, "SKIP");
});

test("调度：终止事件携带结算载荷强制流转 SETTLED", async () => {
  const r: AdvanceResult = await advanceLifecycle({
    ammo: emptyAmmo,
    orderId: "w9",
    from: "IN_SERVICE",
    to: "INSPECTED",
    termination: { kind: "BREACH_SETTLED", payload: { forfeitYuan: 100, refundYuan: 0 } },
    now: 1_700_000_000_000,
  });
  assert.equal(r.ok, true);
  assert.equal(r.state, "SETTLED");
  assert.deepEqual(r.termination, {
    kind: "BREACH_SETTLED",
    at: 1_700_000_000_000,
    orderId: "w9",
    from: "IN_SERVICE",
    payload: { forfeitYuan: 100, refundYuan: 0 },
  });
});

test("调度：终止事件下钩子仍按目标 SETTLED 匹配执行", async () => {
  const seen: string[] = [];
  const beforeHook: ISubEventHook = {
    hookId: "watch-settled",
    on: { to: "SETTLED" },
    phase: "BEFORE",
    fallback: "SKIP",
    run: (ctx) => {
      seen.push(ctx.to);
      return { ok: true };
    },
  };
  const r = await advanceLifecycle({
    ammo: { ...emptyAmmo, fiveStateHooks: [beforeHook] },
    orderId: "w9",
    from: "MATCHED",
    to: "IN_SERVICE",
    termination: { kind: "CANCELLED", payload: { refundYuan: 88 } },
  });
  assert.equal(r.ok, true);
  assert.equal(r.state, "SETTLED");
  assert.deepEqual(seen, ["SETTLED"]);
  assert.equal(r.termination?.kind, "CANCELLED");
});

test("调度：支持 async 钩子（Promise 返回值）", async () => {
  const asyncHook: ISubEventHook = {
    hookId: "async-hook",
    on: { to: "MATCHED" },
    phase: "BEFORE",
    fallback: "BLOCK",
    run: async () => {
      await Promise.resolve();
      return { ok: true, data: { async: true } };
    },
  };
  const r = await advanceLifecycle({
    ammo: { ...emptyAmmo, fiveStateHooks: [asyncHook] },
    orderId: "w1",
    from: "PUBLISHED",
    to: "MATCHED",
  });
  assert.equal(r.ok, true);
  assert.equal(r.state, "MATCHED");
});

/* ============ 3. 引信快速核验器 ============ */

test("引信：未声明引信零防护直接放行", () => {
  const r = evaluateAmmoFuze(DEFAULT_FUZE_POLICY);
  assert.equal(r.pass, true);
  assert.deepEqual(r.checks, []);
});

test("引信：碰炸模板 —— 背调/押金缺一即拦截，齐备放行", () => {
  const bare = evaluateAmmoFuze(IMPACT_FUZE_TEMPLATE, {});
  assert.equal(bare.pass, false);
  assert.ok(bare.checks.some((c) => c.rule === "backgroundCheck"));
  assert.ok(bare.checks.some((c) => c.rule === "deposit"));

  const noDeposit = evaluateAmmoFuze(IMPACT_FUZE_TEMPLATE, { backgroundVerified: true });
  assert.equal(noDeposit.pass, false);
  assert.ok(noDeposit.checks.some((c) => c.rule === "deposit"));

  const full = evaluateAmmoFuze(IMPACT_FUZE_TEMPLATE, {
    backgroundVerified: true,
    depositHeld: true,
  });
  assert.equal(full.pass, true);
});

test("引信：延期模板 —— 围栏未进/预付未冻结拦截", () => {
  const bare = evaluateAmmoFuze(DELAY_FUZE_TEMPLATE, {});
  assert.equal(bare.pass, false);
  assert.ok(bare.checks.some((c) => c.rule === "advanceFreeze"));
  assert.ok(bare.checks.some((c) => c.rule === "geoFence"));

  const arrived = evaluateAmmoFuze(DELAY_FUZE_TEMPLATE, {
    depositHeld: true,
    atArrival: true,
  });
  assert.equal(arrived.pass, true);
});

test("引信：近炸模板 —— 隐私号会话未就绪拦截", () => {
  const bare = evaluateAmmoFuze(PROXIMITY_FUZE_TEMPLATE, {});
  assert.equal(bare.pass, false);
  assert.ok(bare.checks.some((c) => c.rule === "privacy"));

  const ready = evaluateAmmoFuze(PROXIMITY_FUZE_TEMPLATE, { privacyReady: true });
  assert.equal(ready.pass, true);
});
