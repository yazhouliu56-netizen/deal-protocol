"use client";

/**
 * 发现推荐画像持久化（B4 · localStorage＋内存回落，factory-shelf 同配方）。
 * 画像＝行为计数（订单＋胶囊点击）＋推荐开关；先天属性默认不进
 *（冷启动先验如需启用，由调用方显式传入，不在此落盘）。
 */
import type { DiscoveryProfile } from "@/base/growth/discovery";
import { EMPTY_PROFILE } from "@/base/growth/discovery";

const PROFILE_KEY = "oto-discovery-v1";

const memFallback: { profile: DiscoveryProfile } = {
  profile: { ...EMPTY_PROFILE, orderCounts: {}, pillClicks: {} },
};

function readRaw(): DiscoveryProfile {
  try {
    if (typeof localStorage === "undefined") return memFallback.profile;
    const raw = localStorage.getItem(PROFILE_KEY);
    if (!raw) return { ...EMPTY_PROFILE, orderCounts: {}, pillClicks: {} };
    const parsed = JSON.parse(raw) as Partial<DiscoveryProfile>;
    return {
      orderCounts: parsed.orderCounts ?? {},
      pillClicks: parsed.pillClicks ?? {},
      optOut: parsed.optOut ?? false,
    };
  } catch {
    return { ...EMPTY_PROFILE, orderCounts: {}, pillClicks: {} };
  }
}

function writeRaw(profile: DiscoveryProfile): void {
  memFallback.profile = profile;
  try {
    if (typeof localStorage === "undefined") return;
    localStorage.setItem(PROFILE_KEY, JSON.stringify(profile));
  } catch {
    /* 配额满：内存语义继续，不拦首页 */
  }
}

export function loadDiscoveryProfile(): DiscoveryProfile {
  return readRaw();
}

/** 胶囊点击即兴趣信号（发现推荐本就是兴趣匹配）。返回更新后画像。 */
export function recordPillClick(category: string): DiscoveryProfile {
  const p = readRaw();
  const next: DiscoveryProfile = {
    ...p,
    pillClicks: { ...p.pillClicks, [category]: (p.pillClicks[category] ?? 0) + 1 },
  };
  writeRaw(next);
  return next;
}

/** 订单完成回路调用（复购真值；接线预留，订单完成页调用）。 */
export function recordDiscoveryOrder(category: string): DiscoveryProfile {
  const p = readRaw();
  const next: DiscoveryProfile = {
    ...p,
    orderCounts: { ...p.orderCounts, [category]: (p.orderCounts[category] ?? 0) + 1 },
  };
  writeRaw(next);
  return next;
}

/** 推荐开关（默认开；关＝永远图纸序）。 */
export function setDiscoveryOptOut(optOut: boolean): DiscoveryProfile {
  const next: DiscoveryProfile = { ...readRaw(), optOut };
  writeRaw(next);
  return next;
}
