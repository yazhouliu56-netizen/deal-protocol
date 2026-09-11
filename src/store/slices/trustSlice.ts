/**
 * TrustSlice（Step 3 切片拆域）：评价沉淀、治理举报与裁定、
 * 好友请求闭环（S3 发起转友）。
 */
"use client";

import type { StateCreator } from "zustand";
import type { Review, ReviewDimensions } from "@/base/trust/review";
import { editReview as editReviewLogic } from "@/base/trust/review";
import {
  applyPenalty,
  clearBan,
  escalatePenalty,
  isBanned,
  resolveReport as resolveReportLogic,
  submitReport as submitReportLogic,
  withdrawReport as withdrawReportLogic,
} from "@/base/risk/moderation";
import {
  acceptFriendRequest as acceptFriendRequestLogic,
  expireFriendRequests as expireFriendRequestsLogic,
  sendFriendRequest as sendFriendRequestLogic,
} from "@/adapters/social/friends";
import type { WaveStore } from "../useWaveStore";

export interface TrustSlice {
  /** Add a review (idempotent per reviewer per claim). */
  addReview: (review: Review) => void;
  /** 撤销窗：72h 内本人改评价 1 次（base 规则：本人/未改过/窗内/低分解释）。 */
  editReview: (
    reviewId: string,
    p: { dimensions: ReviewDimensions; comment?: string },
    requesterId: string
  ) => { ok: boolean; error?: string };
  /** 治理：用户举报（幂等，同一人对同一对象未决举报不重复）。 */
  submitReport: (p: {
    targetId: string;
    targetType: "wave" | "review" | "responder";
    reason: "spam" | "harassment" | "fraud" | "sensitive" | "other";
    detail: string;
    reporterId: string;
  }) => void;
  /** 撤销窗：举报人撤回自己的 open 举报（非 auto；撤后退出队列、可重报）。 */
  withdrawReport: (reportId: string, requesterId: string) => { ok: boolean; error?: string };
  /**
   * 治理：管理员裁定。联动执行 —— remove → wave 下架；dismiss →
   * 恢复被下架内容 / 解封；suspend/ban → 封禁（广播硬筛 + 发布拦截）。
   */
  resolveReport: (
    reportId: string,
    action: "dismiss" | "warn" | "remove" | "suspend" | "ban",
    note: string,
    moderatorId: string
  ) => void;
  /** S3 · 发起转友（幂等：已好友/已有待确认/自我 → error）。 */
  sendFriendRequest: (p: {
    fromId: string;
    toId: string;
    claimId: string;
  }) => { ok: boolean; error?: string };
  /** S3 · 收方接受 → 互认好友（幂等重放）。 */
  acceptFriendRequest: (requestId: string) => { accepted: boolean };
  /** S3 · 收方忽略 → 请求移除。 */
  ignoreFriendRequest: (requestId: string) => void;
  /** S3 · 72h 到期扫描 → 静默撤回过期请求。 */
  sweepFriendRequests: () => void;
}

export const createTrustSlice: StateCreator<WaveStore, [], [], TrustSlice> = (
  set,
  get
) => ({
  addReview: (review) =>
    set((s) => {
      const claim = s.claims.find((c) => c.id === review.claimId);
      if (!claim || (claim.reviewedBy ?? []).includes(review.fromId)) {
        return { reviews: s.reviews };
      }
      return {
        reviews: [...s.reviews, review],
        claims: s.claims.map((c) =>
          c.id === claim.id
            ? { ...c, reviewedBy: [...(c.reviewedBy ?? []), review.fromId] }
            : c
        ),
      };
    }),

  submitReport: (p) =>
    set((s) => {
      const { report } = submitReportLogic(s.reports, p);
      if (!report) return {};
      // 撤回后重报：复活旧 withdrawn 件而非追加（保 id 唯一，留 withdrawnAt 痕供审计）
      const idx = s.reports.findIndex(
        (r) => r.id === report.id && r.status === "withdrawn"
      );
      if (idx < 0) return { reports: [...s.reports, report] };
      const revived = {
        ...report,
        withdrawnAt: s.reports[idx]!.withdrawnAt,
        withdrawnBy: s.reports[idx]!.withdrawnBy,
      };
      return { reports: s.reports.map((r, i) => (i === idx ? revived : r)) };
    }),

  editReview: (reviewId, p, requesterId) => {
    const review = get().reviews.find((r) => r.id === reviewId);
    if (!review) return { ok: false, error: "review.not-found" };
    const out = editReviewLogic(review, p, requesterId);
    if (!out.review) return { ok: false, error: out.error };
    set((s) => ({
      reviews: s.reviews.map((r) => (r.id === reviewId ? out.review! : r)),
    }));
    return { ok: true };
  },

  withdrawReport: (reportId, requesterId) => {
    const report = get().reports.find((r) => r.id === reportId);
    if (!report) return { ok: false, error: "report.not-found" };
    const out = withdrawReportLogic(report, requesterId);
    if (!out.report) return { ok: false, error: out.error };
    set((s) => ({
      reports: s.reports.map((r) => (r.id === reportId ? out.report! : r)),
    }));
    return { ok: true };
  },

  resolveReport: (reportId, action, note, moderatorId) =>
    set((s) => {
      const report = s.reports.find((r) => r.id === reportId);
      // 仅 open 可裁定（resolved 重入 + withdrawn 撤回件一律拒绝；
      // 撤回后重报复活旧件，id 恒唯一，无需 open 优先）
      if (!report || report.status !== "open") return {};
      const resolved = resolveReportLogic(report, action, note, moderatorId);
      const next = {
        waves: s.waves,
        responders: s.responders,
        bans: s.bans,
      };
      // 联动：wave 下架 / 恢复
      if (report.targetType === "wave") {
        if (action === "remove") {
          next.waves = s.waves.map((w) =>
            w.id === report.targetId ? { ...w, removed: true } : w
          );
        } else if (action === "dismiss") {
          next.waves = s.waves.map((w) =>
            w.id === report.targetId ? { ...w, removed: false } : w
          );
        }
      }
      // 联动：响应者封禁 / 解封（含 24h 限流的到期自愈）
      if (report.targetType === "responder") {
        if (action === "suspend" || action === "ban") {
          next.bans = applyPenalty(s.bans, report.targetId, action, note);
        } else if (action === "dismiss") {
          next.bans = clearBan(s.bans, report.targetId);
        }
        const updatedReports = s.reports.map((r) =>
          r.id === reportId ? resolved : r
        );
        // 自动升级：累计有效裁定 ≥2 → suspend；≥3 → ban（只升不降）
        const escalation = escalatePenalty(
          updatedReports,
          report.targetId,
          next.bans
        );
        if (escalation) {
          next.bans = applyPenalty(
            next.bans,
            report.targetId,
            escalation,
            "自动升级（累计有效举报）"
          );
        }
        next.responders = s.responders.map((r) =>
          r.id === report.targetId
            ? { ...r, banned: isBanned(next.bans, report.targetId) }
            : r
        );
      }
      return {
        reports: [...s.reports.map((r) => (r.id === reportId ? resolved : r))],
        ...next,
      };
    }),

  sendFriendRequest: ({ fromId, toId, claimId }) => {
    const out = sendFriendRequestLogic(
      get().friendRequests,
      get().friendships,
      {
        id: `fr-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`,
        fromId,
        toId,
        claimId,
      }
    );
    if (out.error || !out.request) return { ok: false, error: out.error };
    set((s) => ({ friendRequests: [...s.friendRequests, out.request!] }));
    return { ok: true };
  },

  acceptFriendRequest: (requestId) => {
    const out = acceptFriendRequestLogic(
      get().friendRequests,
      get().friendships,
      requestId
    );
    if (out.requests !== get().friendRequests) {
      set((s) => ({
        friendRequests: out.requests,
        friendships: out.friendships,
        friendRequestRemovals: [...new Set([...s.friendRequestRemovals, requestId])],
      }));
    }
    return { accepted: out.accepted };
  },

  ignoreFriendRequest: (requestId) =>
    set((s) => ({
      friendRequests: s.friendRequests.filter((r) => r.id !== requestId),
      friendRequestRemovals: [...new Set([...s.friendRequestRemovals, requestId])],
    })),

  sweepFriendRequests: () =>
    set((s) => {
      const swept = expireFriendRequestsLogic(s.friendRequests);
      if (swept.length === s.friendRequests.length) return {};
      const removed = s.friendRequests.filter((r) => !swept.includes(r)).map((r) => r.id);
      return {
        friendRequests: swept,
        friendRequestRemovals: [...new Set([...s.friendRequestRemovals, ...removed])],
      };
    }),
});
