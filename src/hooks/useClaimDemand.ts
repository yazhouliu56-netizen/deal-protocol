"use client";

import { useCallback, useState } from "react";

/* =====================================================================
 * 供给端抢单归一 Hook（Phase 2.1 双轨收敛）。
 * 收编 GrabConsole / ProviderConsole / SwipeableCard 三处手写
 * fetch('/api/demands/[id]/assign')：实名门禁、防连击、错误归一。
 * 服务端字段实测：业务失败 {reason}，500 {error}。
 * 各调用方成功后去向不同（履约页/任务 Tab/父回调），由 onSuccess 保留。
 * ===================================================================== */

export const CLAIM_VERIFY_MESSAGE = "抢单失败：请先完成实名身份验证！";
export const CLAIM_NETWORK_MESSAGE = "网络异常，请重试";
export const CLAIM_DEFAULT_MESSAGE = "抢单失败";

export function isClaimBlocked(verificationStatus?: string): boolean {
  return !!verificationStatus && verificationStatus !== "approved";
}

export function extractAssignError(data: unknown, fallback: string): string {
  if (data && typeof data === "object") {
    const record = data as Record<string, unknown>;
    if (typeof record.reason === "string" && record.reason) return record.reason;
    if (typeof record.error === "string" && record.error) return record.error;
  }
  return fallback;
}

interface ClaimDemandOpts {
  verificationStatus?: string;
  /** 实名拦截时的专属处理（不传则走 onFailure 统一提示）。 */
  onBlocked?: () => void;
  onSuccess: (demandId: string) => void | Promise<void>;
  onFailure: (message: string) => void;
  /** 调用方历史文案覆盖（缺省用归一常量）。 */
  messages?: {
    network?: string;
    fallback?: string;
  };
}

export function useClaimDemand(opts: ClaimDemandOpts) {
  const { verificationStatus, onBlocked, onSuccess, onFailure, messages } = opts;
  const networkMessage = messages?.network ?? CLAIM_NETWORK_MESSAGE;
  const fallbackMessage = messages?.fallback ?? CLAIM_DEFAULT_MESSAGE;
  const [claimingId, setClaimingId] = useState<string | null>(null);

  const claim = useCallback(
    async (demandId: string) => {
      if (claimingId) return;
      if (isClaimBlocked(verificationStatus)) {
        if (onBlocked) {
          onBlocked();
        } else {
          onFailure(CLAIM_VERIFY_MESSAGE);
        }
        return;
      }
      setClaimingId(demandId);
      try {
        const res = await fetch(`/api/demands/${demandId}/assign`, { method: "POST" });
        const data = (await res.json().catch(() => null)) as unknown;
        if (!res.ok) {
          onFailure(extractAssignError(data, fallbackMessage));
          return;
        }
        await onSuccess(demandId);
      } catch {
        onFailure(networkMessage);
      } finally {
        setClaimingId(null);
      }
    },
    [claimingId, verificationStatus, onBlocked, onSuccess, onFailure, networkMessage, fallbackMessage],
  );

  return { claim, claimingId, isClaiming: claimingId !== null };
}
