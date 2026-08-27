import { test } from "node:test";
import assert from "node:assert/strict";
import {
  clearRoamQueue,
  enqueueRoam,
  getRoamQueue,
  listDevices,
  postHeartbeat,
  replayRoamQueue,
  syncDevice,
  BACKOFF_LADDER_MS,
  parseRetryAfterSeconds,
  resolveRetryDelayMs,
} from "./roam-sync.ts";

function setNavigator(value: unknown) {
  try {
    Object.defineProperty(globalThis, "navigator", {
      value,
      configurable: true,
      writable: true,
    });
  } catch {}
}
function restoreNavigator(orig: unknown) {
  try {
    if (orig === undefined) {
      delete (globalThis as unknown as { navigator?: unknown }).navigator;
    } else {
      Object.defineProperty(globalThis, "navigator", {
        value: orig,
        configurable: true,
        writable: true,
      });
    }
  } catch {}
}

test("roam-sync: 离线 0ms 回落（navigator.onLine===false）", async () => {
  const orig = (globalThis as unknown as { navigator?: unknown }).navigator;
  setNavigator({ onLine: false });
  const r1 = await syncDevice({ deviceId: "dev-1" });
  assert.equal(r1.ok, false);
  assert.equal(r1.fallback, true);
  const r2 = await listDevices();
  assert.equal(r2.ok, false);
  restoreNavigator(orig);
});

test("roam-sync: fetch 异常回落不抛", async () => {
  const origFetch = globalThis.fetch;
  const origNav = (globalThis as unknown as { navigator?: unknown }).navigator;
  globalThis.fetch = async () => {
    throw new Error("network down");
  };
  setNavigator({ onLine: true });
  const r = await syncDevice({ deviceId: "dev-x" });
  assert.equal(r.ok, false);
  assert.equal(r.fallback, true);
  globalThis.fetch = origFetch;
  restoreNavigator(origNav);
});

test("roam-sync: postHeartbeat 复用 syncDevice", async () => {
  const origFetch = globalThis.fetch;
  const origNav = (globalThis as unknown as { navigator?: unknown }).navigator;
  let called = false;
  globalThis.fetch = async () => {
    called = true;
    return { ok: true, json: async () => ({ devices: [] }) } as unknown as Response;
  };
  setNavigator({ onLine: true });
  const r = await postHeartbeat("dev-hb");
  assert.equal(called, true);
  assert.equal(r.ok, true);
  globalThis.fetch = origFetch;
  restoreNavigator(origNav);
});

test("roam-sync: listDevices 成功解析 devices", async () => {
  const origFetch = globalThis.fetch;
  const origNav = (globalThis as unknown as { navigator?: unknown }).navigator;
  globalThis.fetch = async () =>
    ({ ok: true, json: async () => ({ devices: [{ device_id: "d1" }] }) } as unknown as Response);
  setNavigator({ onLine: true });
  const r = await listDevices();
  assert.equal(r.ok, true);
  if (r.ok) assert.equal(r.devices.length, 1);
  globalThis.fetch = origFetch;
  restoreNavigator(origNav);
});

test("roam-sync: 离线队列 (deviceId) 去重 Last-Win", async () => {
  const origLS = globalThis.localStorage;
  const store: Record<string, string> = {};
  globalThis.localStorage = {
    getItem: (k: string) => store[k] ?? null,
    setItem: (k: string, v: string) => { store[k] = v; },
    removeItem: (k: string) => { delete store[k]; },
  } as unknown as Storage;
  clearRoamQueue();
  enqueueRoam({ deviceId: "dev-dedup", fingerprint: { a: 1 } });
  enqueueRoam({ deviceId: "dev-dedup", fingerprint: { a: 2 } });
  enqueueRoam({ deviceId: "dev-other", fingerprint: {} });
  const q = getRoamQueue();
  assert.equal(q.length, 2);
  assert.equal(q.filter((x) => x.deviceId === "dev-dedup").length, 1);
  assert.deepEqual(q.find((x) => x.deviceId === "dev-dedup")?.fingerprint, { a: 2 });
  clearRoamQueue();
  if (origLS) globalThis.localStorage = origLS;
  else delete (globalThis as unknown as { localStorage?: unknown }).localStorage;
});

test("roam-sync: 指数退避阶梯纯函数 300→1s→3s→5s 封顶", () => {
  assert.deepEqual([...BACKOFF_LADDER_MS], [300, 1000, 3000, 5000]);
  assert.equal(resolveRetryDelayMs(0), 300);
  assert.equal(resolveRetryDelayMs(1), 1000);
  assert.equal(resolveRetryDelayMs(2), 3000);
  assert.equal(resolveRetryDelayMs(3), 5000);
  assert.equal(resolveRetryDelayMs(9), 5000, "超出阶梯封顶 5s");
});

test("roam-sync: Retry-After 响应头解析（秒×1000，非法回落阶梯）", () => {
  assert.equal(parseRetryAfterSeconds("5"), 5);
  assert.equal(parseRetryAfterSeconds(" 12 "), 12);
  assert.equal(parseRetryAfterSeconds(null), null);
  assert.equal(parseRetryAfterSeconds("abc"), null, "NaN 回落");
  assert.equal(parseRetryAfterSeconds("0"), null, "≤0 回落");
  assert.equal(parseRetryAfterSeconds("-3"), null, "负值回落");
  assert.equal(parseRetryAfterSeconds("61"), null, ">60 回落");
  assert.equal(resolveRetryDelayMs(2, "5"), 5000, "Retry-After 优先于阶梯");
  assert.equal(resolveRetryDelayMs(0, "12"), 12000, "12s×1000=12000ms");
});

test("roam-sync: 联网退避重放 + 429 阶梯递增（delayFn 注入零真实休眠）", async () => {
  const origLS = globalThis.localStorage;
  const store: Record<string, string> = {};
  globalThis.localStorage = {
    getItem: (k: string) => store[k] ?? null,
    setItem: (k: string, v: string) => { store[k] = v; },
    removeItem: (k: string) => { delete store[k]; },
  } as unknown as Storage;
  const origFetch = globalThis.fetch;
  const origNav = (globalThis as unknown as { navigator?: unknown }).navigator;
  const delays: number[] = [];
  const delayFn = async (ms: number) => { delays.push(ms); };
  clearRoamQueue();
  enqueueRoam({ deviceId: "dev-1", fingerprint: {} });
  let call = 0;
  globalThis.fetch = async () => {
    call++;
    return { ok: false, status: 429, json: async () => ({}) } as unknown as Response;
  };
  setNavigator({ onLine: true });
  await replayRoamQueue(delayFn);
  const left = getRoamQueue();
  assert.equal(left.length, 1);
  assert.equal(left[0].deviceId, "dev-1", "持续 429 保留剩余队列");
  assert.equal(call, 5, "单条重试 5 次（1 初始 + 4 退避）");
  assert.deepEqual(delays, [300, 1000, 3000, 5000], "指数阶梯 300→1s→3s→5s");
  clearRoamQueue();
  globalThis.fetch = origFetch;
  restoreNavigator(origNav);
  if (origLS) globalThis.localStorage = origLS;
  else delete (globalThis as unknown as { localStorage?: unknown }).localStorage;
});

test("roam-sync: 429 携带 Retry-After 精准延时 + 成功后 attempt 重置", async () => {
  const origLS = globalThis.localStorage;
  const store: Record<string, string> = {};
  globalThis.localStorage = {
    getItem: (k: string) => store[k] ?? null,
    setItem: (k: string, v: string) => { store[k] = v; },
    removeItem: (k: string) => { delete store[k]; },
  } as unknown as Storage;
  const origFetch = globalThis.fetch;
  const origNav = (globalThis as unknown as { navigator?: unknown }).navigator;
  const delays: number[] = [];
  const delayFn = async (ms: number) => { delays.push(ms); };
  clearRoamQueue();
  enqueueRoam({ deviceId: "dev-ra-1", fingerprint: {} });
  enqueueRoam({ deviceId: "dev-ra-2", fingerprint: {} });
  let call = 0;
  globalThis.fetch = async () => {
    call++;
    // dev-ra-1 首次 429 + Retry-After: 5 → 5000ms；重试成功
    if (call === 1) {
      return {
        ok: false,
        status: 429,
        headers: { get: (k: string) => (k === "Retry-After" ? "5" : null) },
        json: async () => ({}),
      } as unknown as Response;
    }
    if (call === 2) return { ok: true, json: async () => ({}) } as unknown as Response;
    // dev-ra-2 无 Retry-After → 阶梯 300ms 首档，随后成功（attempt 重置语义）
    if (call === 3) return { ok: false, status: 429, json: async () => ({}) } as unknown as Response;
    return { ok: true, json: async () => ({}) } as unknown as Response;
  };
  setNavigator({ onLine: true });
  await replayRoamQueue(delayFn);
  const left = getRoamQueue();
  assert.equal(left.length, 0, "两条均成功送达后队列清空");
  assert.equal(call, 4);
  assert.deepEqual(delays, [5000, 300, 300], "Retry-After 5s 优先 + 节流 300 + 阶梯首档 300");
  clearRoamQueue();
  globalThis.fetch = origFetch;
  restoreNavigator(origNav);
  if (origLS) globalThis.localStorage = origLS;
  else delete (globalThis as unknown as { localStorage?: unknown }).localStorage;
});

test("roam-sync: syncDevice 离线自动入队", async () => {
  const origLS = globalThis.localStorage;
  const store: Record<string, string> = {};
  globalThis.localStorage = {
    getItem: (k: string) => store[k] ?? null,
    setItem: (k: string, v: string) => { store[k] = v; },
    removeItem: (k: string) => { delete store[k]; },
  } as unknown as Storage;
  const origNav = (globalThis as unknown as { navigator?: unknown }).navigator;
  clearRoamQueue();
  setNavigator({ onLine: false });
  const r = await syncDevice({ deviceId: "dev-offline" });
  assert.equal(r.ok, false);
  assert.equal(getRoamQueue().length, 1);
  assert.equal(getRoamQueue()[0].deviceId, "dev-offline");
  clearRoamQueue();
  restoreNavigator(origNav);
  if (origLS) globalThis.localStorage = origLS;
  else delete (globalThis as unknown as { localStorage?: unknown }).localStorage;
});
