/**
 * PaySlice（Step 3 切片拆域）：支付托管、账本流水、退款车道、
 * 竞价结算、履约保险、no-show 违约资金闭环。
 * 跨域动作经合成入口 get() 调度（如 clusterPushes/syncOrderOp）。
 */
"use client";

import type { StateCreator } from "zustand";
import type { Wave } from "@/base/order/wave";
import { activateWave, perSeatPrice, resolveNoShow as resolveNoShowLogic } from "@/base/order/wave";
import {
  capturePayOrder,
  createPayOrder,
  type PayOrder,
} from "@/base/money/pay";
import { refundByTier, settleGroupFail } from "@/base/trust/trust";
import { useIdentityStore } from "@/store/useIdentityStore";
import { insure as insureLogic } from "@/base/platform/signInsure";
import { nextId } from "./shared";
import type { WaveStore } from "../useWaveStore";

export interface PaySlice {
  /** 随单支付 · 确认支付：capture 流水 → wave pending→active → 进入广播。
   * 幂等：重复支付同一单返回 ok 但不再重复生效。 */
  payWave: (waveId: string) => { ok: boolean; error?: string };
  /** Demand side: breach verdict moves the deposit (forfeit / refund). */
  moveDeposit: (claimId: string, phase: "forfeited" | "refunded") => void;
  /** 结清 no-show 违约 → 解除该位置的发波/拼位锁定。 */
  settleBreach: (claimId: string) => void;
  /** 公开竞价结算（P8 商业化）：开标结果写回真实局（中标者/佣金/净得）。 */
  settleBidding: (
    waveId: string,
    settled: NonNullable<Wave["biddingSettled"]>
  ) => void;
  /** 结算到期未成局的多人拼单局 → 该局所有已付订单全额自动退回（幂等）。 */
  settleExpiredOpen: (now?: number) => void;
  /** 需求方取消多人拼单局：≤24h 分级退款（≥24h 全退 / <24h 部分 / 已开始不退）。 */
  cancelOpenWave: (waveId: string) => void;
  /**
   * 多人拼单局 no-show：款不退 → 分摊补偿在场玩家（进钱包）+ 发起人获
   * 「下次成局面降标准」buff（neededJoiners −1）。
   */
  resolveNoShow: (waveId: string, claimId: string) => void;
  /**
   * ADR-0012 履约保险（N7）：座位锁定后可投保（保费 = 座价 10%，保额 = 座价，
   * 幂等；违约 no-show 时自动理赔给需求方）。
   */
  insureClaim: (p: {
    claimId: string;
    /** 投保人（须为该座位响应者，防代投）。 */
    initiatorId: string;
  }) => { ok: boolean; error?: string; policy?: import("@/base/platform/signInsure").InsurePolicy };
}

export const createPaySlice: StateCreator<WaveStore, [], [], PaySlice> = (
  set,
  get
) => ({
  policies: [],

  payWave: (waveId): { ok: boolean; error?: string } => {
    const s = get();
    const wave = s.waves.find((w) => w.id === waveId);
    if (!wave) return { ok: false, error: "wave-not-found" };
    if (wave.removed) return { ok: true }; // 违规单不支付不激活（防御）
    if (wave.status !== "pending") return { ok: true }; // 幂等：已上线
    // 该单所有待付订单（单子金额 seat + 发布费 publish-fee）一并捕获
    const orders = s.payOrders.filter(
      (o) => o.waveId === waveId && o.payerId === wave.authorId && o.status === "unpaid"
    );
    if (orders.length === 0) return { ok: false, error: "pay-order-missing" };
    const paid = orders.map((o) => capturePayOrder(o));
    const paidById = new Map(paid.map((o) => [o.id, o]));
    set((st) => ({
      payOrders: st.payOrders.map((o) => paidById.get(o.id) ?? o),
      waves: st.waves.map((w) => (w.id === waveId ? activateWave(w) : w)),
    }));
    // 支付到位才进广播（LLM 聚类推送，失败自动降级抽取）
    void get().clusterPushes({ ...wave, status: "active" });
    // Step 2 接电：支付捕获成功 = PUBLISHED，write-behind 落权威库（幂等键 = waveId）
    const paidCents = Math.round(
      orders.reduce((sum, o) => sum + (o.amount || 0), 0) * 100,
    );
    get().syncOrderOp({
      kind: "order-publish",
      payload: JSON.stringify({
        path: "/api/orders/publish",
        idempotencyKey: `pub:${waveId}`,
        body: {
          orderNo: waveId,
          userId: wave.authorId,
          categoryCode: wave.basics.category,
          ammoId: wave.ammoId ?? null,
          kind: (wave.capacity ?? 1) > 1 ? "open" : "solo",
          totalAmountCents: paidCents,
          payableAmountCents: paidCents,
          addressDetail: wave.basics.area,
          bizParams: {
            time: wave.basics.time,
            customs: wave.customs,
            negotiableNote: wave.negotiableNote ?? null,
            capacity: wave.capacity ?? 1,
          },
          splitPlan: {},
        },
      }),
    });
    return { ok: true };
  },

  moveDeposit: (claimId, phase) =>
    set((s) => ({
      claims: s.claims.map((c) =>
        c.id === claimId && c.depositPhase === "held"
          ? { ...c, depositPhase: phase }
          : c
      ),
    })),

  settleBreach: (claimId) =>
    set((s) => ({
      claims: s.claims.map((c) =>
        c.id === claimId && c.status === "breached" && !c.settled
          ? { ...c, settled: true }
          : c
      ),
    })),

  settleBidding: (waveId, settled) =>
    set((s) => ({
      waves: s.waves.map((w) =>
        w.id === waveId ? { ...w, biddingSettled: settled } : w
      ),
    })),

  settleExpiredOpen: (now = Date.now()) =>
    set((s) => {
      // 幂等：只处理 active 的多人拼单局；成团失败结算后 wave 置 expired，
      // 已退订单不会再退（settleGroupFail 只认 paid）。
      const settledWaves = s.waves.filter(
        (w) => w.status === "active" && w.capacity >= 2
      );
      if (settledWaves.length === 0) return {};
      const expireIds = new Set<string>();
      const refundedOrders: PayOrder[] = [];
      const refunds: Record<string, number> = {};
      for (const w of settledWaves) {
        const out = settleGroupFail({ wave: w, orders: s.payOrders, now });
        if (out.settled) {
          expireIds.add(w.id);
          refundedOrders.push(...out.refunded);
          Object.assign(refunds, out.refunds);
        }
      }
      if (expireIds.size === 0) return {};
      const refundMap = new Map(refundedOrders.map((o) => [o.id, o]));
      return {
        waves: s.waves.map((w) =>
          expireIds.has(w.id) ? { ...w, status: "expired" as const } : w
        ),
        payOrders: s.payOrders.map((o) => refundMap.get(o.id) ?? o),
      };
    }),

  cancelOpenWave: (waveId) =>
    set((s) => {
      const wave = s.waves.find((w) => w.id === waveId);
      if (!wave || wave.status !== "active") return {};
      // B 方案判定：无 startsAt 的老数据，看是否已有人正式拼位（accepted）
      const hasSeats = s.claims.some(
        (c) => c.waveId === waveId && c.status === "accepted"
      );
      const out = refundByTier({
        waveId,
        orders: s.payOrders,
        startsAt: wave.startsAt,
        hasSeats,
      });
      const refundMap = new Map(out.refunded.map((o) => [o.id, o]));
      return {
        waves: s.waves.map((w) => (w.id === waveId ? { ...w, status: "closed" as const } : w)),
        payOrders: s.payOrders.map((o) => refundMap.get(o.id) ?? o),
      };
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
          .map(([, amount]) =>
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
        // 履约保险联动（ADR-0012 N7）：breach 时该 holder 的未理赔保单自动理赔
        // （保额赔付由需求方端 receivePayout 幂等入账，MVP 沙盒资金池模拟）
        const claimedPolicies = s.policies.map((p) =>
          !p.claimed &&
          p.waveId === waveId &&
          p.holderId === claim.responderId
            ? { ...p, claimed: true }
            : p
        );
        return {
          claims: s.claims.map((c) => (c.id === claimId ? out.breachClaim : c)),
          payOrders: [...compensations, ...s.payOrders],
          policies: claimedPolicies,
          initiatorBuffs: {
            ...s.initiatorBuffs,
            [wave.authorId]: (s.initiatorBuffs[wave.authorId] ?? 0) + out.initiatorBuff,
          },
        };
      } catch {
        return {};
      }
    }),

  insureClaim: ({ claimId, initiatorId }) => {
    const s = get();
    const claim = s.claims.find((c) => c.id === claimId);
    if (!claim) return { ok: false, error: "claim-not-found" };
    if (claim.responderId !== initiatorId) {
      return { ok: false, error: "insurance.not-holder" };
    }
    if (claim.status !== "accepted" && claim.status !== "joined") {
      return { ok: false, error: "claim.not-locked" };
    }
    const wave = s.waves.find((w) => w.id === claim.waveId);
    if (!wave) return { ok: false, error: "wave-not-found" };
    const seatPrice = claim.price ?? perSeatPrice(wave);
    const premium = Math.max(1, Math.round(seatPrice * 0.1));
    const r = insureLogic(
      s.policies,
      wave.id,
      claim.responderId,
      premium,
      seatPrice,
      Date.now()
    );
    if (!r.fresh || !r.policy) {
      return { ok: false, error: "insurance.duplicate" };
    }
    // 保费从投保人钱包扣（本 tab 身份账本）
    useIdentityStore.getState().book(
      "insure",
      -premium,
      `履约保险投保 · 订单 ${claimId} · 保额 ¥${seatPrice}`
    );
    set(() => ({ policies: r.policies }));
    return { ok: true, policy: r.policy };
  },
});
