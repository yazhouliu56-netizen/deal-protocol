import { test } from "node:test";
import assert from "node:assert/strict";
import { createSyncBus } from "./sync-bus.ts";

function createFakeEnv(): {
  win: {
    addEventListener: (type: string, handler: EventListener) => void;
    removeEventListener: (type: string, handler: EventListener) => void;
    navigator: { onLine: boolean };
  };
  doc: {
    addEventListener: (type: string, handler: EventListener) => void;
    removeEventListener: (type: string, handler: EventListener) => void;
    visibilityState: string;
  };
  dispatch: (type: string) => void;
} {
  const listeners = new Map<string, Set<EventListener>>();
  const env = {
    win: {
      addEventListener: (type: string, handler: EventListener) => {
        if (!listeners.has(type)) listeners.set(type, new Set());
        listeners.get(type)!.add(handler);
      },
      removeEventListener: (type: string, handler: EventListener) => {
        listeners.get(type)?.delete(handler);
      },
      navigator: { onLine: true },
    },
    doc: {
      addEventListener: (type: string, handler: EventListener) => {
        if (!listeners.has(type)) listeners.set(type, new Set());
        listeners.get(type)!.add(handler);
      },
      removeEventListener: (type: string, handler: EventListener) => {
        listeners.get(type)?.delete(handler);
      },
      visibilityState: "visible",
    },
    dispatch: (type: string) => {
      for (const h of listeners.get(type) ?? []) h({ type } as Event);
    },
  };
  return env;
}

function delay(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

test("sync-bus: getOnlineStatus 默认 true", () => {
  const bus = createSyncBus();
  assert.equal(bus.getOnlineStatus(), true);
});

test("sync-bus: 无 window 返回 no-op 解绑 + SSR 安全", () => {
  const bus = createSyncBus();
  const unsub1 = bus.subscribeOnlineStatus(() => { assert.fail("不应触发"); });
  unsub1();
  const unsub2 = bus.registerSyncTrigger(() => { assert.fail("不应触发"); });
  unsub2();
  assert.equal(bus.getOnlineStatus(), true);
  bus.dispose();
});

test("sync-bus: online 事件触发 hook 及状态通知", async () => {
  const env = createFakeEnv();
  const bus = createSyncBus({ win: env.win, doc: env.doc, debounceMs: 10, cooldownMs: 0 });
  const calls: string[] = [];
  bus.registerSyncTrigger(() => { calls.push("hook"); });
  bus.subscribeOnlineStatus((online) => { calls.push(`status:${online}`); });
  env.win.navigator.onLine = false;
  env.dispatch("offline");
  await delay(80);
  assert.ok(calls.some((c) => c.startsWith("status:")), "状态通知触发");
  env.win.navigator.onLine = true;
  env.dispatch("online");
  await delay(80);
  assert.ok(calls.includes("hook"), "online 触发 hook");
  bus.dispose();
});

test("sync-bus: visibilitychange visible 触发 hook", async () => {
  const env = createFakeEnv();
  const bus = createSyncBus({ win: env.win, doc: env.doc, debounceMs: 10, cooldownMs: 0 });
  const calls: string[] = [];
  bus.registerSyncTrigger(() => { calls.push("hook"); });
  env.doc.visibilityState = "visible";
  env.dispatch("visibilitychange");
  await delay(80);
  assert.equal(calls.length, 1, "visibilitychange visible 触发 hook");
  // hidden 不触发
  env.doc.visibilityState = "hidden";
  env.dispatch("visibilitychange");
  await delay(80);
  assert.equal(calls.length, 1, "hidden 不触发 hook");
  bus.dispose();
});

test("sync-bus: debounce 合并同帧触发", async () => {
  const env = createFakeEnv();
  const calls: number[] = [];
  const bus = createSyncBus({ win: env.win, doc: env.doc, debounceMs: 30, cooldownMs: 0 });
  bus.registerSyncTrigger(() => { calls.push(Date.now()); });
  // 同帧连续触发
  env.dispatch("online");
  env.dispatch("visibilitychange");
  await delay(100);
  assert.equal(calls.length, 1, "debounce 合并同帧为一次");
  bus.dispose();
});

test("sync-bus: 2000ms 冷却窗口内跳过重复触发", async () => {
  const env = createFakeEnv();
  const calls: number[] = [];
  const bus = createSyncBus({ win: env.win, doc: env.doc, debounceMs: 10, cooldownMs: 2000 });
  bus.registerSyncTrigger(() => { calls.push(1); });
  env.dispatch("online");
  await delay(80);
  assert.equal(calls.length, 1, "首次触发");
  // 冷却期内再触发 → 跳过
  env.dispatch("online");
  await delay(80);
  assert.equal(calls.length, 1, "冷却期内跳过");
  bus.dispose();
});

test("sync-bus: 取消订阅后不再触发", async () => {
  const env = createFakeEnv();
  const calls: string[] = [];
  const bus = createSyncBus({ win: env.win, doc: env.doc, debounceMs: 10, cooldownMs: 0 });
  const unsub = bus.registerSyncTrigger(() => { calls.push("hook"); });
  unsub();
  env.dispatch("online");
  await delay(80);
  assert.equal(calls.length, 0, "取消后不触发");
  bus.dispose();
});

test("sync-bus: dispose 移除所有事件监听 + 清理状态", async () => {
  const env = createFakeEnv();
  const calls: string[] = [];
  const bus = createSyncBus({ win: env.win, doc: env.doc, debounceMs: 10, cooldownMs: 0 });
  bus.registerSyncTrigger(() => { calls.push("hook"); });
  bus.dispose();
  env.dispatch("online");
  await delay(80);
  assert.equal(calls.length, 0, "dispose 后不触发");
});

test("sync-bus: 串行链不并发执行 hook", async () => {
  const env = createFakeEnv();
  const order: number[] = [];
  const bus = createSyncBus({ win: env.win, doc: env.doc, debounceMs: 10, cooldownMs: 0 });
  bus.registerSyncTrigger(async () => {
    order.push(1);
    await delay(40);
  });
  bus.registerSyncTrigger(async () => {
    order.push(2);
  });
  env.dispatch("online");
  await delay(100);
  assert.deepEqual(order, [1, 2], "串行执行顺序");
  bus.dispose();
});

test("sync-bus: subscribeOnlineStatus 回调获正确状态", async () => {
  const env = createFakeEnv();
  const statuses: boolean[] = [];
  const bus = createSyncBus({ win: env.win, doc: env.doc, debounceMs: 10, cooldownMs: 0 });
  bus.subscribeOnlineStatus((s) => { statuses.push(s); });
  env.win.navigator.onLine = false;
  env.dispatch("offline");
  await delay(80);
  assert.equal(statuses.some((s) => s === false), true);
  env.win.navigator.onLine = true;
  env.dispatch("online");
  await delay(80);
  assert.equal(statuses.some((s) => s === true), true);
  bus.dispose();
});