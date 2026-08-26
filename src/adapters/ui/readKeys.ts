"use client";
import { useSyncExternalStore } from "react";
import { loadReadSet, persistReadSet } from "@/adapters/notify/notify";

/**
 * 通知已读集合（kind:key）— localStorage 持久化，跨会话。
 * SSR-safe（同 mapPref 模式）：server 快照恒为空集；subscribe（客户端
 * 水合后调用）时从存储 warm，首个客户端快照即翻转为持久值，无水合不一致。
 */
let cached: Set<string> = new Set();
const listeners = new Set<() => void>();
/** server 快照恒为空集；固定引用避免 React #418「getServerSnapshot 未缓存」warning */
const EMPTY = new Set<string>();

function subscribe(cb: () => void): () => void {
  listeners.add(cb);
  const stored = loadReadSet();
  if (stored.size !== cached.size) {
    cached = stored;
    queueMicrotask(() => listeners.forEach((l) => l()));
  }
  return () => {
    listeners.delete(cb);
  };
}

function getSnapshot(): Set<string> {
  return cached;
}

function getServerSnapshot(): Set<string> {
  return EMPTY;
}

export function useReadKeys(): Set<string> {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}

/** 打开通知即全量标记已读并持久化。 */
export function markAllRead(keys: Set<string>): void {
  cached = keys;
  persistReadSet(keys);
  listeners.forEach((l) => l());
}