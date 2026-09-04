/**
 * 沙盒 Bot 服务者自动响应调度器单测（node:test · P0 双边市场空转治理）。
 * 覆盖：1v1 openClaim→acceptClaim 全链 / 组局 joinSeat 分支 / 错误分支捕获 /
 * 防过期快照安全中止 / 持久化 claim 判定退让 / 会话防抖 / cancel 句柄 /
 * personaToCapability 真实类型对齐 / 人设选择三级回落。
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  BOT_RESPONSE_DELAY_MS,
  DEMO_BOT_PERSONAS,
  personaForWave,
  personaToCapability,
  resetSandboxBotForTest,
  scheduleBotResponse,
  type IBotStoreActions,
} from "./sandbox-bot.ts";
import type { Claim, Wave } from "../order/wave.ts";

const flush = () => new Promise<void>((r) => setTimeout(r, 10));

function makeWave(over: Partial<Wave> = {}): Wave {
  return {
    id: "wave-test-1",
    authorId: "user-alex",
    basics: { category: "家政保洁", time: "", area: "", radiusKm: 5 },
    budget: 120,
    customs: [],
    negotiable: false,
    capacity: 1,
    expiresAt: Date.now() + 3_600_000,
    createdAt: Date.now(),
    status: "active",
    ammoId: "housekeeping-v1",
    ...over,
  };
}

/** 可断言的 mock action 面（记录调用序列与入参）。 */
function makeActions(over: {
  wave?: Wave | undefined;
  hasClaim?: boolean;
  openClaimError?: string;
  joinSeatError?: string;
} = {}) {
  const calls: string[] = [];
  let claimSeq = 0;
  const actions: IBotStoreActions & { calls: string[] } = {
    calls,
    getLatestWave: (waveId) => (over.wave ? { ...over.wave, id: waveId } : undefined),
    hasClaimForWave: () => over.hasClaim ?? false,
    registerResponder: (responder) => {
      calls.push(`registerResponder:${responder.id}:${responder.nickname}:${responder.creditLevel}`);
    },
    openClaim: (p) => {
      calls.push(`openClaim:${p.waveId}:${p.responderId}:${p.price}`);
      if (over.openClaimError) return { error: over.openClaimError };
      const claim: Pick<Claim, "id" | "waveId" | "responderId" | "status" | "rounds"> = {
        id: `claim-${++claimSeq}`,
        waveId: p.waveId,
        responderId: p.responderId,
        status: "offered",
        rounds: 0,
      };
      return { claim: claim as Claim };
    },
    acceptClaim: (claimId) => {
      calls.push(`acceptClaim:${claimId}`);
    },
    joinSeat: (p) => {
      calls.push(`joinSeat:${p.waveId}:${p.responderId}`);
      if (over.joinSeatError) return { error: over.joinSeatError };
      const claim: Pick<Claim, "id" | "waveId" | "responderId" | "status" | "rounds"> = {
        id: `seat-${++claimSeq}`,
        waveId: p.waveId,
        responderId: p.responderId,
        status: "joined",
        rounds: 0,
      };
      return { claim: claim as Claim, assembled: false };
    },
  };
  return actions;
}

test("默认延时为 5 秒", () => {
  assert.equal(BOT_RESPONSE_DELAY_MS, 5000);
});

test("1v1 单人单：openClaim(budget) → acceptClaim，返回 mode locked 与王姐人设", async () => {
  resetSandboxBotForTest();
  const actions = makeActions({ wave: makeWave() });
  let result: unknown;
  const cancel = scheduleBotResponse("wave-test-1", actions, 0, (r) => (result = r));
  assert.ok(cancel);
  await flush();
  assert.deepEqual(actions.calls, [
    "registerResponder:bot-wang:王姐:5",
    "openClaim:wave-test-1:bot-wang:120",
    "acceptClaim:claim-1",
  ]);
  assert.deepEqual(result, {
    success: true,
    waveId: "wave-test-1",
    personaName: "王姐",
    mode: "locked",
  });
});

test("组局 capacity≥2：只走 joinSeat 占 1 席，不触碰 openClaim/acceptClaim", async () => {
  resetSandboxBotForTest();
  const actions = makeActions({
    wave: makeWave({
      capacity: 4,
      ammoId: "meetup-social-v1",
      basics: { category: "羽毛球约局", time: "", area: "", radiusKm: 5 },
    }),
  });
  let result: unknown;
  scheduleBotResponse("wave-group", actions, 0, (r) => (result = r));
  await flush();
  assert.deepEqual(actions.calls.filter((c) => !c.startsWith("registerResponder")), [
    "joinSeat:wave-group:bot-akai",
  ]);
  assert.equal((result as { success: boolean; mode: string; personaName: string }).success, true);
  assert.equal((result as { mode: string }).mode, "joined");
  assert.equal((result as { personaName: string }).personaName, "阿凯");
});

test("组局满员成局：assembled 直传结果描述符", async () => {
  resetSandboxBotForTest();
  const actions = makeActions({ wave: makeWave({ capacity: 2, ammoId: "meetup-social-v1" }) });
  actions.joinSeat = () => ({
    claim: { id: "s1", waveId: "w", responderId: "bot-akai", status: "accepted", rounds: 0, createdAt: Date.now() },
    assembled: true,
  });
  let result: unknown;
  scheduleBotResponse("wave-full", actions, 0, (r) => (result = r));
  await flush();
  assert.equal((result as { success: boolean; assembled?: boolean }).success, true);
  assert.equal((result as { assembled?: boolean }).assembled, true);
});

test("执行时刻已取消发布（status closed）：安全中止零副作用", async () => {
  resetSandboxBotForTest();
  // 排程时 active，5s 窗口内用户取消发布 —— 执行时刻重读到 closed
  let closed = false;
  const wave = makeWave();
  const actions = makeActions({});
  actions.getLatestWave = (waveId) =>
    closed ? { ...wave, id: waveId, status: "closed" as const } : { ...wave, id: waveId };
  let result: unknown;
  const cancel = scheduleBotResponse("wave-closed", actions, 5, (r) => (result = r));
  assert.ok(cancel);
  closed = true;
  await flush();
  assert.deepEqual(result, {
    success: false,
    waveId: "wave-closed",
    reason: "wave-not-active",
  });
  assert.deepEqual(actions.calls, []);
});

test("已有 claim（持久化判定）：不重复派单", async () => {
  resetSandboxBotForTest();
  const actions = makeActions({ wave: makeWave(), hasClaim: true });
  const cancel = scheduleBotResponse("wave-claimed", actions, 0, () => {});
  assert.equal(cancel, null);
  await flush();
  assert.deepEqual(actions.calls, []);
});

test("会话内防抖：同一 waveId 二次排程返回 null，回调仅触发一次", async () => {
  resetSandboxBotForTest();
  const actions = makeActions({ wave: makeWave() });
  let count = 0;
  const c1 = scheduleBotResponse("wave-dup", actions, 0, () => ++count);
  const c2 = scheduleBotResponse("wave-dup", actions, 0, () => ++count);
  assert.ok(c1);
  assert.equal(c2, null);
  await flush();
  assert.equal(count, 1);
});

test("cancel 句柄：清除定时器并释放占位（可重新排程）", async () => {
  resetSandboxBotForTest();
  const actions = makeActions({ wave: makeWave() });
  let fired = 0;
  const c1 = scheduleBotResponse("wave-cancel", actions, 20, () => ++fired);
  assert.ok(c1);
  c1();
  const c2 = scheduleBotResponse("wave-cancel", actions, 20, () => ++fired);
  assert.ok(c2);
  c2();
  await new Promise<void>((r) => setTimeout(r, 50));
  assert.equal(fired, 0);
});

test("openClaim 失败：success false + reason，acceptClaim 不被调用", async () => {
  resetSandboxBotForTest();
  const actions = makeActions({ wave: makeWave(), openClaimError: "gate-money-minor" });
  let result: unknown;
  scheduleBotResponse("wave-err", actions, 0, (r) => (result = r));
  await flush();
  assert.equal((result as { success: boolean }).success, false);
  assert.equal((result as { reason?: string }).reason, "gate-money-minor");
  assert.equal(
    actions.calls.some((c) => c.startsWith("acceptClaim")),
    false
  );
});

test("joinSeat 失败（审批制局）：success false + 原样 reason", async () => {
  resetSandboxBotForTest();
  const actions = makeActions({
    wave: makeWave({ capacity: 4, ammoId: "meetup-social-v1" }),
    joinSeatError: "approval-required",
  });
  let result: unknown;
  scheduleBotResponse("wave-approval", actions, 0, (r) => (result = r));
  await flush();
  assert.equal((result as { success: boolean }).success, false);
  assert.equal((result as { reason?: string }).reason, "approval-required");
});

test("真实用户抢先接单（执行时刻才出现 claim）：退让不重复接单", async () => {
  resetSandboxBotForTest();
  // 排程时无 claim，执行时刻真实用户抢先 —— 模拟竞态窗口
  let raced = false;
  let result: unknown;
  const actions = makeActions({ wave: makeWave() });
  actions.hasClaimForWave = () => raced;
  const cancel = scheduleBotResponse("wave-race", actions, 5, (r) => (result = r));
  assert.ok(cancel);
  raced = true;
  await flush();
  assert.deepEqual(result, {
    success: false,
    waveId: "wave-race",
    reason: "already-claimed",
  });
});

test("personaToCapability 输出 ResponderCapability 兼容结构（无 avatar 泄漏）", () => {
  const cap = personaToCapability(DEMO_BOT_PERSONAS["housekeeping-v1"]);
  assert.equal(cap.id, "bot-wang");
  assert.equal(cap.nickname, "王姐");
  assert.deepEqual(cap.categories, ["家政保洁", "厨师 · 上门做饭"]);
  assert.equal(cap.creditLevel, 5);
  assert.equal(cap.verified, true);
  assert.equal(cap.online, true);
  assert.equal("avatar" in cap, false);
});

test("人设选择三级回落：ammoId 精确 → 中文品类关键词 → default 兜底", () => {
  assert.equal(personaForWave("housekeeping-v1").id, "bot-wang");
  assert.equal(personaForWave(undefined, "摄影师约拍").id, "bot-xiaobei");
  assert.equal(personaForWave(undefined, "修空调").id, "bot-zhang");
  assert.equal(personaForWave("unknown-ammo-x", "量子纠缠调试").id, DEMO_BOT_PERSONAS.default.id);
});
