/**
 * L4-M2 终端反欺诈与时空防作弊引擎（P2 战役第二波攻坚，2026-08-17）。
 * 两大探针：
 *  ① detectGpsSpoofing：GPS 瞬移/时空穿梭检测——历史轨迹点序列瞬时速度（Haversine
 *     ≥ 300km/h）或时间倒流（dt ≤ 0）→ TELEPORTATION_DETECTED；定位精度 0 或
 *     绝对死值（模拟器特征）→ MOCK_PROVIDER_DETECTED。
 *  ② detectTerminalRisk：Headless/模拟器环境风险探针——webdriver 标志、Headless UA、
 *     Emulator/Simulator 环境词、移动 UA 缺触控支持，确定性加权输出 riskScore(0~1)
 *     与处置建议 PASS / CHALLENGE_LIVENESS / BLOCK。
 * 红线 1：纯确定性纯函数，时间戳全部入参，零概率分支；红线 3：base/risk 纯函数引擎，
 * 零 React / UI Store 反向依赖。
 */

import { distanceKm } from "../geo/geo.ts";

/* ═══════════════ ① GPS 瞬移与时空穿梭检测 ═══════════════ */

export interface GpsSample {
  lat: number;
  lng: number;
  /** 定位精度（米；0 = 模拟器死值特征）。 */
  accuracy: number;
  /** 采样时间戳（ms）。 */
  timestamp: number;
}

export type GpsSpoofSignalName = "TELEPORTATION_DETECTED" | "MOCK_PROVIDER_DETECTED";

export interface IGpsSpoofSignal {
  signal: GpsSpoofSignalName;
  /** false = 命中疑点。 */
  passed: boolean;
  detail: string;
}

export type FraudAction = "PASS" | "CHALLENGE_LIVENESS" | "BLOCK";

export interface IGpsSpoofReport {
  /** 是否命中任一防伪信号。 */
  flagged: boolean;
  signals: IGpsSpoofSignal[];
  /** 轨迹中最大瞬时速度（km/h；样本不足为 null）。 */
  maxSpeedKmh: number | null;
  /** 0.0 ~ 1.0 风险分。 */
  riskScore: number;
  action: FraudAction;
  detail: string;
}

/** 瞬移速度阈值：> 300km/h 即判时空穿梭（覆盖高铁/飞机 120-300 合法上限）。 */
export const GPS_TELEPORT_SPEED_KMH = 300;

/** 模拟器死值判定：精度完全相同且 ≤ 2m（真实 GPS 精度不可能恒定）。 */
const MOCK_DEAD_ACCURACY_M = 2;
const KMH = 3600;

function isFiniteSample(s: GpsSample): boolean {
  return (
    Number.isFinite(s.lat) &&
    Number.isFinite(s.lng) &&
    Number.isFinite(s.accuracy) &&
    Number.isFinite(s.timestamp)
  );
}

/**
 * GPS 瞬移/时空防作弊判定（纯确定性）：
 *  - 相邻采样点瞬时速度 > 300km/h → TELEPORTATION_DETECTED；
 *  - 时间倒流（dt ≤ 0）→ TELEPORTATION_DETECTED；
 *  - 定位精度 === 0，或全部样本精度呈绝对死值（恒定且 ≤ 2m）→ MOCK_PROVIDER_DETECTED；
 *  - 命中瞬移或倒流 → BLOCK（riskScore 1.0）；命中模拟器定位 → BLOCK（0.85）；
 *  - 全净 → PASS。
 */
export function detectGpsSpoofing(
  samples: GpsSample[],
  teleportSpeedKmh = GPS_TELEPORT_SPEED_KMH
): IGpsSpoofReport {
  const signals: IGpsSpoofSignal[] = [];
  let maxSpeedKmh: number | null = null;
  let teleport = false;
  let timeReversal = false;

  if (samples.length >= 2) {
    for (let i = 1; i < samples.length; i++) {
      const prev = samples[i - 1];
      const cur = samples[i];
      if (!isFiniteSample(prev) || !isFiniteSample(cur)) continue;
      const dtMs = cur.timestamp - prev.timestamp;
      if (dtMs <= 0) {
        timeReversal = true;
        continue;
      }
      const distKm = distanceKm(
        { lat: prev.lat, lng: prev.lng },
        { lat: cur.lat, lng: cur.lng }
      );
      const speedKmh = (distKm / (dtMs / 1000)) * KMH;
      maxSpeedKmh = maxSpeedKmh === null ? speedKmh : Math.max(maxSpeedKmh, speedKmh);
      if (speedKmh > teleportSpeedKmh) teleport = true;
    }
  }

  if (timeReversal) {
    signals.push({
      signal: "TELEPORTATION_DETECTED",
      passed: false,
      detail: "时间倒流：采样时间戳非单调递增（dt ≤ 0），疑似篡改轨迹",
    });
  }
  if (teleport) {
    signals.push({
      signal: "TELEPORTATION_DETECTED",
      passed: false,
      detail:
        maxSpeedKmh === null
          ? "瞬时速度超限"
          : `瞬时速度 ${maxSpeedKmh.toFixed(1)}km/h > ${teleportSpeedKmh}km/h，判定时空穿梭`,
    });
  }

  const mock = detectMockProvider(samples);
  if (mock) {
    signals.push({
      signal: "MOCK_PROVIDER_DETECTED",
      passed: false,
      detail: "定位精度 0 或绝对死值（模拟器特征）",
    });
  }

  const teleportHit = teleport || timeReversal;
  const riskScore = teleportHit ? 1.0 : mock ? 0.85 : 0;
  return {
    flagged: signals.length > 0,
    signals,
    maxSpeedKmh,
    riskScore,
    action: teleportHit || mock ? "BLOCK" : "PASS",
    detail:
      signals.length === 0
        ? "轨迹正常：无瞬移/倒流/模拟器特征"
        : signals.map((s) => s.signal).join("、"),
  };
}

function detectMockProvider(samples: GpsSample[]): boolean {
  const valid = samples.filter(isFiniteSample);
  if (valid.length === 0) return false;
  if (valid.some((s) => s.accuracy === 0)) return true;
  if (valid.length >= 2) {
    const acc0 = valid[0].accuracy;
    if (acc0 <= MOCK_DEAD_ACCURACY_M && valid.every((s) => s.accuracy === acc0)) {
      return true;
    }
  }
  return false;
}

/* ═══════════════ ② 终端模拟器与环境风险探针 ═══════════════ */

export interface ITerminalContext {
  /** 浏览器 UA 字符串（由采集方注入）。 */
  userAgent: string;
  /** webdriver 自动化/Headless 标志（由采集方注入）。 */
  webdriver: boolean;
  /** 触控支持探针结果（由采集方注入）。 */
  touchSupport: boolean;
  /** 平台标识（由采集方注入）。 */
  platform: string;
}

export interface ITerminalRiskReport {
  /** 0.0 ~ 1.0 风险分（确定性加权累加，封顶 1.0）。 */
  riskScore: number;
  /** 是否命中任一环境异常。 */
  isFlagged: boolean;
  /** 命中异常标签（WEBDRIVER_DETECTED / HEADLESS_UA_DETECTED / EMULATOR_ENV_DETECTED / MOBILE_NO_TOUCH）。 */
  anomalies: string[];
  action: FraudAction;
  detail: string;
}

/** 环境信号权重表（确定性常数，可单测锁定）。 */
export const TERMINAL_SIGNAL_WEIGHTS = {
  WEBDRIVER_DETECTED: 0.5,
  HEADLESS_UA_DETECTED: 0.4,
  EMULATOR_ENV_DETECTED: 0.3,
  MOBILE_NO_TOUCH: 0.25,
} as const;

export const TERMINAL_BLOCK_SCORE = 0.6;
export const TERMINAL_CHALLENGE_SCORE = 0.3;

/**
 * 终端模拟器/Headless 环境风险探针（纯确定性）：
 *  - webdriver=true → WEBDRIVER_DETECTED（+0.5）；
 *  - UA 含 HeadlessChrome/PhantomJS → HEADLESS_UA_DETECTED（+0.4）；
 *  - UA 或 platform 含 Emulator/Simulator → EMULATOR_ENV_DETECTED（+0.3）；
 *  - 移动 UA 但无触控支持 → MOBILE_NO_TOUCH（+0.25）；
 *  - riskScore = min(1, Σ)。≥0.6 → BLOCK；≥0.3 → CHALLENGE_LIVENESS；否则 PASS。
 */
export function detectTerminalRisk(ctx: ITerminalContext): ITerminalRiskReport {
  const anomalies: string[] = [];
  let score = 0;

  const ua = ctx.userAgent.toLowerCase();
  const platform = ctx.platform.toLowerCase();

  if (ctx.webdriver) {
    anomalies.push("WEBDRIVER_DETECTED");
    score += TERMINAL_SIGNAL_WEIGHTS.WEBDRIVER_DETECTED;
  }
  if (/headlesschrome|phantomjs|headless/.test(ua)) {
    anomalies.push("HEADLESS_UA_DETECTED");
    score += TERMINAL_SIGNAL_WEIGHTS.HEADLESS_UA_DETECTED;
  }
  if (/emulator|simulator/.test(ua) || /emulator|simulator/.test(platform)) {
    anomalies.push("EMULATOR_ENV_DETECTED");
    score += TERMINAL_SIGNAL_WEIGHTS.EMULATOR_ENV_DETECTED;
  }
  if (!ctx.touchSupport && /iphone|android|mobile/.test(ua)) {
    anomalies.push("MOBILE_NO_TOUCH");
    score += TERMINAL_SIGNAL_WEIGHTS.MOBILE_NO_TOUCH;
  }

  const riskScore = Math.min(1, score);
  const action: FraudAction =
    riskScore >= TERMINAL_BLOCK_SCORE ? "BLOCK" : riskScore >= TERMINAL_CHALLENGE_SCORE ? "CHALLENGE_LIVENESS" : "PASS";

  return {
    riskScore,
    isFlagged: anomalies.length > 0,
    anomalies,
    action,
    detail:
      anomalies.length === 0
        ? "终端环境正常"
        : anomalies.map((a) => `${a}(+${TERMINAL_SIGNAL_WEIGHTS[a as keyof typeof TERMINAL_SIGNAL_WEIGHTS]})`).join("、"),
  };
}