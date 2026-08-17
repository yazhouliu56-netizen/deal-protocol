import { test } from "node:test";
import assert from "node:assert/strict";
import {
  AudioChunkBuffer,
  acknowledgeCrisisEscalation,
  advanceCrisisEscalation,
  buildPoliceTrajectoryPayload,
  compressTrail,
  detectTrajectoryAnomaly,
  recordBreadcrumbPoint,
  resolveCrisisEscalation,
  triggerCrisisEscalation,
  type BreadcrumbPoint,
} from "./crisis-tracker.ts";
import { sha256Hex } from "../ai/forgery.ts";

const p = (lat: number, lng: number, timestamp: number, accuracy = 10): BreadcrumbPoint => ({
  lat,
  lng,
  accuracy,
  timestamp,
});

test("轨迹面包屑：记录 + 最近 N 处裁剪（FIFO 逐出）", () => {
  const pts = [
    p(30.1, 120.1, 1000),
    p(30.2, 120.2, 2000),
    p(30.3, 120.3, 3000),
  ];
  const r1 = recordBreadcrumbPoint(pts, p(30.4, 120.4, 4000), 3);
  assert.equal(r1.dropped, 1);
  assert.deepEqual(r1.points.map((x) => x.timestamp), [2000, 3000, 4000]);
  const r2 = recordBreadcrumbPoint(r1.points, p(30.5, 120.5, 5000), 3);
  assert.equal(r2.dropped, 1);
  assert.deepEqual(r2.points.map((x) => x.timestamp), [3000, 4000, 5000]);
});

test("轨迹面包屑：非法坐标（非有限数）直接拒绝不污染缓冲", () => {
  const r = recordBreadcrumbPoint([], p(Number.NaN, 120, 1000), 8);
  assert.equal(r.dropped, 1);
  assert.equal(r.points.length, 0);
});

test("轨迹异常：120km/h 超速阈值边界（恰低于不告警、恰高于告警）", () => {
  // 60s 内向北位移 1.9833km ≈ 119.0 km/h（低于阈值）
  const slow = detectTrajectoryAnomaly([p(30.0, 120.0, 1000), p(30.01783, 120.0, 61000)], 120);
  assert.equal(slow.anomaly, false);
  assert.ok(slow.speedKmh !== null && slow.speedKmh < 120);
  // 60s 内向北位移 2.0167km ≈ 121.0 km/h（触发超速漂移预警）
  const fast = detectTrajectoryAnomaly([p(30.0, 120.0, 1000), p(30.01813, 120.0, 61000)], 120);
  assert.equal(fast.anomaly, true);
  assert.equal(fast.reason, "SPEED_OVER_LIMIT");
  assert.ok(fast.speedKmh !== null && fast.speedKmh >= 120);
});

test("轨迹异常：样本不足 / 时间戳单调性失效时不告警", () => {
  assert.deepEqual(detectTrajectoryAnomaly([p(30, 120, 1000)]), {
    anomaly: false,
    speedKmh: null,
    reason: "INSUFFICIENT_SAMPLES",
  });
  const stale = detectTrajectoryAnomaly([p(30, 120, 2000), p(30.1, 120.1, 1000)]);
  assert.equal(stale.anomaly, false);
  assert.equal(stale.reason, "STALE_TIMESTAMP");
  assert.equal(stale.speedKmh, null);
});

test("警方轨迹导出：压缩 trail + 末点 + 异常标记（确定性载荷）", () => {
  const pts = [p(30.1, 120.1, 1000, 8), p(30.2, 120.2, 2000, 6)];
  const payload = buildPoliceTrajectoryPayload(pts, {
    crisisId: "crisis-abc",
    userId: "u1",
    generatedAt: 2000,
  });
  assert.equal(payload.crisisId, "crisis-abc");
  assert.equal(payload.userId, "u1");
  assert.equal(payload.pointCount, 2);
  assert.deepEqual(payload.lastPoint, pts[1]);
  assert.equal(payload.trail, compressTrail(pts));
  assert.ok(payload.trail.includes("30.200000,120.200000,6,2000"));
  // 同输入同输出
  assert.deepEqual(
    buildPoliceTrajectoryPayload(pts, { crisisId: "crisis-abc", userId: "u1", generatedAt: 2000 }),
    payload
  );
});

test("音频缓冲池：入池 + 超限 FIFO 逐出（条数上限）", () => {
  const buf = new AudioChunkBuffer(2, 1_000_000);
  const c1 = "b64-1";
  const r1 = buf.pushAudioChunk({
    waveId: "w1",
    durationSec: 10,
    sha256: sha256Hex(c1),
    encryptedBase64: c1,
    recordedAt: 1000,
  });
  assert.equal(buf.count(), 1);
  buf.pushAudioChunk({
    waveId: "w1",
    durationSec: 10,
    sha256: sha256Hex("b64-2"),
    encryptedBase64: "b64-2",
    recordedAt: 2000,
  });
  const r3 = buf.pushAudioChunk({
    waveId: "w1",
    durationSec: 10,
    sha256: sha256Hex("b64-3"),
    encryptedBase64: "b64-3",
    recordedAt: 3000,
  });
  assert.equal(r3.dropped.length, 1);
  assert.equal(r3.dropped[0].recordedAt, 1000);
  assert.equal(buf.count(), 2);
  assert.equal(r1.buffer.length, 1);
});

test("音频缓冲池：总字节上限逐出 + drain 清空", () => {
  const buf = new AudioChunkBuffer(100, 20);
  buf.pushAudioChunk({ waveId: "w", durationSec: 1, sha256: "x", encryptedBase64: "aaaa", recordedAt: 1000 });
  buf.pushAudioChunk({ waveId: "w", durationSec: 1, sha256: "x", encryptedBase64: "bbbbbbbbbbbbbbbbb", recordedAt: 2000 });
  assert.equal(buf.count(), 1);
  assert.equal(buf.totalBytes(), 17);
  const drained = buf.drainAudioChunks();
  assert.equal(drained.length, 1);
  assert.equal(buf.isEmpty(), true);
});

test("音频缓冲池：SHA-256 完整性校验（篡改 chunk 即失败）", () => {
  const buf = new AudioChunkBuffer();
  buf.pushAudioChunk({ waveId: "w", durationSec: 5, sha256: sha256Hex("good"), encryptedBase64: "good", recordedAt: 1000, chunkId: "chunk-1" });
  buf.pushAudioChunk({ waveId: "w", durationSec: 5, sha256: sha256Hex("good2"), encryptedBase64: "good2", recordedAt: 2000, chunkId: "chunk-2" });
  let v = buf.verifyAudioIntegrity();
  assert.equal(v.ok, true);
  assert.deepEqual(v.failedChunkIds, []);
  assert.equal(v.verified, 2);
  // 篡改既有指纹对照的载荷 → 完整性失败
  buf.drainAudioChunks();
  buf.pushAudioChunk({ waveId: "w", durationSec: 5, sha256: sha256Hex("good"), encryptedBase64: "good-TAMPERED", recordedAt: 3000, chunkId: "chunk-1" });
  v = buf.verifyAudioIntegrity();
  assert.equal(v.ok, false);
  assert.deepEqual(v.failedChunkIds, ["chunk-1"]);
});

test("升级状态机：触发 0s → TRIGGERED + 全量 EPA 通知", () => {
  const step = triggerCrisisEscalation("crisis-1", 1000, 3);
  assert.equal(step.state.phase, "TRIGGERED");
  assert.equal(step.changed, true);
  assert.deepEqual(step.notification?.to, ["紧急联系人", "平台值班", "警方通道"]);
  assert.equal(step.notification?.reason, "TRIGGERED");
  // 级别 2 不触警方通道
  const lv2 = triggerCrisisEscalation("crisis-2", 1000, 2);
  assert.deepEqual(lv2.notification?.to, ["紧急联系人", "平台值班"]);
});

test("升级状态机：≤30s 确认 → ACKNOWLEDGED（窗口内正常 + 幂等）", () => {
  let { state } = triggerCrisisEscalation("crisis-1", 1000, 3);
  const ack = acknowledgeCrisisEscalation(state, 1000 + 10_000);
  assert.equal(ack.changed, true);
  assert.equal(ack.state.phase, "ACKNOWLEDGED");
  assert.equal(ack.state.acknowledgedAt, 11_000);
  assert.equal(ack.notification?.reason, "USER_ACKNOWLEDGED");
  const again = acknowledgeCrisisEscalation(ack.state, 20_000);
  assert.equal(again.changed, false);
  assert.equal(again.notification, null);
});

test("升级状态机：30s 后确认记 breach（超窗不阻断）", () => {
  let { state } = triggerCrisisEscalation("crisis-1", 1000, 3);
  const ack = acknowledgeCrisisEscalation(state, 1000 + 45_000);
  assert.equal(ack.state.phase, "ACKNOWLEDGED");
  assert.equal(ack.notification?.reason, "USER_ACKNOWLEDGED_LATE");
});

test("升级状态机：≥60s 未确认 → POLICE_ESCALATED 强升级（60s 边界）", () => {
  let { state } = triggerCrisisEscalation("crisis-1", 1000, 3);
  const t59 = advanceCrisisEscalation(state, 1000 + 59_000);
  assert.equal(t59.changed, false);
  assert.equal(t59.state.phase, "TRIGGERED");
  const t60 = advanceCrisisEscalation(t59.state, 1000 + 60_000);
  assert.equal(t60.changed, true);
  assert.equal(t60.state.phase, "POLICE_ESCALATED");
  assert.equal(t60.state.policeEscalatedAt, 61_000);
  assert.deepEqual(t60.notification?.to, ["警方通道"]);
  assert.equal(t60.notification?.reason, "UNCONFIRMED_60S_FORCE_ESCALATION");
  const t120 = advanceCrisisEscalation(t60.state, 1000 + 120_000);
  assert.equal(t120.changed, false);
  assert.equal(t120.state.phase, "POLICE_ESCALATED");
});

test("升级状态机：已确认后不再强升级；处置闭环 → RESOLVED（幂等）", () => {
  let { state } = triggerCrisisEscalation("crisis-1", 1000, 2);
  const ack = acknowledgeCrisisEscalation(state, 1000 + 15_000);
  const later = advanceCrisisEscalation(ack.state, 1000 + 120_000);
  assert.equal(later.changed, false);
  assert.equal(later.state.phase, "ACKNOWLEDGED");
  const done = resolveCrisisEscalation(later.state, 1000 + 130_000);
  assert.equal(done.changed, true);
  assert.equal(done.state.phase, "RESOLVED");
  assert.equal(done.state.resolvedAt, 131_000);
  assert.equal(done.notification?.reason, "CRISIS_RESOLVED");
  const again = resolveCrisisEscalation(done.state, 150_000);
  assert.equal(again.changed, false);
});