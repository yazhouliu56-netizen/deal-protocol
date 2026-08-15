"use client";

import { useEffect, useRef, useState } from "react";

/**
 * 弱网离线事务指示器（Offline Queue Indicator · 白皮书 §五 5.8.1）。
 *
 * 宪法 #10（降级是设计的一部分）+ 红线 4（本地加密队列语义）：
 * - isOffline === true：半透明琥珀色提示条（暂存 X 笔操作在本地加密队列）；
 * - isOffline 由 true→false：绿色动态 Toast（X 笔数据已自动追回同步，X = 恢复前暂存笔数），
 *   3 秒后自动消失。
 */

export interface OfflineQueueIndicatorProps {
  /** 当前弱网/断网状态。 */
  isOffline: boolean;
  /** 本地加密队列暂存笔数（离线时展示；恢复时作为追回数量播报）。 */
  pendingCount: number;
}

/** 追回 Toast 自动消失时长（ms）。 */
export const TOAST_DURATION_MS = 3000;

const QUEUE_CSS = `
.oq-root{font-size:13px}
.oq-banner{display:flex;align-items:center;gap:8px;padding:10px 14px;border-radius:12px;
  background:rgba(251,191,36,.16);border:1px solid rgba(251,191,36,.45);color:#fbbf24;
  backdrop-filter:blur(12px)}
.oq-toast{display:flex;align-items:center;gap:8px;padding:10px 14px;border-radius:12px;
  background:rgba(74,222,128,.18);border:1px solid rgba(74,222,128,.5);color:#4ade80;
  animation:oq-slide 0.35s ease-out}
@keyframes oq-slide{from{opacity:0;transform:translateY(-6px)}to{opacity:1;transform:none}}
`;

/** 弱网离线提示条 + 网络恢复自动追回 Toast。 */
export default function OfflineQueueIndicator({
  isOffline,
  pendingCount,
}: OfflineQueueIndicatorProps) {
  const [toast, setToast] = useState<string | null>(null);
  const prevOffline = useRef(isOffline);
  const prevPending = useRef(pendingCount);

  useEffect(() => {
    const wasOffline = prevOffline.current;
    const wasPending = prevPending.current;
    prevOffline.current = isOffline;
    prevPending.current = pendingCount;

    if (wasOffline && !isOffline) {
      // 网络恢复：以恢复前暂存笔数播报追回数量
      setToast(`✅ 网络已恢复：${wasPending} 笔数据已自动追回同步`);
      const timer = setTimeout(() => setToast(null), TOAST_DURATION_MS);
      return () => clearTimeout(timer);
    }
    return undefined;
  }, [isOffline, pendingCount]);

  return (
    <div className="oq-root" data-testid="offline-indicator">
      <style>{QUEUE_CSS}</style>
      {isOffline && (
        <div className="oq-banner" role="status" data-state="offline">
          ⚠️ 离线模式：已暂存 <strong>{pendingCount}</strong> 笔操作在本地加密队列
        </div>
      )}
      {!isOffline && toast && (
        <div className="oq-toast" role="status" data-state="recovered">
          {toast}
        </div>
      )}
    </div>
  );
}
