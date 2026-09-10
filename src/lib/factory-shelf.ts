"use client";

/**
 * 工厂货架（P4-T3 上架持久化）：生成的品类 config 落本地盘，重启可恢复。
 * - 存储：localStorage（无则内存回落，测试/SSR 安全）。
 * - 重启恢复：FactoryShelfBridge 挂载时 registerDynamicAmmo 逐条回池。
 * - 试运行：trial 标＋10 单/天（trial-cap 纯函数），发单侧 PublishSheet 设卡。
 */
import { registerDynamicAmmo } from "@/ammo/factory";
import type { IHolographicAmmoConfig } from "@/types/ammo-schema";
import { canTrialOrder, nextTrialCount, todayStamp, type TrialCounter } from "@/ammo/trial-cap";

const SHELF_KEY = "oto-factory-shelf-v1";

export interface ShelfEntry {
  config: IHolographicAmmoConfig;
  trial: true;
  listedAt: number;
  counter: TrialCounter;
}

const memFallback = new Map<string, ShelfEntry>();

function readRaw(): Record<string, ShelfEntry> {
  try {
    if (typeof localStorage === "undefined") return Object.fromEntries(memFallback);
    const raw = localStorage.getItem(SHELF_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as Record<string, ShelfEntry>;
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
}

function writeRaw(all: Record<string, ShelfEntry>): void {
  try {
    if (typeof localStorage === "undefined") {
      memFallback.clear();
      for (const [k, v] of Object.entries(all)) memFallback.set(k, v);
      return;
    }
    localStorage.setItem(SHELF_KEY, JSON.stringify(all));
  } catch {
    /* 配额满等：上架转瞬时（内存池仍有效），不拦控制台 */
  }
}

/** 上架：config 落盘＋即时入池（内存语义不变）。 */
export function saveToShelf(config: IHolographicAmmoConfig): void {
  const all = readRaw();
  const prev = all[config.category];
  all[config.category] = {
    config,
    trial: true,
    listedAt: prev?.listedAt ?? Date.now(),
    counter: prev?.counter ?? { day: todayStamp(), count: 0 },
  };
  writeRaw(all);
  try {
    registerDynamicAmmo(config);
  } catch {
    /* 入池失败由调用方感知（validate 前置已过，此处极罕见） */
  }
}

export function loadShelf(): ShelfEntry[] {
  return Object.values(readRaw()).sort((a, b) => b.listedAt - a.listedAt);
}

export function isTrialCategory(category: string): boolean {
  return readRaw()[category]?.trial === true;
}

/** 重启恢复：逐条回池（坏条跳过，不拦启动）。 */
export function rehydrateFactoryShelf(): number {
  let ok = 0;
  for (const entry of loadShelf()) {
    try {
      const r = registerDynamicAmmo(entry.config);
      if (r.ok) ok += 1;
    } catch {
      /* 坏条跳过 */
    }
  }
  return ok;
}

export function canPublishTrial(category: string, today = todayStamp()): boolean {
  const entry = readRaw()[category];
  if (!entry?.trial) return true;
  return canTrialOrder(entry.counter, today);
}

export function recordTrialPublish(category: string, today = todayStamp()): void {
  const all = readRaw();
  const entry = all[category];
  if (!entry?.trial) return;
  entry.counter = nextTrialCount(entry.counter, today);
  writeRaw(all);
}

export function trialCountToday(category: string, today = todayStamp()): number {
  const entry = readRaw()[category];
  if (!entry?.trial || entry.counter.day !== today) return 0;
  return entry.counter.count;
}
