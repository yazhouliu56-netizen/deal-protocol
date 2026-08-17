import { test } from "node:test";
import assert from "node:assert/strict";
import {
  detectGpsSpoofing,
  detectTerminalRisk,
  GPS_TELEPORT_SPEED_KMH,
  type GpsSample,
  type ITerminalContext,
} from "./anti-fraud.ts";

const g = (lat: number, lng: number, timestamp: number, accuracy = 10): GpsSample => ({
  lat,
  lng,
  accuracy,
  timestamp,
});

test("GPS：正常步行/乘车轨迹判定 PASS 零风险", () => {
  // 每小时 60km 巡航（合法车速），逐点 10 分钟一帧
  const samples: GpsSample[] = [
    g(30.0, 120.0, 1000),
    // 60km/h × 600s = 10km ≈ 0.0898 纬度位移
    g(30.0898, 120.0, 601_000),
    g(30.1796, 120.0, 1_201_000),
  ];
  const r = detectGpsSpoofing(samples);
  assert.equal(r.flagged, false);
  assert.equal(r.action, "PASS");
  assert.equal(r.riskScore, 0);
  assert.equal(r.signals.length, 0);
  assert.ok(r.maxSpeedKmh !== null && r.maxSpeedKmh < GPS_TELEPORT_SPEED_KMH);
});

test("GPS：5 秒内位移 50 公里 → TELEPORTATION_DETECTED 并阻断", () => {
  const samples: GpsSample[] = [
    g(30.0, 120.0, 1000),
    g(30.45, 120.45, 6000), // 约 50km+ / 5s ≈ 36000km/h
  ];
  const r = detectGpsSpoofing(samples, 300);
  assert.equal(r.flagged, true);
  assert.equal(r.action, "BLOCK");
  assert.equal(r.riskScore, 1.0);
  assert.ok(r.signals.some((s) => s.signal === "TELEPORTATION_DETECTED" && !s.passed));
  assert.ok(r.maxSpeedKmh !== null && r.maxSpeedKmh > 300);
});

test("GPS：时间倒流（dt ≤ 0）→ TELEPORTATION_DETECTED 阻断", () => {
  const samples: GpsSample[] = [
    g(30.0, 120.0, 5000),
    g(30.1, 120.1, 2000), // 时间回退
  ];
  const r = detectGpsSpoofing(samples);
  assert.equal(r.action, "BLOCK");
  assert.equal(r.riskScore, 1.0);
  assert.ok(r.signals.some((s) => s.signal === "TELEPORTATION_DETECTED"));
  assert.equal(r.maxSpeedKmh, null);
});

test("GPS：定位精度 0 → MOCK_PROVIDER_DETECTED 阻断", () => {
  const samples: GpsSample[] = [
    g(30.0, 120.0, 1000, 0),
    g(30.00075, 120.0, 61_000, 0), // 59s 步行约 84m（≈5km/h，非瞬移）
  ];
  const r = detectGpsSpoofing(samples);
  assert.equal(r.flagged, true);
  assert.equal(r.action, "BLOCK");
  assert.equal(r.riskScore, 0.85);
  assert.ok(r.signals.some((s) => s.signal === "MOCK_PROVIDER_DETECTED" && !s.passed));
});

test("GPS：绝对死值精度（恒定 1m 不变）→ MOCK_PROVIDER_DETECTED", () => {
  const samples: GpsSample[] = [
    g(30.0, 120.0, 1000, 1),
    g(30.001, 120.001, 2000, 1),
    g(30.002, 120.002, 3000, 1),
  ];
  const r = detectGpsSpoofing(samples);
  assert.equal(r.action, "BLOCK");
  assert.ok(r.signals.some((s) => s.signal === "MOCK_PROVIDER_DETECTED"));
});

test("GPS：单样本/空样本不误报（样本不足安全通过）", () => {
  assert.equal(detectGpsSpoofing([]).action, "PASS");
  assert.equal(detectGpsSpoofing([g(30, 120, 1000)]).action, "PASS");
  assert.equal(detectGpsSpoofing([g(30, 120, 1000)]).maxSpeedKmh, null);
});

test("GPS：瞬移 + 模拟器同现 → 最高风险 1.0 阻断", () => {
  const samples: GpsSample[] = [
    g(30.0, 120.0, 1000, 0),
    g(30.5, 120.5, 1500, 0), // 瞬移 + 精度 0
  ];
  const r = detectGpsSpoofing(samples);
  assert.equal(r.action, "BLOCK");
  assert.equal(r.riskScore, 1.0);
  assert.equal(r.signals.length, 2);
});

test("终端：正常桌面浏览器 → PASS 零异常", () => {
  const ctx: ITerminalContext = {
    userAgent: "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 Chrome/126.0 Safari/537.36",
    webdriver: false,
    touchSupport: true,
    platform: "MacIntel",
  };
  const r = detectTerminalRisk(ctx);
  assert.equal(r.isFlagged, false);
  assert.equal(r.action, "PASS");
  assert.equal(r.riskScore, 0);
  assert.deepEqual(r.anomalies, []);
});

test("终端：webdriver + HeadlessChrome → BLOCK（1.0 封顶）", () => {
  const ctx: ITerminalContext = {
    userAgent: "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) HeadlessChrome/126.0 Safari/537.36",
    webdriver: true,
    touchSupport: false,
    platform: "Linux x86_64",
  };
  const r = detectTerminalRisk(ctx);
  assert.equal(r.isFlagged, true);
  assert.equal(r.action, "BLOCK");
  assert.ok(r.anomalies.includes("WEBDRIVER_DETECTED"));
  assert.ok(r.anomalies.includes("HEADLESS_UA_DETECTED"));
  // 0.5 + 0.4 = 0.9，封顶 1.0 内
  assert.ok(r.riskScore >= 0.6 && r.riskScore <= 1);
});

test("终端：Emulator 环境词 → CHALLENGE_LIVENESS（活体验证）", () => {
  const ctx: ITerminalContext = {
    userAgent: "Mozilla/5.0 (iPhone Simulator; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 Mobile",
    webdriver: false,
    touchSupport: true,
    platform: "iPhone Simulator",
  };
  const r = detectTerminalRisk(ctx);
  assert.equal(r.isFlagged, true);
  assert.equal(r.action, "CHALLENGE_LIVENESS");
  assert.ok(r.anomalies.includes("EMULATOR_ENV_DETECTED"));
  assert.equal(r.riskScore, 0.3);
});

test("终端：移动 UA 无触控 + 模拟器 → 加权叠加 CHALLENGE", () => {
  const ctx: ITerminalContext = {
    userAgent: "Mozilla/5.0 (Linux; Android 14) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Mobile Safari/537.36",
    webdriver: false,
    touchSupport: false,
    platform: "Android Emulator",
  };
  const r = detectTerminalRisk(ctx);
  assert.ok(r.anomalies.includes("MOBILE_NO_TOUCH"));
  assert.ok(r.anomalies.includes("EMULATOR_ENV_DETECTED"));
  // 0.25 + 0.3 = 0.55 < 0.6 → CHALLENGE（未达 BLOCK）
  assert.equal(r.action, "CHALLENGE_LIVENESS");
  assert.equal(r.riskScore, 0.55);
});