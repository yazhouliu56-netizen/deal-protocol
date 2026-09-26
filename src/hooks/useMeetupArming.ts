"use client";

import { toast } from "@/base/platform/toast";
import { useIdentityStore } from "@/store/useIdentityStore";
import { useWaveStore } from "@/store/useWaveStore";

/** 接单回执武装位（服务端 assign 回传；缺席＝STANDARD）。 */
export interface ClaimGuardExtra {
  demanderId?: string | null;
  meetupGuard?: { level?: string; reasons?: string[] } | null;
}

/**
 * 见面武装共享钩子（接单三控制台复用）：ENHANCED 即本地建隐私号会话
 * ＋toast，返回 reasons 供各端横幅渲染。分配失败不阻断（服务端通知包
 * 已触达）；非 ENHANCED/缺字段静默返回 []。
 */
export function useMeetupArming() {
  const allocatePrivacy = useWaveStore((s) => s.allocatePrivacy);
  const selfId = useIdentityStore((s) => s.identity.id);
  return (demandId: string, extra?: unknown): string[] => {
    const e = (extra ?? {}) as ClaimGuardExtra;
    const reasons = Array.isArray(e.meetupGuard?.reasons)
      ? e.meetupGuard.reasons.filter((r): r is string => typeof r === "string")
      : [];
    if (e.meetupGuard?.level !== "ENHANCED" || reasons.length === 0) return [];
    if (e.demanderId && selfId) {
      try {
        allocatePrivacy(demandId, selfId, e.demanderId);
      } catch {
        /* 本地会话失败不阻断（服务端通知包已触达） */
      }
    }
    toast(`🛡️ 强化守护已武装（${reasons.join("＋")}）：隐私号会话已建，履约中行程守护自动跟进`, "success");
    return reasons;
  };
}
