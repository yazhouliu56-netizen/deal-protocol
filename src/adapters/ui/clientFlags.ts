"use client";
import { useSyncExternalStore } from "react";

/**
 * SSR-safe 的 localStorage 布尔标志（同 readKeys/mapPref 模式）：
 * server 快照恒为 false；subscribe（客户端水合后）时从存储 warm，
 * 首个客户端快照即翻转，无水合不一致 → 避免 React #418 hydration 错误。
 * 用于「已见过提示」类一次性记忆（空态引导 / 语音气泡等）。
 */

function makeFlagHook(key: string) {
  let cached = false;
  const listeners = new Set<() => void>();

  function subscribe(cb: () => void): () => void {
    listeners.add(cb);
    const stored = typeof localStorage !== "undefined" && localStorage.getItem(key) !== null;
    if (stored !== cached) {
      cached = stored;
      queueMicrotask(() => listeners.forEach((l) => l()));
    }
    return () => {
      listeners.delete(cb);
    };
  }

  function getSnapshot(): boolean {
    return cached;
  }

  function getServerSnapshot(): boolean {
    return false;
  }

  function useFlag(): boolean {
    return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
  }

  function markSeen(): void {
    localStorage.setItem(key, "1");
    cached = true;
    listeners.forEach((l) => l());
  }

  return { useFlag, markSeen };
}

export const onboardGuide = makeFlagHook("oto-onboard-dismissed");
export const voiceHint = makeFlagHook("oto-voice-hint-seen");