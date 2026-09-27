/**
 * 守望状态机考卷（node:test）：四态＋边界＋电池上下文＋非法输入。
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  evaluateGuardSignal,
  SIGNAL_LOST_AFTER_MS,
  SIGNAL_RECONNECT_WINDOW_MS,
} from "./signal-watchdog.ts";

const NOW = 1_800_000_000_000;

test("窗内抖动＝LIVE（不扰）", () => {
  const r = evaluateGuardSignal({ lastSeenMs: NOW - 60_000, nowMs: NOW, gpsEnabled: true });
  assert.deepEqual(r, { state: "LIVE", reasons: [], notifyPeer: false, escalate: false });
});

test("超复连窗＝DEGRADED（双向可见，不升级）", () => {
  const r = evaluateGuardSignal({
    lastSeenMs: NOW - SIGNAL_RECONNECT_WINDOW_MS - 1000,
    nowMs: NOW,
    gpsEnabled: true,
  });
  assert.equal(r.state, "DEGRADED");
  assert.deepEqual(r.reasons, ["reconnect-window-exceeded"]);
  assert.equal(r.notifyPeer, true);
  assert.equal(r.escalate, false);
});

test("超丢失线＝LOST（升级）", () => {
  const r = evaluateGuardSignal({
    lastSeenMs: NOW - SIGNAL_LOST_AFTER_MS - 1000,
    nowMs: NOW,
    gpsEnabled: null,
  });
  assert.equal(r.state, "LOST");
  assert.deepEqual(r.reasons, ["signal-lost"]);
  assert.equal(r.notifyPeer, true);
  assert.equal(r.escalate, true);
});

test("明确关 GPS＝TAMPER（不等窗口，即时标记）", () => {
  const r = evaluateGuardSignal({ lastSeenMs: NOW, nowMs: NOW, gpsEnabled: false });
  assert.equal(r.state, "TAMPER");
  assert.deepEqual(r.reasons, ["gps-off"]);
  assert.equal(r.notifyPeer, true);
  assert.equal(r.escalate, false);
});

test("从未上报＝DEGRADED；低电量只做上下文不断案", () => {
  const r = evaluateGuardSignal({ lastSeenMs: null, nowMs: NOW, gpsEnabled: null });
  assert.equal(r.state, "DEGRADED");
  assert.deepEqual(r.reasons, ["never-reported"]);
  const r2 = evaluateGuardSignal({
    lastSeenMs: NOW - SIGNAL_LOST_AFTER_MS - 1000,
    nowMs: NOW,
    gpsEnabled: null,
    batteryLow: true,
  });
  assert.equal(r2.state, "LOST");
  assert.deepEqual(r2.reasons, ["signal-lost", "low-battery"]);
  assert.equal(r2.escalate, true);
});

test("边界：恰复连窗算 LIVE，恰丢失线算 DEGRADED", () => {
  assert.equal(
    evaluateGuardSignal({ lastSeenMs: NOW - SIGNAL_RECONNECT_WINDOW_MS, nowMs: NOW, gpsEnabled: true }).state,
    "LIVE",
  );
  assert.equal(
    evaluateGuardSignal({ lastSeenMs: NOW - SIGNAL_LOST_AFTER_MS, nowMs: NOW, gpsEnabled: true }).state,
    "DEGRADED",
  );
});
