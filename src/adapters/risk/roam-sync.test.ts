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

test("roam-sync: 联网 300ms 节流重放 + 429 退避保留队列", async () => {
  const origLS = globalThis.localStorage;
  const store: Record<string, string> = {};
  globalThis.localStorage = {
    getItem: (k: string) => store[k] ?? null,
    setItem: (k: string, v: string) => { store[k] = v; },
    removeItem: (k: string) => { delete store[k]; },
  } as unknown as Storage;
  const origFetch = globalThis.fetch;
  const origNav = (globalThis as unknown as { navigator?: unknown }).navigator;
  clearRoamQueue();
  enqueueRoam({ deviceId: "dev-1", fingerprint: {} });
  enqueueRoam({ deviceId: "dev-2", fingerprint: {} });
  let call = 0;
  globalThis.fetch = async () => {
    call++;
    if (call === 1) return { ok: true, json: async () => ({}) } as unknown as Response;
    return { ok: false, status: 429, json: async () => ({}) } as unknown as Response;
  };
  setNavigator({ onLine: true });
  await replayRoamQueue();
  const left = getRoamQueue();
  assert.equal(left.length, 1);
  assert.equal(left[0].deviceId, "dev-2");
  assert.equal(call, 2);
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
