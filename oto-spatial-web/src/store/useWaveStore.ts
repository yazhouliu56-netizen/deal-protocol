"use client";
import { create } from "zustand";
import { persist, type StorageValue } from "zustand/middleware";
import type { ResponderCapability } from "@/lib/broadcast";
import type {
  Claim,
  Wave,
  CreateWaveInput,
} from "@/lib/wave";
import { claimDirect, closeWave, counterOffer, createWave, lockNegotiation, openNegotiation, withdrawClaim } from "@/lib/wave";
import { acceptFulfilment, requestPayment, resolveAutoFulfilment } from "@/lib/fulfilment";
import type { Review } from "@/lib/review";
import { MOCK_RESPONDERS } from "@/lib/mockResponders";
import { getP2pTransport } from "@/lib/p2p/transport";
import type { PushItem } from "@/lib/cluster";
import { buildPushes, mockClusterTags } from "@/lib/cluster";
import { broadcastMatches } from "@/lib/broadcast";
import { completionRate, reviewStats } from "@/lib/starRank";
import {
  applyPenalty,
  autoFlag,
  clearBan,
  escalatePenalty,
  isBanned,
  resolveReport as resolveReportLogic,
  submitReport as submitReportLogic,
  type BanRecord,
  type Report,
} from "@/lib/moderation";

/**
 * The shared broadcast space — one zustand store persisted under a single
 * localStorage key. Cross-tab updates broadcast themselves for free via the
 * browser `storage` event (zustand persist rehydrates automatically), so a
 * second tab = a second P2P identity watching the same signal flow.
 *
 * Private identity / balance lives in `useIdentityStore` (per-tab
 * sessionStorage). This store only keeps shared, non-secret state.
 */

export interface WaveBundle {
  waves: Wave[];
  claims: Claim[];
  /** Capability-declared responders (real identities + mock atmosphere). */
  responders: ResponderCapability[];
  /** 评价（脱敏展示，共享空间）— credit tier derives from these. */
  reviews: Review[];
  /** LLM 聚类推送（雷达收件箱）— recipient-filtered per device. */
  pushes: PushItem[];
  /** 治理：举报流水 + 封禁表（平台级）。 */
  reports: Report[];
  bans: Record<string, BanRecord>;
}

interface WaveStore extends WaveBundle {
  publishWave: (
    input: Omit<CreateWaveInput, "id" | "authorId" | "createdAt"> & {
      authorId: string;
    }
  ) => string | null;
  /** Subscribe a responder capability (onboarding / capability edit). */
  registerResponder: (cap: ResponderCapability) => void;
  /** Fire-and-forget LLM clustering → radar pushes for best-fit responders. */
  clusterPushes: (wave: Wave) => void;
  /** Mark one radar push as read. */
  markPushRead: (pushId: string) => void;
  removeResponder: (id: string) => void;
  /**
   * Responder side: open a claim. When the wave is negotiable AND a
   * negotiation note is provided → 丙磋商; otherwise → 甲 direct claim.
   */
  openClaim: (p: {
    waveId: string;
    responderId: string;
    price: number;
    note?: string;
  }) => { claim?: Claim; error?: string };
  /** One more counter-offer round (每对独立 3 轮；lastBy 交替制由纯函数强制). */
  counterOffer: (p: {
    claimId: string;
    price: number;
    message: string;
    /** Who is countering — alternation enforced (same-side throws). */
    actor: "responder" | "demander";
  }) => { claim?: Claim; error?: string };
  /** Demand side: accept a negotiation → wave claimed by that responder. */
  acceptClaim: (claimId: string) => void;
  /**
   * Responder side: report the job done (Request payment).
   * Opens the demander's release gate (Airtasker rule).
   */
  reportDone: (claimId: string) => void;
  /**
   * Demand side: accept the work with an evidence note →
   * deposit released + 72h review window starts.
   */
  acceptFulfilment: (claimId: string, note: string) => void;
  /** Auto-release: resolve any 72h-overdue reported fulfilments (idempotent). */
  runAutoFulfilments: () => void;
  /** Demand side: breach verdict moves the deposit (forfeit / refund). */
  moveDeposit: (claimId: string, phase: "forfeited" | "refunded") => void;
  /** Add a review (idempotent per reviewer per claim). */
  addReview: (review: Review) => void;
  /** 治理：用户举报（幂等，同一人对同一对象未决举报不重复）。 */
  submitReport: (p: {
    targetId: string;
    targetType: "wave" | "review" | "responder";
    reason: "spam" | "harassment" | "fraud" | "sensitive" | "other";
    detail: string;
    reporterId: string;
  }) => void;
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
  /** Responder walks away. */
  withdraw: (claimId: string) => void;
  /** Entire wave = lock negotiation / close manually. */
  closeWave: (waveId: string) => void;
}

let seq = 0;
const nextId = (prefix: string) => `${prefix}-${++seq}-${Date.now().toString(36)}`;

export const useWaveStore = create<WaveStore>()(
  persist(
    (set, get) => ({
      waves: [],
      claims: [],
      responders: [],
      reviews: [],
      pushes: [],
      reports: [],
      bans: {},

      publishWave: (input) => {
        // 治理闸门 1：被封禁/限流中不能发布
        if (isBanned(get().bans, input.authorId)) return null;
        const wave = createWave({
          ...input,
          id: nextId("wave"),
          createdAt: Date.now(),
          expiresAt: input.expiresAt,
        });
        // 治理闸门 2：敏感词先挡后审 —— 违规内容下架落库 + 自动生成举报
        const scan = [
          wave.basics.category,
          ...wave.customs.map((c) => c.text),
          wave.negotiableNote ?? "",
        ].join(" ");
        const hit = autoFlag(scan);
        if (hit) {
          const autoReport = submitReportLogic(get().reports, {
            targetId: wave.id,
            targetType: "wave",
            reporterId: "system",
            reason: "sensitive",
            detail: `命中违禁词：${hit}（${scan.slice(0, 60)}）`,
            auto: true,
          });
          set((s) => ({
            waves: [{ ...wave, removed: true }, ...s.waves],
            reports: autoReport.report
              ? [...s.reports, autoReport.report]
              : s.reports,
          }));
          return wave.id;
        }
        // Real interest is counted from claims; hotness is the virtual base.
        set((s) => ({ waves: [wave, ...s.waves] }));
        // LLM 聚类推送（异步，失败自动降级抽取）
        void get().clusterPushes(wave);
        return wave.id;
      },

      clusterPushes: async (wave) => {
        let tags: string[] = [];
        try {
          const res = await fetch("/api/cluster", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              category: wave.basics.category,
              customs: wave.customs,
              negotiableNote: wave.negotiableNote,
            }),
          });
          if (res.ok) {
            const data = (await res.json()) as { tags?: string[] };
            tags = data.tags ?? [];
          }
        } catch {
          // offline → local mock extraction
        }
        if (tags.length === 0) {
          tags = mockClusterTags({
            category: wave.basics.category,
            customs: wave.customs,
            negotiableNote: wave.negotiableNote,
          });
        }
        const pushes = buildPushes(
          wave,
          get().responders,
          tags,
          broadcastMatches
        );
        if (pushes.length > 0) {
          set((s) => ({ pushes: [...pushes, ...s.pushes].slice(0, 60) }));
        }
      },

      markPushRead: (pushId) =>
        set((s) => ({
          pushes: s.pushes.map((p) => (p.id === pushId ? { ...p, read: true } : p)),
        })),

      registerResponder: (cap) =>
        set((s) => {
          // 星级成长（Airtasker 双指标）自动附着 → 广播权重即时生效
          const stats = reviewStats(s.reviews, cap.id);
          const completion = completionRate(s.claims, cap.id);
          // 封禁表联动：限流到期自愈、封禁硬筛即时生效
          const banned = isBanned(s.bans, cap.id);
          const enriched: ResponderCapability = {
            ...cap,
            star: stats.star || undefined,
            completion,
            ...(banned ? { banned: true } : { banned: undefined }),
          };
          const idx = s.responders.findIndex((r) => r.id === cap.id);
          const responders =
            idx === -1
              ? [...s.responders, enriched]
              : s.responders.map((r) => (r.id === cap.id ? enriched : r));
          return { responders };
        }),

      removeResponder: (id) =>
        set((s) => ({ responders: s.responders.filter((r) => r.id !== id) })),

      openClaim: ({ waveId, responderId, note, price }) => {
        const s = get();
        const wave = s.waves.find((w) => w.id === waveId);
        if (!wave) return { error: "wave-not-found" };
        const claimId = nextId("claim");
        if (wave.negotiable && note?.trim()) {
          const claim = openNegotiation(wave, responderId, claimId, price ?? wave.budget);
          set((st) => ({ claims: [...st.claims, claim] }));
          return { claim };
        }
        const { wave: locked, claim } = claimDirect(
          wave,
          responderId,
          claimId,
          price ?? wave.budget
        );
        set((st) => ({
          waves: st.waves.map((w) => (w.id === waveId ? locked : w)),
          claims: [...st.claims, claim],
        }));
        return { claim };
      },

      counterOffer: ({ claimId, price, message, actor }) => {
        const s = get();
        const claim = s.claims.find((c) => c.id === claimId);
        if (!claim) return { error: "claim-not-found" };
        try {
          const updated = counterOffer(claim, price, message, actor);
          set((st) => ({ claims: st.claims.map((c) => (c.id === claimId ? updated : c)) }));
          return { claim: updated };
        } catch (e) {
          return { error: e instanceof Error ? e.message : "claim-invalid" };
        }
      },

      acceptClaim: (claimId) => {
        const s = get();
        const claim = s.claims.find((c) => c.id === claimId);
        if (!claim) return;
        const wave = s.waves.find((w) => w.id === claim.waveId);
        if (!wave) return;
        const out = lockNegotiation(wave, claim, true);
        if (out.wave) {
          set((st) => ({
            waves: st.waves.map((w) => (w.id === wave.id ? out.wave! : w)),
            claims: st.claims.map((c) =>
              c.id === claimId
                ? {
                    ...c,
                    status: "accepted",
                    depositPhase: wave.deposit ? "held" : c.depositPhase,
                  }
                : c
            ),
          }));
        }
      },

      reportDone: (claimId) =>
        set((s) => ({
          claims: s.claims.map((c) =>
            c.id === claimId ? requestPayment(c) : c
          ),
        })),

      acceptFulfilment: (claimId, note) =>
        set((s) => ({
          claims: s.claims.map((c) =>
            c.id === claimId ? acceptFulfilment(c, note) : c
          ),
        })),

      runAutoFulfilments: () => {
        const s = get();
        const now = Date.now();
        const next = s.claims.map((c) => resolveAutoFulfilment(c, now) ?? c);
        const changed = next.some((c, i) => c !== s.claims[i]);
        if (changed) set({ claims: next });
      },

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

      moveDeposit: (claimId, phase) =>
        set((s) => ({
          claims: s.claims.map((c) =>
            c.id === claimId && c.depositPhase === "held"
              ? { ...c, depositPhase: phase }
              : c
          ),
        })),

      withdraw: (claimId) =>
        set((s) => ({
          claims: s.claims.map((c) => (c.id === claimId ? withdrawClaim(c) : c)),
        })),

      submitReport: (p) =>
        set((s) => {
          const { report } = submitReportLogic(s.reports, p);
          return report ? { reports: [...s.reports, report] } : {};
        }),

      resolveReport: (reportId, action, note, moderatorId) =>
        set((s) => {
          const report = s.reports.find((r) => r.id === reportId);
          if (!report || report.status === "resolved") return {};
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

      closeWave: (waveId) =>
        set((s) => {
          const wave = s.waves.find((w) => w.id === waveId);
          if (!wave) return {};
          return { waves: s.waves.map((w) => (w.id === waveId ? closeWave(w) : w)) };
        }),
    }),
    {
      name: "oto-broadcast-v1",
      // Transport-backed storage: localStorage (same device) or Supabase
      // Realtime (cross-device). zustand v5 hands us StorageValue objects.
      storage: {
        getItem: (name) => {
          if (name !== "oto-broadcast-v1") return null;
          const state = getP2pTransport().read();
          return state
            ? ({ state: state as unknown as WaveStore, version: 1 })
            : null;
        },
        setItem: (_name, value) => {
          try {
            const sv = value as StorageValue<WaveStore>;
            getP2pTransport().write(sv.state as unknown as WaveBundle);
          } catch {
            // unparsable write → drop
          }
        },
        removeItem: () =>
          getP2pTransport().write({
            waves: [],
            claims: [],
            responders: [],
            reviews: [],
            pushes: [],
            reports: [],
            bans: {},
          } satisfies WaveBundle),
      },
      version: 1,
      partialize: (s) =>
        ({
          waves: s.waves,
          claims: s.claims,
          responders: s.responders,
          reviews: s.reviews,
          pushes: s.pushes,
          reports: s.reports,
          bans: s.bans,
        }) as WaveStore,
      // Seed atmosphere responders once on the client (never during SSR).
      onRehydrateStorage: () => (state) => {
        if (state && state.responders.length === 0) {
          useWaveStore.setState({ responders: MOCK_RESPONDERS });
        }
        // Transport updates (other tab / other device) rehydrate the store.
        getP2pTransport().subscribe(() => {
          useWaveStore.persist.rehydrate();
        });
      },
    }
  )
);

/** In-memory virtual interest calibration (hotness padding) for the feed. */
export function displayInterest(
  realClaims: Claim[],
  wave: Wave,
  cap = 3
): number {
  const base = realClaims.length;
  const virtual = Math.min(cap, Math.max(0, wave.hotness ?? 0));
  return base + virtual;
}