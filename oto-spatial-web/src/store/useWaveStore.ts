"use client";
import { create } from "zustand";
import { persist, type StorageValue } from "zustand/middleware";
import type { ResponderCapability } from "@/lib/broadcast";
import type {
  Claim,
  Wave,
  CreateWaveInput,
} from "@/lib/wave";
import {
  assembleWave as assembleWaveLogic,
  activateWave,
  claimDirect,
  closeWave,
  counterOffer,
  createWave,
  joinSeat as joinSeatLogic,
  lockNegotiation,
  neededJoiners,
  openNegotiation,
  perSeatPrice,
  resolveNoShow as resolveNoShowLogic,
  withdrawClaim,
} from "@/lib/wave";
import { acceptFulfilment, requestPayment, resolveAutoFulfilment } from "@/lib/fulfilment";
import type { Review } from "@/lib/review";
import type { PayOrder } from "@/lib/pay";
import { capturePayOrder, createPayOrder } from "@/lib/pay";
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
  /** 随单支付流水（共享空间）— 支付/放款/退款全程留痕。 */
  payOrders: PayOrder[];
  /** Capability-declared responders (real identities + mock atmosphere). */
  responders: ResponderCapability[];
  /** 评价（脱敏展示，共享空间）— credit tier derives from these. */
  reviews: Review[];
  /** LLM 聚类推送（雷达收件箱）— recipient-filtered per device. */
  pushes: PushItem[];
  /** 治理：举报流水 + 封禁表（平台级）。 */
  reports: Report[];
  bans: Record<string, BanRecord>;
  /** 开放局 no-show 补偿：发起人获得的「成局面降标准」buff（跨会话累计） */
  initiatorBuffs: Record<string, number>;
  /** 共享空间单调版本号（transport 写盘守卫用，防早态快照回退覆盖） */
  bundleVer?: number;
}

interface WaveStore extends WaveBundle {
  publishWave: (
    input: Omit<CreateWaveInput, "id" | "authorId" | "createdAt"> & {
      authorId: string;
    }
  ) => string | null;
  /**
   * 随单支付 · 建单（待支付）：验证 + 建 wave(pending) + 建支付流水(unpaid)。
   * 返回 { id, amount }（命中违禁词 → removed: true，不支付不激活）。
   */
  createPendingWave: (
    input: Omit<CreateWaveInput, "id" | "authorId" | "createdAt" | "pending"> & {
      authorId: string;
      /** 应付金额：服务型 = 全款；开放局 = 发起人自己那份(人均价)。 */
      payAmount: number;
    }
  ) => { id: string; amount: number; removed?: boolean } | null;
  /**
   * 随单支付 · 确认支付：capture 流水 → wave pending→active → 进入广播。
   * 幂等：重复支付同一单返回 ok 但不再重复生效。
   */
  payWave: (waveId: string) => { ok: boolean; error?: string };
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
   * (Open-match waves must use joinSeat instead.)
   */
  openClaim: (p: {
    waveId: string;
    responderId: string;
    price: number;
    note?: string;
  }) => { claim?: Claim; error?: string };
  /**
   * 开放局拼位: reserve one seat of an open match (capacity ≥ 2). When the
   * last seat is taken the wave assembles automatically.
   */
  joinSeat: (p: {
    waveId: string;
    responderId: string;
  }) => { claim?: Claim; assembled?: boolean; error?: string };
  /** 开放局: demander closes the table early (at least one seat taken). */
  assembleWave: (waveId: string) => void;
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
  /**
   * 开放局 no-show：款不退 → 分摊补偿在场玩家（进钱包）+ 发起人获
   * 「下次成局面降标准」buff（neededJoiners −1）。
   */
  resolveNoShow: (waveId: string, claimId: string) => void;
}

let seq = 0;
const nextId = (prefix: string) => `${prefix}-${++seq}-${Date.now().toString(36)}`;

export const useWaveStore = create<WaveStore>()(
  persist(
    (set, get) => ({
      waves: [],
      claims: [],
      payOrders: [],
      // 氛围响应者初始内联（客户端静态数据），rehydrate 会用共享空间内容
      // 覆盖。此前用 onRehydrateStorage seed + setState 注入，会触发 persist
      // 写回，与另一 tab 的写入形成读-改-写竞态（可见性延迟下互相覆盖，
      // E2E 间歇失败根因）——改为初始值注入，不产生任何写回。
      responders: MOCK_RESPONDERS,
      reviews: [],
      pushes: [],
      reports: [],
      bans: {},
      initiatorBuffs: {},
      bundleVer: 0,

      createPendingWave: (input) => {
        if (isBanned(get().bans, input.authorId)) return null;
        // no-show buff 消费：发起人若有「成局面降标准」buff，本局所需拼位数 −N
        const buff = Math.min(get().initiatorBuffs[input.authorId] ?? 0, Math.max(0, (input.capacity ?? 1) - 1));
        const wave = createWave({
          ...input,
          id: nextId("wave"),
          createdAt: Date.now(),
          expiresAt: input.expiresAt,
          pending: true,
          buffSeats: buff,
        });
        set((s) => ({
          initiatorBuffs: buff > 0
            ? { ...s.initiatorBuffs, [input.authorId]: (s.initiatorBuffs[input.authorId] ?? 0) - buff }
            : s.initiatorBuffs,
        }));
        // 治理闸门 2：敏感词先挡后审 —— pending 单同样过审，违规标记 removed
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
          return { id: wave.id, amount: input.payAmount, removed: true };
        }
        const order = createPayOrder({
          id: nextId("pay"),
          waveId: wave.id,
          payerId: input.authorId,
          amount: input.payAmount,
        });
        set((s) => ({ waves: [wave, ...s.waves], payOrders: [order, ...s.payOrders] }));
        return { id: wave.id, amount: order.amount };
      },

      payWave: (waveId): { ok: boolean; error?: string } => {
        const s = get();
        const wave = s.waves.find((w) => w.id === waveId);
        if (!wave) return { ok: false, error: "wave-not-found" };
        if (wave.removed) return { ok: true }; // 违规单不支付不激活（防御）
        if (wave.status !== "pending") return { ok: true }; // 幂等：已上线
        const order = s.payOrders.find((o) => o.waveId === waveId && o.payerId === wave.authorId);
        if (!order) return { ok: false, error: "pay-order-missing" };
        const paid = capturePayOrder(order);
        set((st) => ({
          payOrders: st.payOrders.map((o) => (o.id === order.id ? paid : o)),
          waves: st.waves.map((w) => (w.id === waveId ? activateWave(w) : w)),
        }));
        // 支付到位才进广播（LLM 聚类推送，失败自动降级抽取）
        void get().clusterPushes({ ...wave, status: "active" });
        return { ok: true };
      },

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
        if (wave.capacity >= 2) {
          return { error: "wave-open-match-use-join" };
        }
        const claimId = nextId("claim");
        if (wave.negotiable && note?.trim()) {
          const claim = openNegotiation(wave, responderId, claimId, price ?? wave.budget);
          set((st) => ({
            claims: [...st.claims, claim],
            // 接单后雷达清空：所有推送标记已读
            pushes: st.pushes.map((p) => ({ ...p, read: true })),
          }));
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
          // 接单后雷达清空：所有推送标记已读（跨 tab 合并后不残留未读）
          pushes: st.pushes.map((p) => ({ ...p, read: true })),
        }));
        return { claim };
      },

      joinSeat: ({ waveId, responderId }) => {
        const s = get();
        const wave = s.waves.find((w) => w.id === waveId);
        if (!wave) return { error: "wave-not-found" };
        if (wave.status !== "active") return { error: "wave-not-active" };
        // 一个响应者最多占一个位
        const already = s.claims.some(
          (c) =>
            c.waveId === waveId &&
            c.responderId === responderId &&
            (c.status === "joined" || c.status === "accepted")
        );
        if (already) return { error: "already-joined" };
        const joinedCount = s.claims.filter(
          (c) => c.waveId === waveId && c.status === "joined"
        ).length;
        if (joinedCount >= neededJoiners(wave)) {
          return { error: "wave-full" };
        }
        try {
          const claimId = nextId("claim");
          const out = joinSeatLogic(
            wave,
            responderId,
            claimId,
            joinedCount
          );
          // 满员成局：把该局其余 joined 一并转 accepted（押金联动由
          // MyClaims 的幂等 syncDeposit effect 按 claim phase 自动记账）
          const lockedClaims = s.claims.map((c) =>
            c.waveId === waveId && c.status === "joined" && out.claim.status === "accepted"
              ? { ...c, status: "accepted" as const, depositPhase: wave.deposit ? ("held" as const) : c.depositPhase }
              : c
          );
          set((st) => ({
            waves: st.waves.map((w) => (w.id === waveId ? out.wave : w)),
            claims: [...lockedClaims, out.claim],
          }));
          return { claim: out.claim, assembled: out.wave.status === "assembled" };
        } catch (e) {
          return { error: e instanceof Error ? e.message : "join-failed" };
        }
      },

      assembleWave: (waveId) => {
        const s = get();
        const wave = s.waves.find((w) => w.id === waveId);
        if (!wave) return;
        try {
          const out = assembleWaveLogic(wave, s.claims);
          set((st) => ({
            waves: st.waves.map((w) => (w.id === waveId ? out.wave : w)),
            claims: out.claims,
          }));
        } catch {
          // 无座位 / 非开放局 / 已锁定 → 忽略
        }
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

      resolveNoShow: (waveId, claimId) =>
        set((s) => {
          const wave = s.waves.find((w) => w.id === waveId);
          const claim = s.claims.find((c) => c.id === claimId);
          if (!wave || !claim) return {};
          const attendees = s.claims.filter(
            (c) => c.waveId === waveId && c.status === "accepted"
          );
          let paidAmount = perSeatPrice(wave);
          const paid = s.payOrders.find(
            (o) => o.waveId === waveId && o.payerId === claim.responderId && o.status === "paid"
          );
          if (paid) paidAmount = paid.amount;
          try {
            const out = resolveNoShowLogic({
              wave,
              claim,
              attendees,
              paidAmount,
            });
            // 补偿记账：受益 claim 各记一条补偿流水（进钱包，标记已入账）
            const compensations = Object.entries(out.compensations)
              .filter(([, v]) => v > 0)
              .map(([responderId, amount]) =>
                capturePayOrder(
                  createPayOrder({
                    id: nextId("pay"),
                    waveId,
                    payerId: claim.responderId,
                    amount,
                  }),
                  Date.now()
                )
              );
            return {
              claims: s.claims.map((c) => (c.id === claimId ? out.breachClaim : c)),
              payOrders: [...compensations, ...s.payOrders],
              initiatorBuffs: {
                ...s.initiatorBuffs,
                [wave.authorId]: (s.initiatorBuffs[wave.authorId] ?? 0) + out.initiatorBuff,
              },
            };
          } catch {
            return {};
          }
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
            // 跨 tab 写回统一走 transport —— transport 内部自带
            // read-merge-write 原子防护，防止早态快照覆盖新数据。
            getP2pTransport().write(sv.state as unknown as WaveBundle);
          } catch {
            // unparsable write → drop
          }
        },
        removeItem: () =>
          getP2pTransport().write({
            waves: [],
            claims: [],
            payOrders: [],
            responders: [],
            reviews: [],
            pushes: [],
            reports: [],
            bans: {},
            initiatorBuffs: {},
            bundleVer: 0,
          } satisfies WaveBundle),
      },
      version: 1,
      partialize: (s) =>
        ({
          waves: s.waves,
          claims: s.claims,
          payOrders: s.payOrders,
          responders: s.responders,
          reviews: s.reviews,
          pushes: s.pushes,
          reports: s.reports,
          bans: s.bans,
          initiatorBuffs: s.initiatorBuffs,
          bundleVer: s.bundleVer,
        }) as WaveStore,
      // Transport updates handled by module-level subscribe below.
      onRehydrateStorage: () => () => {},
    }
  )
);

// 跨 tab 广播监听：模块级注册，页面一加载即生效——
// 若挂在 onRehydrateStorage 里，listener 注册依赖 rehydrate 完成，
// 竞态下会错过另一 tab 在注册前写入的数据（E2E 间歇失败根因）。
if (typeof window !== "undefined") {
  getP2pTransport().subscribe(() => {
    useWaveStore.persist.rehydrate();
  });
}

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