"use client";
import { useEffect, useState, useSyncExternalStore } from "react";

/**
 * 通用订单卡片纯展示壳（0 业务分支 · 宪法 #1 前端视口解耦）。
 * 仅承载毛玻璃容器、五态徽标、useMountedNow 水合保护与折叠骨架，
 * 特化交互 100% 由 children 注入，卡片内部 0 if(role) 分支。
 */
export interface GenericOrderCardProps {
  waveId: string;
  children: React.ReactNode;
  /** 透传 data-testid，保持 E2E 零漂移，默认 generic-order-card */
  testId?: string;
}

export default function GenericOrderCard({ waveId, children, testId = "generic-order-card" }: GenericOrderCardProps) {
  // useMountedNow 水合保护（与 MyWaves/MyClaims 同款 idiom，首帧 now=0 两端一致）
  const mounted = useSyncExternalStore(
    () => () => {},
    () => true,
    () => false,
  );
  const [now, setNow] = useState(0);
  useEffect(() => {
    if (!mounted) return;
    const t = window.setTimeout(() => setNow(Date.now()), 0);
    return () => window.clearTimeout(t);
  }, [mounted]);

  return (
    <div data-testid={testId} data-wave-id={waveId} data-now={now} className="bg-white rounded-3xl border-2 border-[#e5e5e5] border-b-[6px] shadow-sm p-4 space-y-2.5">
      {children}
    </div>
  );
}
