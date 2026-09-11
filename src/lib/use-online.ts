"use client";

import { useSyncExternalStore } from "react";
import { syncBus } from "@/adapters/platform/sync-bus";

const subscribe = (cb: () => void) =>
  syncBus.subscribeOnlineStatus(() => cb());
const getSnapshot = () => syncBus.getOnlineStatus();
const getServerSnapshot = () => true;

/**
 * 在线状态（OnlineStatusBridge 同构：SSR/首帧恒在线 + 挂载后总线同步）。
 * render 期直读 navigator.onLine 会 hydration #418，一律走本 Hook。
 */
export function useOnline(): boolean {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}
