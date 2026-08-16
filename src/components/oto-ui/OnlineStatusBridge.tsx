"use client";

import { useEffect, useState } from "react";
import OfflineQueueIndicator from "./OfflineQueueIndicator";
import { useWaveStore } from "@/store/useWaveStore";

/**
 * W6 总装：全局弱网离线桥（layout 层挂载）。
 *
 * 接入浏览器原生 `navigator.onLine` 与 `online`/`offline` 事件：
 * - 断网 → 琥珀提示条（本地加密队列暂存笔数，取 store.offlineQueue）；
 * - 联网 → 绿色追回 Toast（宪法 #10：降级是设计的一部分）。
 */

export default function OnlineStatusBridge() {
  // SSR 首帧统一按「在线」渲染：Node 22 全局存在 navigator 对象且
  // navigator.onLine 为 undefined（!undefined === true），若在状态初始化
  // 时读取会导致服务端渲染出「离线」琥珀条而客户端不渲染 → Hydration
  // mismatch。网络真实状态由挂载后的 useEffect 接管（见下）。
  const [online, setOnline] = useState<boolean>(true);
  const pendingOps = useWaveStore((s) => s.offlineQueue.length);

  useEffect(() => {
    setOnline(typeof window !== "undefined" && navigator.onLine);
    const on = () => setOnline(true);
    const off = () => setOnline(false);
    window.addEventListener("online", on);
    window.addEventListener("offline", off);
    return () => {
      window.removeEventListener("online", on);
      window.removeEventListener("offline", off);
    };
  }, []);

  return (
    <div className="fixed top-2 left-1/2 -translate-x-1/2 z-50 w-full max-w-md px-4 pointer-events-none">
      <OfflineQueueIndicator isOffline={!online} pendingCount={pendingOps} />
    </div>
  );
}
