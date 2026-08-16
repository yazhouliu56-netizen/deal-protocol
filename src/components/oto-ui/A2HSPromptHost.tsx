"use client";

import { useEffect, useRef } from "react";
import A2HSPrompt, {
  type A2HSMilestone,
  type A2HSPromptHandle,
} from "./A2HSPrompt";
import { useWaveStore } from "@/store/useWaveStore";
import { useIdentityStore } from "@/store/useIdentityStore";
import { lockEdgeGesture } from "./edgeGestureLock";

/**
 * P2：A2HS 安装引导 · 全局外骨骼（layout 级常驻挂载）。
 *
 * 价值时刻（真实 store 数据驱动，冷启动绝不弹出，7 天静默防骚扰铁律）：
 * - FIRST_ORDER_COMPLETED：我发出的订单首次完成结算（fulfilment.isSettled 首次
 *   为 true）→ 把收发单工作台添加至桌面；
 * - PROVIDER_VERIFIED：我作为服务者首次被雇方批准占座（claims 首条
 *   accepted/joined 且归属我）→ 上岗准入价值时刻。
 *
 * 每个里程碑仅触发一次（firedRef 去重）；静默期检查在
 * A2HSPrompt.showInstallPrompt 内部执行（isA2HSSuppressed），本宿主零侵入。
 * 引导卡可见性通过 onPromptChange 回传，宿主侧用于锁边缘手势（防手势打架）。
 */
export default function A2HSPromptHost({ ua }: { ua?: string }) {
  const promptRef = useRef<A2HSPromptHandle>(null);
  const firedRef = useRef<Set<A2HSMilestone>>(new Set());

  const fulfilment = useWaveStore((s) => s.fulfilment);
  const claims = useWaveStore((s) => s.claims);
  const identityId = useIdentityStore((s) => s.identity.id);

  // 引导卡可见期间锁定边缘滑动返回，避免手势打架
  const onPromptVisible = (visible: boolean) => {
    lockEdgeGesture(visible);
  };

  // 首次结算 → 发单价值时刻（任一我发出订单 isSettled）
  useEffect(() => {
    if (firedRef.current.has("FIRST_ORDER_COMPLETED")) return;
    const settledOnce = Object.values(fulfilment).some((f) => f.isSettled);
    if (!settledOnce) return;
    firedRef.current.add("FIRST_ORDER_COMPLETED");
    promptRef.current?.showInstallPrompt("FIRST_ORDER_COMPLETED");
  }, [fulfilment]);

  // 首次被雇方批准占座 → 服务者上岗价值时刻
  useEffect(() => {
    if (firedRef.current.has("PROVIDER_VERIFIED")) return;
    const approvedOnce = claims.some(
      (c) => c.responderId === identityId && (c.status === "accepted" || c.status === "joined"),
    );
    if (!approvedOnce) return;
    firedRef.current.add("PROVIDER_VERIFIED");
    promptRef.current?.showInstallPrompt("PROVIDER_VERIFIED");
  }, [claims, identityId]);

  return (
    <A2HSPrompt
      ref={promptRef}
      ua={ua}
      onPromptChange={onPromptVisible}
    />
  );
}