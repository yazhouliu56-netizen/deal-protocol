"use client";

import { useEffect, useState, useSyncExternalStore } from "react";

const noopSubscribe = () => () => {};

/**
 * React #418 水合缺陷根治范式（page.tsx:443 同款 idiom 收敛为共享 Hook）：
 * 渲染期时钟采样 → useSyncExternalStore 挂载探针。
 * 首帧 now=0 两端同构（SSR 与客户端 hydration 输出一致），挂载后立即采样
 * 恢复真实倒计时；render 期零 Date.now()（红线 1 UI 化）。
 *
 * @param refreshIntervalMs 可选周期刷新（如 30_000 会话倒计时 / 60_000 好友 TTL）；
 *                          缺省或 ≤0 时仅挂载后采样一次（原单次采样语义）。
 */
export function useMountedNow(refreshIntervalMs?: number): number {
  const mounted = useSyncExternalStore(
    noopSubscribe,
    () => true,
    () => false
  );
  const [now, setNow] = useState(0);

  useEffect(() => {
    if (!mounted) return;
    const tick = () => setNow(Date.now());
    const firstSample = window.setTimeout(tick, 0);
    const interval =
      refreshIntervalMs && refreshIntervalMs > 0
        ? window.setInterval(tick, refreshIntervalMs)
        : undefined;
    return () => {
      window.clearTimeout(firstSample);
      if (interval !== undefined) window.clearInterval(interval);
    };
  }, [mounted, refreshIntervalMs]);

  return now;
}
