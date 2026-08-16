"use client";

import { useSyncExternalStore } from "react";

/**
 * P2：边缘手势互斥锁（全局单例，SSR 安全）。
 *
 * 全屏/半屏弹层（拍照存证、扫码、心愿单、目的地中心、A2HS 引导卡）打开期间
 * 锁定屏幕左边缘滑动返回，防止手势打架（P2 手势无冲突保证）。
 * 模块级单例 + useSyncExternalStore：子组件锁定、根组件订阅，跨层免 prop 钻取。
 */

let edgeGestureLocked = false;
const edgeGestureLockListeners = new Set<() => void>();

/** 外部弹层锁定入口（子组件在弹层 open/close 时调用）。 */
export function lockEdgeGesture(locked: boolean): void {
  if (edgeGestureLocked === locked) return;
  edgeGestureLocked = locked;
  for (const fn of edgeGestureLockListeners) fn();
}

/** 订阅当前全局互斥锁状态（根组件使用，驱动 useEdgeSwipeBack.enabled）。 */
export function useEdgeGestureLock(): boolean {
  return useSyncExternalStore(
    (onChange) => {
      edgeGestureLockListeners.add(onChange);
      return () => {
        edgeGestureLockListeners.delete(onChange);
      };
    },
    () => edgeGestureLocked,
    () => edgeGestureLocked,
  );
}

/** 测试/工具：读取当前锁状态（不订阅）。 */
export function readEdgeGestureLock(): boolean {
  return edgeGestureLocked;
}

/** 测试/工具：重置单例（仅在测试环境使用）。 */
export function resetEdgeGestureLock(): void {
  edgeGestureLocked = false;
  for (const fn of edgeGestureLockListeners) fn();
}
