import { test } from "node:test";
import assert from "node:assert/strict";
import { listDevices, postHeartbeat, syncDevice } from "./roam-sync.ts";

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
      // @ts-ignore
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
  // @ts-ignore
  globalThis.fetch = async () => {
    throw new Error("network down");
  };
  setNavigator({ onLine: true });
  const r = await syncDevice({ deviceId: "dev-x" });
  assert.equal(r.ok, false);
  assert.equal(r.fallback, true);
  // @ts-ignore
  globalThis.fetch = origFetch;
  restoreNavigator(origNav);
});

test("roam-sync: postHeartbeat 复用 syncDevice", async () => {
  const origFetch = globalThis.fetch;
  const origNav = (globalThis as unknown as { navigator?: unknown }).navigator;
  let called = false;
  // @ts-ignore
  globalThis.fetch = async () => {
    called = true;
    return { ok: true, json: async () => ({ devices: [] }) } as unknown as Response;
  };
  setNavigator({ onLine: true });
  const r = await postHeartbeat("dev-hb");
  assert.equal(called, true);
  assert.equal(r.ok, true);
  // @ts-ignore
  globalThis.fetch = origFetch;
  restoreNavigator(origNav);
});

test("roam-sync: listDevices 成功解析 devices", async () => {
  const origFetch = globalThis.fetch;
  const origNav = (globalThis as unknown as { navigator?: unknown }).navigator;
  // @ts-ignore
  globalThis.fetch = async () =>
    ({ ok: true, json: async () => ({ devices: [{ device_id: "d1" }] }) } as unknown as Response);
  setNavigator({ onLine: true });
  const r = await listDevices();
  assert.equal(r.ok, true);
  if (r.ok) assert.equal(r.devices.length, 1);
  // @ts-ignore
  globalThis.fetch = origFetch;
  restoreNavigator(origNav);
});
