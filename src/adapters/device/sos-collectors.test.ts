import { test } from "node:test";
import assert from "node:assert/strict";
import {
  isGeoTracking,
  pushGeoPoint,
  resetGeoTrackerForTest,
  snapshotGeoTrail,
  startGeoTracker,
  stopGeoTracker,
} from "./geo-tracker";
import {
  drainAudioVault,
  isAudioRecording,
  resetAudioVaultForTest,
  startAudioVault,
  stopAudioVault,
} from "./audio-recorder";

test("geo-tracker：引信开关关闭时拒绝启动（条文 #5 弹药表驱动）", () => {
  resetGeoTrackerForTest();
  assert.equal(startGeoTracker(false), false);
  assert.equal(isGeoTracking(), false);
});

test("geo-tracker：无 geolocation 环境（Node/Headless）静默降级返回 false", () => {
  resetGeoTrackerForTest();
  assert.equal(startGeoTracker(true), false);
  assert.deepEqual(snapshotGeoTrail(), []);
});

test("geo-tracker：pushGeoPoint 累积合法点、拒非法坐标，FIFO 裁剪至 64 点", () => {
  resetGeoTrackerForTest();
  pushGeoPoint({ lat: Number.NaN, lng: 120, accuracy: 10, timestamp: 1 });
  assert.equal(snapshotGeoTrail().length, 0);
  for (let i = 0; i < 70; i++) {
    pushGeoPoint({ lat: 30 + i * 0.0001, lng: 120, accuracy: 10, timestamp: 1000 + i });
  }
  const trail = snapshotGeoTrail();
  assert.equal(trail.length, 64);
  assert.equal(trail[trail.length - 1].timestamp, 1069);
  stopGeoTracker();
  resetGeoTrackerForTest();
});

test("audio-recorder：无 window/MediaRecorder 环境（Node）静默降级 false + 空缓冲", async () => {
  resetAudioVaultForTest();
  assert.equal(await startAudioVault("w1", true), false);
  assert.equal(await startAudioVault("w1", false), false);
  assert.equal(isAudioRecording(), false);
  assert.deepEqual(drainAudioVault(), []);
  stopAudioVault();
});
