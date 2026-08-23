"use client";
import { create } from "zustand";
import { persist, type StorageValue } from "zustand/middleware";
import type { WaveBundle } from "@/types/wave-bundle";
import type { ResponderCapability } from "@/base/dispatch/broadcast";
import type {
  Claim,
  Wave,
  CreateWaveInput,
} from "@/base/order/wave";
import {
  assembleWave as assembleWaveLogic,
  activateWave,
  claimDirect,
  closeWave,
  counterOffer,
  createWave,
  joinSeat as joinSeatLogic,
  approveRequest as approveRequestLogic,
  lockNegotiation,
  neededJoiners,
  openNegotiation,
  perSeatPrice,
  resolveNoShow as resolveNoShowLogic,
  withdrawClaim,
  joinWaitlist as joinWaitlistLogic,
  leaveWaitlist as leaveWaitlistLogic,
  promoteFromWaitlist as promoteFromWaitlistLogic,
} from "@/base/order/wave";
import { acceptFulfilment, requestPayment, resolveAutoFulfilment } from "@/base/order/fulfilment";
import {
  confirmModule,
  initModuleStates,
  reportModule,
} from "@/base/order/moduleFulfilment";
import {
  negotiate,
  openDispute,
  resolveAuto,
  type DisputeReason,
} from "@/base/order/dispute";
import { hasUnsettledBreach, refundByTier, settleGroupFail } from "@/base/trust/trust";
import type { Review } from "@/base/trust/review";
import type { PayOrder } from "@/base/money/pay";
import { capturePayOrder, createPayOrder } from "@/base/money/pay";
import { fissionStamp } from "@/base/risk/fission";
import { useRoamStore, roamParams } from "@/store/useRoamStore";
import { evaluatePublishAdmission } from "@/base/risk/admission";
import { useIdentityStore } from "@/store/useIdentityStore";
import { ageFromBirthYear, ageGate, type MoneyAction } from "@/base/safe/ageGate";
import { addGuest as addGuestLogic, removeGuest as removeGuestLogic, type GuestInfo } from "@/base/order/guest";
import {
  insure as insureLogic,
  type InsurePolicy,
} from "@/base/platform/signInsure";
import {
  allocatePair,
  revokeSession,
  DEMO_POOL,
} from "@/base/comm/privacyNumber";
import { markRead, sendMsg } from "@/base/comm/im";
import {
  acceptFriendRequest as acceptFriendRequestLogic,
  expireFriendRequests as expireFriendRequestsLogic,
  sendFriendRequest as sendFriendRequestLogic,
} from "@/base/trust/friends";
import { MOCK_RESPONDERS } from "@/lib/mockResponders";
import { getP2pTransport } from "@/base/platform/p2p/transport";
import { buildPushes, mockClusterTags } from "@/base/ai/cluster";
import { broadcastMatches } from "@/base/dispatch/broadcast";
import { dispatchRuleFor } from "@/ammo/dispatch-rule";
import { homeAccessKeywordsFor } from "@/ammo/risk-rule";
import type { MatchFn } from "@/base/ai/cluster";

/** 品类化广播匹配（ammo dispatch-rule 驱动，宪法 #4：不写死业务权重）。 */
function broadcastMatchesFor(category: string): MatchFn {
  return (responders, wave) =>
    broadcastMatches(responders, wave, dispatchRuleFor(category));
}
import { parseBiQuery, runBi, type BiResult, type BiRow } from "@/base/ai/bi";
import {
  notifyFor as notifyForLogic,
  raiseCrisis as raiseCrisisLogic,
  resolveCrisis as resolveCrisisLogic,
  type CrisisLevel,
  type CrisisRecord,
} from "@/base/safe/crisis";
import { requestForget as requestForgetLogic, type ForgetKind, type ForgetRequest } from "@/base/safe/privacy";
import { allow as breakerAllow, trip as breakerTrip } from "@/base/platform/circuit";
import { due as queueDue, enqueue as enqueueOp, markPlayed as markQueuePlayed, type QueueOp } from "@/base/platform/offlineQueue";

/**
 * Step 2 接电：权威库冲刷器（fire-and-forget 单条）。
 * 409 视为幂等语义内的成功（并发已提交 / 版本已被他人推进）。
 */
async function flushOrderOp(item: QueueOp): Promise<boolean> {
  try {
    const { path, body, idempotencyKey } = JSON.parse(item.payload) as {
      path: string;
      body: unknown;
      idempotencyKey?: string;
    };
    const res = await fetch(path, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        ...(idempotencyKey ? { "x-idempotency-key": idempotencyKey } : {}),
      },
      body: JSON.stringify(body),
    });
    return res.ok || res.status === 409;
  } catch {
    return false;
  }
}
import { lakeAppend } from "@/base/platform/resilience";
import { signDoc } from "@/base/platform/signInsure";
import { completionRate, reviewStats } from "@/base/trust/starRank";
import {
  applyPenalty,
  clearBan,
  escalatePenalty,
  isBanned,
  resolveReport as resolveReportLogic,
  submitReport as submitReportLogic,
} from "@/base/risk/moderation";

/** 未成年人资金闸（ADR-0016）：响应/拼位/竞价等真实资金入口按 ageGate 拦截。
 * 与 PublishSheet 分派一致：未填出生年（age=null）不拦截，已填则按分级判定。 */
function gateMoneyAction(action: MoneyAction): string | undefined {
  const identity = useIdentityStore.getState().identity;
  if (!identity.birthYear) return undefined;
  const age = ageFromBirthYear(identity.birthYear, new Date().getFullYear());
  const gate = ageGate({ age, action, guardianConsent: identity.guardianConsent });
  return gate.blocked ? gate.reason : undefined;
}

/**
 * The shared broadcast space — one zustand store persisted under a single
 * localStorage key. Cross-tab updates broadcast themselves for free via the
 * browser `storage` event (zustand persist rehydrates automatically), so a
 * second tab = a second P2P identity watching the same signal flow.
 *
 * Private identity / balance lives in `useIdentityStore` (per-tab
 * sessionStorage). This store only keeps shared, non-secret state.
 */

interface WaveStore extends WaveBundle {
  /**
   * W5 总装：履约/结算回写位（advanceLifecycle 流转结果落库，驱动
   * toAtomicFiveState 投影 → 顶栏胶囊实时流转）。只增不改：存量字段零触碰。
   * key = waveId；fulfilmentStatus "reported" = 已申报完工 → IN_SERVICE，
   * "confirmed" = 已验收 → INSPECTED；isSettled = 资金终局 → SETTLED。
   */
  fulfilment: Record<string, { fulfilmentStatus?: "reported" | "confirmed"; isSettled?: boolean }>;
  setFulfilment: (
    waveId: string,
    flags: { fulfilmentStatus?: "reported" | "confirmed"; isSettled?: boolean }
  ) => void;
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
      /** 应付金额：服务型 = 全款；多人拼单局 = 发起人自己那份(人均价)。 */
      payAmount: number;
      /**
       * 免费发布次数用完 → 需付发布费（独立于单子金额，一经支付不退）。
       * 为 0 时表示本次发布在免费配额内，不建发布费订单。
       */
      publishFee?: number;
    }
  ) => {
    id: string;
    amount: number;
    removed?: boolean;
    blocked?: "debt" | "roam" | "sentinel";
    /** 未成年分级拦截（ageGate "publish"）：blocked 联合外的独立旗标，UI 按需消费。 */
    minorBlocked?: boolean;
  } | null;
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
   * 多人拼单局拼位: reserve one seat of an open match (capacity ≥ 2). When the
   * last seat is taken the wave assembles automatically.
   */
  joinSeat: (p: {
    waveId: string;
    responderId: string;
  }) => { claim?: Claim; assembled?: boolean; error?: string };
  /** 候补（waitlist）：多人拼单局满员后进入候补队列（幂等；有人退出自动补位）。 */
  joinWaitlist: (p: {
    waveId: string;
    responderId: string;
  }) => { waitlisted?: boolean; queuePos?: number; error?: string };
  /** 候补：主动退出队列（幂等）。 */
  leaveWaitlist: (p: {
    waveId: string;
    responderId: string;
  }) => void;
  /** 组织者把关层：审批制多人拼单局提交拼位申请（幂等，不占座不付钱）。 */
  requestSeat: (p: { waveId: string; responderId: string }) => { ok: boolean; error?: string };
  /** 发起人审批拼位申请：通过 → 占座（满员即成局）；拒绝 → 移除申请。 */
  decideRequest: (p: {
    waveId: string;
    responderId: string;
    approve: boolean;
    /** 审批发起者（须为该局发起人，防自批自申）。 */
    initiatorId: string;
  }) => { claim?: Claim; assembled?: boolean; error?: string };
  /** 多人拼单局: demander closes the table early (at least one seat taken). */
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
  /** 复杂任务：为 claim 初始化模块状态（接单后调用）。 */
  attachModules: (claimId: string, count: number) => void;
  /** 复杂任务 · 响应者：申报某模块完成。 */
  reportModuleDone: (claimId: string, moduleIdx: number) => void;
  /** 复杂任务 · 需求方：单独确认某模块验收。 */
  approveModule: (claimId: string, moduleIdx: number) => void;
  /** 争议 · 需求方：按原因开争议（自动判责 + 48h 申诉窗）。 */
  openDispute: (p: {
    claimId: string;
    reason: DisputeReason;
    evidence: string;
  }) => void;
  /** 争议 · 协商结算（响应者出比例，需求方决定）。 */
  settleDispute: (p: {
    claimId: string;
    proposedPct: number;
    willAccept: boolean;
    note: string;
  }) => void;
  /** 争议 · 自动终局（48h 无人申诉）。 */
  autoResolveDisputes: () => void;
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
  /** 携伴登记（Meetup 吸收项 ⑤）：座位锁定后可登记 1 位携伴，ageGate 合规校验。 */
  addGuest: (p: {
    claimId: string;
    guest: Omit<GuestInfo, "at">;
  }) => { ok: boolean; error?: string };
  /** 携伴移除（幂等）。 */
  removeGuest: (claimId: string, guestIdx: number) => void;
  /** Entire wave = lock negotiation / close manually. */
  closeWave: (waveId: string) => void;
  /**
 * 多人拼单局 no-show：款不退 → 分摊补偿在场玩家（进钱包）+ 发起人获
 * 「下次成局面降标准」buff（neededJoiners −1）。
 */
  resolveNoShow: (waveId: string, claimId: string) => void;
  /** 结算到期未成局的多人拼单局 → 该局所有已付订单全额自动退回（幂等）。 */
  settleExpiredOpen: (now?: number) => void;
  /** 需求方取消多人拼单局：≤24h 分级退款（≥24h 全退 / <24h 部分 / 已开始不退）。 */
  cancelOpenWave: (waveId: string) => void;
  /** 关注/取消关注一个局（雷达心愿单，幂等 toggle）。 */
  toggleFavorite: (waveId: string) => void;
  /** 结清 no-show 违约 → 解除该位置的发波/拼位锁定。 */
  settleBreach: (claimId: string) => void;
  /** 公开竞价结算（P8 商业化）：开标结果写回真实局（中标者/佣金/净得）。 */
  settleBidding: (
    waveId: string,
    settled: NonNullable<Wave["biddingSettled"]>
  ) => void;
  /** S3 · 发起转友（幂等：已好友/已有待确认/自我 → error）。 */
  sendFriendRequest: (p: {
    fromId: string;
    toId: string;
    claimId: string;
  }) => { ok: boolean; error?: string };
  /**
   * ADR-0012 履约保险（N7）：座位锁定后可投保（保费 = 座价 10%，保额 = 座价，
   * 幂等；违约 no-show 时自动理赔给需求方）。
   */
  insureClaim: (p: {
    claimId: string;
    /** 投保人（须为该座位响应者，防代投）。 */
    initiatorId: string;
  }) => { ok: boolean; error?: string; policy?: InsurePolicy };
  /** S3 · 收方接受 → 互认好友（幂等重放）。 */
  acceptFriendRequest: (requestId: string) => { accepted: boolean };
  /** S3 · 收方忽略 → 请求移除。 */
  ignoreFriendRequest: (requestId: string) => void;
  /** S3 · 72h 到期扫描 → 静默撤回过期请求。 */
  sweepFriendRequests: () => void;
  /** ADR-0010：隐私号会话分配（订单锁定后，48h 双向）。 */
  allocatePrivacy: (waveId: string, aId: string, bId: string) => void;
  /** ADR-0010：订单终局 → 销毁隐私会话。 */
  revokePrivacy: (waveId: string) => void;
  /** ADR-0010：IM 私信发送（自动建线程 + 未读）。 */
  sendIm: (fromId: string, toId: string, text: string, waveId?: string) => void;
  /** ADR-0010：IM 标记已读。 */
  markImRead: (threadId: string, whoId: string) => void;
  /** ADR-0013：SOS 危机干预 —— 登记 + EPA 通知 + 处置闭环（幂等）。 */
  raiseCrisis: (p: {
    level: CrisisLevel;
    note: string;
    waveId?: string;
    /** 紧急联系人名单（通知对象展示用）。 */
    contacts: string[];
  }) => { record?: CrisisRecord; targets: string[] };
  resolveCrisis: (id: string) => void;
  /** ADR-0013：遗忘权申请（幂等合并 pending）。 */
  requestForget: (kind: ForgetKind) => { req?: ForgetRequest; fresh: boolean };
  /** ADR-0011：自然语言 BI —— 本地解析中文统计查询（聊天页接线）。 */
  askBi: (text: string) => BiResult | null;
  /** ADR-0014：重放离线队列（在线恢复/手动触发）。 */
  replayQueue: () => Promise<void>;
  /**
   * Step 2 接电：权威库 write-behind 同步器 —— 本地乐观先行，异步落权威库；
   * 失败/离线自动入 offlineQueue（幂等键防服务端重复），replayQueue 追平。
   */
  syncOrderOp: (op: QueueOp) => void;
}

let seq = 0;
const nextId = (prefix: string) => `${prefix}-${++seq}-${Date.now().toString(36)}`;

export const useWaveStore = create<WaveStore>()(
  persist(
    (set, get) => ({
      waves: [],
      claims: [],
      payOrders: [],
      // W5 总装：履约/结算回写位（advanceLifecycle 流转结果 → toAtomicFiveState 投影）
      fulfilment: {},
      // 氛围响应者初始内联（客户端静态数据），rehydrate 会用共享空间内容
      // 覆盖。此前用 onRehydrateStorage seed + setState 注入，会触发 persist
      // 写回，与另一 tab 的写入形成读-改-写竞态（可见性延迟下互相覆盖，
      // E2E 间歇失败根因）——改为初始值注入，不产生任何写回。
      responders: MOCK_RESPONDERS,
      reviews: [],
      pushes: [],
      reports: [],
      bans: {},
      favorites: [],
      initiatorBuffs: {},
      disputes: [],
      sentinelEvents: [],
      privacySessions: [],
      imThreads: [],
      imMessages: [],
      friendRequests: [],
      friendships: [],
      friendRequestRemovals: [],
      crisisRecords: [],
      forgetRequests: [],
      circuitBreaker: { state: "closed", failures: 0, probes: 0, openedAt: 0 },
      offlineQueue: [],
      lake: [],
      signedDocs: [],
      policies: [],
      bundleVer: 0,

createPendingWave: (input) => {
    // 统一发布准入引擎（Step1 下沉 base/risk/admission）：封禁/甄检/欠款/未成年四闸一次判定
    const roam = useRoamStore.getState();
    const ident = useIdentityStore.getState();
    const myWaves = get().waves.filter((w) => w.authorId === input.authorId);
    const recentPublishes = myWaves.filter(
      (w) => w.createdAt > Date.now() - 7 * 24 * 3600_000
    ).length;
    const scanText = [
      input.basics?.category ?? "",
      ...(input.customs ?? []).map((c) => c.text),
      input.negotiableNote ?? "",
    ].join(" ");
    const admission = evaluatePublishAdmission({
      authorId: input.authorId,
      scanText,
      amountYuan: input.budget ?? 0,
      category: input.basics?.category,
      bindings: roam.bindings,
      deviceId: roam.deviceId,
      roamRuleParams: roamParams(),
      birthYear: ident.identity.birthYear,
      guardianConsent: ident.identity.guardianConsent,
      creditScore: (ident.creditTier ?? 3) * 200,
      recentPublishCount: recentPublishes,
      hasUnsettledBreachFlag: hasUnsettledBreach(get().claims, input.authorId),
      homeAccessKeywords: homeAccessKeywordsFor(input.basics?.category ?? ""),
      bans: get().bans,
    });
    if (admission.auditEvents.length > 0) {
      set((s) => ({
        sentinelEvents: [...s.sentinelEvents, ...admission.auditEvents],
      }));
    }
    if (!admission.allowed) {
      // 既有契约：封禁/限流 = null（PublishSheet 显示「账号已被平台限制」文案）
      if (admission.blockedReason === "banned") return null;
      return {
        id: "",
        amount: 0,
        blocked:
          admission.blockedReason === "minor" ? undefined : admission.blockedReason,
        minorBlocked: admission.blockedReason === "minor",
      };
    }
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
    const hit = admission.sensitiveHit;
        if (hit) {
          const autoReport = submitReportLogic(get().reports, {
            targetId: wave.id,
            targetType: "wave",
            reporterId: "system",
            reason: "sensitive",
            detail: `命中违禁词：${hit}（${scanText.slice(0, 60)}）`,
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
          kind: "seat",
        });
        // 发布费独立建单：超出每日免费次数时随这笔单一起支付（提交即扣）
        const fee = input.publishFee ? Math.max(0, input.publishFee) : 0;
        const feeOrder = fee > 0
          ? createPayOrder({
              id: nextId("pay"),
              waveId: wave.id,
              payerId: input.authorId,
              amount: fee,
              kind: "publish-fee",
            })
          : null;
        set((s) => ({
          waves: [wave, ...s.waves],
          payOrders: feeOrder ? [feeOrder, order, ...s.payOrders] : [order, ...s.payOrders],
        }));
        return { id: wave.id, amount: order.amount + fee };
      },

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

      // W5 总装：履约/结算回写位（advanceLifecycle 流转结果 → 投影 → 胶囊实时流转）
      setFulfilment: (waveId, flags) =>
        set((s) => ({
          fulfilment: {
            ...s.fulfilment,
            [waveId]: { ...s.fulfilment[waveId], ...flags },
          },
        })),

      publishWave: (input) => {
        // 统一发布准入引擎（Step1 下沉）：修复先在不一致——免费路径补齐甄检/欠款/未成年闸
        const roam = useRoamStore.getState();
        const ident = useIdentityStore.getState();
        const myWaves = get().waves.filter((w) => w.authorId === input.authorId);
        const recentPublishes = myWaves.filter(
          (w) => w.createdAt > Date.now() - 7 * 24 * 3600_000
        ).length;
        const scanText = [
          input.basics?.category ?? "",
          ...(input.customs ?? []).map((c) => c.text),
          input.negotiableNote ?? "",
        ].join(" ");
        const admission = evaluatePublishAdmission({
          authorId: input.authorId,
          scanText,
          amountYuan: input.budget ?? 0,
          category: input.basics?.category,
          bindings: roam.bindings,
          deviceId: roam.deviceId,
          roamRuleParams: roamParams(),
          birthYear: ident.identity.birthYear,
          guardianConsent: ident.identity.guardianConsent,
          creditScore: (ident.creditTier ?? 3) * 200,
          recentPublishCount: recentPublishes,
          hasUnsettledBreachFlag: hasUnsettledBreach(get().claims, input.authorId),
          homeAccessKeywords: homeAccessKeywordsFor(input.basics?.category ?? ""),
          bans: get().bans,
        });
        if (admission.auditEvents.length > 0) {
          set((s) => ({
            sentinelEvents: [...s.sentinelEvents, ...admission.auditEvents],
          }));
        }
        if (!admission.allowed) return null;
        const wave = createWave({
          ...input,
          id: nextId("wave"),
          createdAt: Date.now(),
          expiresAt: input.expiresAt,
        });
        // 治理闸门：敏感词先挡后审 —— 违规内容下架落库 + 自动生成举报
        const hit = admission.sensitiveHit;
        if (hit) {
          const autoReport = submitReportLogic(get().reports, {
            targetId: wave.id,
            targetType: "wave",
            reporterId: "system",
            reason: "sensitive",
            detail: `命中违禁词：${hit}（${scanText.slice(0, 60)}）`,
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
        // Step 2 接电：免费直发激活 = PUBLISHED，write-behind 落权威库（幂等键 = waveId）
        get().syncOrderOp({
          kind: "order-publish",
          payload: JSON.stringify({
            path: "/api/orders/publish",
            idempotencyKey: `pub:${wave.id}`,
            body: {
              orderNo: wave.id,
              userId: input.authorId,
              categoryCode: wave.basics.category,
              ammoId: wave.ammoId ?? null,
              kind: (wave.capacity ?? 1) > 1 ? "open" : "solo",
              totalAmountCents: Math.round((input.budget || 0) * 100),
              payableAmountCents: Math.round((input.budget || 0) * 100),
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
        return wave.id;
      },

      clusterPushes: async (wave) => {
        // 智能熔断（ADR-0014 N12 接线）：持续失败 → open → 冷却后半开探测。
        // 熔断期间跳过上游直接本地抽取（降级链第一步），成功回执 trip(true) 恢复。
        const now = Date.now();
        const gate = breakerAllow(get().circuitBreaker, now);
        if (!gate.ok) {
          set({ circuitBreaker: gate.breaker });
          const tags = mockClusterTags({
            category: wave.basics.category,
            customs: wave.customs,
            negotiableNote: wave.negotiableNote,
          });
          const pushes = buildPushes(wave, get().responders, tags, broadcastMatchesFor(wave.basics.category));
          if (pushes.length > 0) {
            set((s) => ({ pushes: [...pushes, ...s.pushes].slice(0, 60) }));
          }
          return;
        }
        set({ circuitBreaker: gate.breaker });
        let tags: string[] = [];
        let upstreamOk = false;
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
          upstreamOk = res.ok;
          if (res.ok) {
            const data = (await res.json()) as { tags?: string[] };
            tags = data.tags ?? [];
          }
        } catch {
          // offline → local mock extraction
        }
        // 回执进熔断器：失败次数累计到阈值 → open；成功清零。
        set((s) => ({
          circuitBreaker: breakerTrip(s.circuitBreaker, upstreamOk, Date.now()),
        }));
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
          broadcastMatchesFor(wave.basics.category)
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
        // 未成年人资金闸：带爽约保障险（押金）的局未成年人不能接
        if (wave.deposit) {
          const gate = gateMoneyAction("deposit");
          if (gate) return { error: gate };
        }
        const claimId = nextId("claim");
        if (wave.negotiable && note?.trim()) {
          const claim = openNegotiation(wave, responderId, claimId, price ?? wave.budget);
set((st) => ({
            waves: st.waves.map((w) =>
              w.id === waveId
                ? {
                    ...w,
                    ...fissionStamp(w, responderId, Date.now()),
                  }
                : w
            ),
            claims: [
              ...st.claims,
              // 模块随协商锁定（发起人拆解确认后，协商开始即不可改）
              wave.modules && wave.modules.length >= 2
                ? { ...claim, modules: initModuleStates(wave.modules.length) }
                : claim,
            ],
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
        // ADR-0010 N1（接线补齐）：直接接单（甲方案）同样锁定订单 →
        // 从号码池分配双向虚拟号会话（此前只在磋商 acceptClaim 分配，
        // 直接接单路径无会话 → ContactCard 永不渲染）。
        const privacy = allocatePair(
          s.privacySessions,
          DEMO_POOL,
          wave.id,
          wave.authorId,
          responderId,
          Date.now()
        ).session;
        set((st) => ({
          waves: st.waves.map((w) =>
            w.id === waveId
              ? {
                  ...locked,
                  // 拼位裂变：真实回应（接单/磋商）计数一次，按人去重
                  ...fissionStamp(w, responderId, Date.now()),
                }
              : w
          ),
          claims: [
            ...st.claims,
            wave.modules && wave.modules.length >= 2
              ? { ...claim, modules: initModuleStates(wave.modules.length) }
              : claim,
          ],
          // 接单后雷达清空：所有推送标记已读（跨 tab 合并后不残留未读）
          pushes: st.pushes.map((p) => ({ ...p, read: true })),
          privacySessions: st.privacySessions.some(
            (x) => x.waveId === wave.id && !x.revokedAt
          )
            ? st.privacySessions
            : [...st.privacySessions, privacy],
        }));
        return { claim };
      },

      joinSeat: ({ waveId, responderId }) => {
        const s = get();
        const wave = s.waves.find((w) => w.id === waveId);
        if (!wave) return { error: "wave-not-found" };
        if (wave.status !== "active") return { error: "wave-not-active" };
        // 组织者把关层：审批制多人拼单局禁止直接拼位，必须先 requestSeat 申请
        if (wave.needApproval) return { error: "approval-required" };
        // no-show 欠款锁定：违约未结不能拼位
        if (hasUnsettledBreach(s.claims, responderId)) {
          return { error: "debt-unsettled" };
        }
        // 未成年人资金闸：带爽约保障险（押金）的局未成年人不能拼位
        if (wave.deposit) {
          const gate = gateMoneyAction("deposit");
          if (gate) return { error: gate };
        }
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
          // 拼位支付落流水：占位即付自己的那份（人均价），成团失败/取消退款以此为准
          const seatPaid = capturePayOrder(
            createPayOrder({
              id: nextId("pay"),
              waveId,
              payerId: responderId,
              amount: out.claim.price ?? perSeatPrice(wave),
            })
          );
          set((st) => ({
            waves: st.waves.map((w) =>
              w.id === waveId
                ? {
                    ...out.wave,
                    // 拼位裂变：新拼位者（非发起人）计数一次，按人去重
                    ...fissionStamp(w, responderId, Date.now()),
                  }
                : w
            ),
            claims: [...lockedClaims, out.claim],
            payOrders: [seatPaid, ...st.payOrders],
          }));
          return { claim: out.claim, assembled: out.wave.status === "assembled" };
        } catch (e) {
          return { error: e instanceof Error ? e.message : "join-failed" };
        }
      },

      joinWaitlist: ({ waveId, responderId }) => {
        const s = get();
        const wave = s.waves.find((w) => w.id === waveId);
        if (!wave) return { error: "wave-not-found" };
        if (wave.status !== "active" && wave.status !== "assembled") {
          return { error: "wave-not-active" };
        }
        // 未成局且有位置 → 直接拼位，不排队；已成局（assembled）→ 排队等让位
        if (wave.status === "active") {
          const joinedCount = s.claims.filter(
            (c) => c.waveId === waveId && c.status === "joined"
          ).length;
          if (joinedCount < neededJoiners(wave)) {
            return { error: "wave-not-full" };
          }
        }
        // 与 joinSeat 同防线：no-show 欠款锁定 + 一人一位 + 未成年人资金闸
        if (hasUnsettledBreach(s.claims, responderId)) {
          return { error: "debt-unsettled" };
        }
        if (wave.deposit) {
          const gate = gateMoneyAction("deposit");
          if (gate) return { error: gate };
        }
        const already = s.claims.some(
          (c) =>
            c.waveId === waveId &&
            c.responderId === responderId &&
            (c.status === "joined" || c.status === "accepted")
        );
        if (already) return { error: "already-joined" };
        const out = joinWaitlistLogic(wave, responderId, Date.now());
        set((st) => ({
          waves: st.waves.map((w) => (w.id === waveId ? out.wave : w)),
        }));
        const queuePos = (out.wave.waitlist ?? []).length;
        return { waitlisted: true, queuePos };
      },

      leaveWaitlist: ({ waveId, responderId }) => {
        const s = get();
        const wave = s.waves.find((w) => w.id === waveId);
        if (!wave) return;
        const out = leaveWaitlistLogic(wave, responderId);
        set((st) => ({
          waves: st.waves.map((w) => (w.id === waveId ? out.wave : w)),
        }));
      },

      requestSeat: ({ waveId, responderId }) => {
        const s = get();
        const wave = s.waves.find((w) => w.id === waveId);
        if (!wave) return { ok: false, error: "wave-not-found" };
        if (!wave.needApproval) return { ok: false, error: "approval-off" };
        if (wave.status !== "active") return { ok: false, error: "wave-not-active" };
        const exists = (wave.joinRequests ?? []).some(
          (r) => r.responderId === responderId
        );
        if (exists) return { ok: true };
        set((st) => ({
          waves: st.waves.map((w) =>
            w.id === waveId
              ? {
                  ...w,
                  joinRequests: [
                    ...(w.joinRequests ?? []),
                    { responderId, at: Date.now() },
                  ],
                }
              : w
          ),
        }));
        return { ok: true };
      },

      decideRequest: ({ waveId, responderId, approve, initiatorId }) => {
        const s = get();
        const wave = s.waves.find((w) => w.id === waveId);
        if (!wave) return { error: "wave-not-found" };
        if (!wave.needApproval) return { error: "approval-off" };
        // 发起人身份校验：只有局发起人能审批（防自批自申/越权审批）
        if (initiatorId !== wave.authorId) return { error: "not-initiator" };
        if (!approve) {
          set((st) => ({
            waves: st.waves.map((w) =>
              w.id === waveId
                ? {
                    ...w,
                    joinRequests: (w.joinRequests ?? []).filter(
                      (r) => r.responderId !== responderId
                    ),
                  }
                : w
            ),
          }));
          return {};
        }
        const requested = (wave.joinRequests ?? []).some(
          (r) => r.responderId === responderId
        );
        if (!requested) return { error: "no-request" };
        // 与 joinSeat 同防线：no-show 欠款锁定 + 一人一位
        if (hasUnsettledBreach(s.claims, responderId)) {
          return { error: "debt-unsettled" };
        }
        const already = s.claims.some(
          (c) =>
            c.waveId === waveId &&
            c.responderId === responderId &&
            (c.status === "joined" || c.status === "accepted")
        );
        if (already) return { error: "already-joined" };
        // 复用纯函数审批：占座 + 满员成局（绕过 store 层 needApproval 拦截）
        const joined = s.claims.filter(
          (c) => c.waveId === waveId && c.status === "joined"
        ).length;
        const claimId = nextId("claim");
        const out = approveRequestLogic(
          wave,
          responderId,
          claimId,
          joined
        );
        if (out.error || !out.claim) {
          set((st) => ({
            waves: st.waves.map((w) =>
              w.id === waveId
                ? {
                    ...w,
                    joinRequests: (w.joinRequests ?? []).filter(
                      (r) => r.responderId !== responderId
                    ),
                  }
                : w
            ),
          }));
          return { error: out.error ?? "approve-failed" };
        }
        // 拼位支付落流水：占位即付（同 joinSeat）
        const seatPaid = capturePayOrder(
          createPayOrder({
            id: nextId("pay"),
            waveId,
            payerId: responderId,
            amount: out.claim.price ?? perSeatPrice(wave),
          })
        );
        // 满员成局：其余 joined 一并转 accepted
        const lockedClaims = s.claims.map((c) =>
          c.waveId === waveId && c.status === "joined" && out.claim!.status === "accepted"
            ? { ...c, status: "accepted" as const, depositPhase: wave.deposit ? ("held" as const) : c.depositPhase }
            : c
        );
        set((st) => ({
          waves: st.waves.map((w) =>
            w.id === waveId
              ? {
                  ...out.wave,
                  ...fissionStamp(w, responderId, Date.now()),
                  joinRequests: (out.wave.joinRequests ?? []).filter(
                    (r) => r.responderId !== responderId
                  ),
                }
              : w
          ),
          claims: [...lockedClaims, out.claim!],
          payOrders: [seatPaid, ...st.payOrders],
        }));
        return { claim: out.claim, assembled: out.wave.status === "assembled" };
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
          // 无座位 / 非多人拼单局 / 已锁定 → 忽略
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
          const privacy = allocatePair(
            s.privacySessions,
            DEMO_POOL,
            wave.id,
            wave.authorId,
            claim.responderId,
            Date.now()
          ).session;
          set((st) => ({
            waves: st.waves.map((w) => (w.id === wave.id ? out.wave! : w)),
            claims: st.claims.map((c) =>
              c.id === claimId
                ? {
                    ...c,
                    status: "accepted",
                    depositPhase: wave.deposit ? "held" : c.depositPhase,
                    modules:
                      wave.modules && wave.modules.length >= 2 && !c.modules
                        ? initModuleStates(wave.modules.length)
                        : c.modules,
                  }
                : c
            ),
            privacySessions: st.privacySessions.some((x) => x.waveId === wave.id)
              ? st.privacySessions
              : [...st.privacySessions, privacy],
          }));
        }
      },

      reportDone: (claimId) =>
        set((s) => ({
          claims: s.claims.map((c) =>
            c.id === claimId ? requestPayment(c) : c
          ),
        })),

      acceptFulfilment: (claimId, note) => {
        const s = get();
        const claim = s.claims.find((c) => c.id === claimId);
        // ADR-0012 验收签章（N7 接线）：验收即签章，内容哈希存证可验签
        const signed = claim
          ? signDoc(`验收 ${claimId} · ${note || "验收通过"}`, claim.responderId, Date.now())
          : null;
        set((st) => ({
          claims: st.claims.map((c) =>
            c.id === claimId ? acceptFulfilment(c, note) : c
          ),
          // 订单完成 → 隐私号会话终局回收
          privacySessions: claim
            ? revokeSession(st.privacySessions, claim.waveId, Date.now())
            : st.privacySessions,
          // ADR-0014 数据湖存证（N14 接线）：验收终局事件 append 哈希链
          lake: claim ? lakeAppend(st.lake, "fulfilment", { claimId, note }, Date.now()) : st.lake,
          signedDocs: signed ? [...st.signedDocs, signed] : st.signedDocs,
        }));
      },

      runAutoFulfilments: () => {
        const s = get();
        const now = Date.now();
        const next = s.claims.map((c) => resolveAutoFulfilment(c, now) ?? c);
        const changed = next.some((c, i) => c !== s.claims[i]);
        if (changed) set({ claims: next });
      },

      attachModules: (claimId, count) =>
        set((s) => ({
          claims: s.claims.map((c) =>
            c.id === claimId && !c.modules
              ? { ...c, modules: initModuleStates(count) }
              : c
          ),
        })),

      reportModuleDone: (claimId, moduleIdx) =>
        set((s) => ({
          claims: s.claims.map((c) =>
            c.id === claimId ? reportModule(c, moduleIdx) : c
          ),
        })),

      approveModule: (claimId, moduleIdx) =>
        set((s) => ({
          claims: s.claims.map((c) =>
            c.id === claimId ? confirmModule(c, moduleIdx) : c
          ),
        })),

      openDispute: (p) =>
        set((s) => {
          const d = openDispute(p);
          const already = s.disputes.some((x) => x.claimId === p.claimId && !x.outcome);
          if (already) return { disputes: s.disputes };
          return {
            disputes: [...s.disputes, d],
            // ADR-0014 数据湖存证：争议开启事件
            lake: lakeAppend(s.lake, "dispute", { claimId: p.claimId, reason: p.reason }, Date.now()),
          };
        }),

      settleDispute: (p) => {
        const s = get();
        const claim = s.claims.find((c) => c.id === p.claimId);
        let toTerminal = false;
        const disputes = s.disputes.map((d) => {
          if (d.claimId !== p.claimId || d.outcome) return d;
          const next = negotiate(d, p.proposedPct, p.willAccept, p.note);
          if (next.outcome) toTerminal = true;
          return next;
        });
        set((st) => ({
          disputes,
          // 争议终局（有 outcome）→ 隐私号会话回收
          privacySessions:
            claim && toTerminal
              ? revokeSession(st.privacySessions, claim.waveId, Date.now())
              : st.privacySessions,
          // ADR-0014 数据湖存证：争议终局事件
          lake: toTerminal
            ? lakeAppend(st.lake, "dispute-settled", { claimId: p.claimId, pct: p.proposedPct }, Date.now())
            : st.lake,
        }));
      },

      autoResolveDisputes: () => {
        const s = get();
        const now = Date.now();
        const next = s.disputes.map((d) =>
          !d.outcome && now >= d.appealDeadline
            ? resolveAuto(d, "48h 未申诉，自动按档位终局")
            : d
        );
        const changed = next.some((d, i) => d !== s.disputes[i]);
        if (changed) set({ disputes: next });
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

      withdraw: (claimId) => {
        const s = get();
        const claim = s.claims.find((c) => c.id === claimId);
        const wave = claim
          ? s.waves.find((w) => w.id === claim.waveId)
          : undefined;
        // 席位释放 → 候补首位自动补位转正（占位即付）
        // ① 成局前退出拼位（joined）→ 补位者占座（joined，局仍 active）
        // ② 成局后让位（accepted，履约开始前）→ 补位者直接转正（accepted，局保持 assembled）
        const releasingAccepted =
          claim?.status === "accepted" &&
          wave?.status === "assembled" &&
          !claim.serviceDoneAt;
        const releasingJoined = claim?.status === "joined";
        const canPromote =
          (releasingJoined || releasingAccepted) &&
          !!wave &&
          (wave.waitlist?.length ?? 0) > 0;
        const promoted = canPromote
          ? promoteFromWaitlistLogic(
              wave!,
              nextId("claim"),
              Date.now(),
              undefined,
              releasingAccepted
            )
          : undefined;
        const promotedClaim = promoted?.claim;
        // 成局让位 → 按 24h 档位退让位者拼位份额（与 cancelOpenWave 同退款车道）
        const releaseRefund =
          releasingAccepted && promotedClaim && claim
            ? refundByTier({
                waveId: claim.waveId,
                orders: s.payOrders,
                startsAt: wave!.startsAt,
                hasSeats: true,
              })
            : undefined;
        const releaseRefundMap = new Map(
          (releaseRefund?.refunded ?? []).map((o) => [o.id, o])
        );
        set((st) => ({
          claims: [
            ...st.claims.map((c) => (c.id === claimId ? withdrawClaim(c) : c)),
            ...(promotedClaim ? [promotedClaim] : []),
          ],
          // 撤单 → 协商未成，隐私号会话回收
          privacySessions: claim
            ? revokeSession(st.privacySessions, claim.waveId, Date.now())
            : st.privacySessions,
          waves: promoted
            ? st.waves.map((w) =>
                w.id === promoted.wave.id
                  ? {
                      ...promoted.wave,
                      // 补位也是真实加入：拼位裂变计一次（按人去重）
                      ...fissionStamp(w, promotedClaim!.responderId, Date.now()),
                    }
                  : w
              )
            : st.waves,
          payOrders: [
            // 成局让位 → 让位者份额按 24h 档位退（refunded 状态）
            ...(releaseRefund?.refunded ?? []),
            // 补位转正 → 占位即付自己的份（成局前/成局让位同规则）
            ...(promotedClaim
              ? [
                  capturePayOrder(
                    createPayOrder({
                      id: nextId("pay"),
                      waveId: promotedClaim.waveId,
                      payerId: promotedClaim.responderId,
                      amount: promotedClaim.price ?? perSeatPrice(wave!),
                    })
                  ),
                ]
              : []),
            // 其余原流水（把被退的订单替换为 refunded 版本）
            ...st.payOrders.map((o) => releaseRefundMap.get(o.id) ?? o),
          ],
          pushes: promotedClaim
            ? [
                {
                  id: `waitlist-promoted:${promotedClaim.id}`,
                  waveId: promotedClaim.waveId,
                  toId: promotedClaim.responderId,
                  score: 100,
                  customHits: 0,
                  customTotal: 0,
                  reason: "waitlist-promoted",
                  at: Date.now(),
                  read: false,
                },
                ...st.pushes,
              ].slice(0, 60)
            : st.pushes,
        }));
      },

      addGuest: ({ claimId, guest }) => {
        const s = get();
        const claim = s.claims.find((c) => c.id === claimId);
        if (!claim) return { ok: false, error: "claim-not-found" };
        // 携伴者年龄合规：<14 无监护人同意 → 拦截（未保法 §72）；
        // 儿童仅陪同不可参与任何动作（携伴不涉资金，按免费动作 respond 校验）。
        if (guest.birthYear != null) {
          const age = ageFromBirthYear(guest.birthYear, new Date().getFullYear());
          const gate = ageGate({
            age,
            action: "respond",
            guardianConsent: guest.guardianConsent,
          });
          if (gate.blocked) {
            return { ok: false, error: `guest.age-blocked:${gate.reason}` };
          }
        }
        const r = addGuestLogic(claim, guest);
        if (!r.ok) return { ok: false, error: r.error };
        set((st) => ({
          claims: st.claims.map((c) => (c.id === claimId ? r.claim : c)),
        }));
        return { ok: true };
      },

      removeGuest: (claimId, guestIdx) =>
        set((st) => ({
          claims: st.claims.map((c) =>
            c.id === claimId ? removeGuestLogic(c, guestIdx) : c
          ),
        })),

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
          return {
            waves: s.waves.map((w) => (w.id === waveId ? closeWave(w) : w)),
            // 需求取消 → 已分配隐私号会话回收
            privacySessions: revokeSession(s.privacySessions, waveId, Date.now()),
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

      toggleFavorite: (waveId) =>
        set((s) => ({
          favorites: s.favorites.includes(waveId)
            ? s.favorites.filter((id) => id !== waveId)
            : [waveId, ...s.favorites],
        })),

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

      raiseCrisis: ({ level, note, waveId, contacts }) => {
        const s = get();
        const { record } = raiseCrisisLogic(
          s.crisisRecords,
          useIdentityStore.getState().identity.id,
          level,
          note,
          Date.now(),
          waveId
        );
        const { record: notified, targets } = notifyForLogic(record, contacts);
        set((st) => ({
          crisisRecords: [...st.crisisRecords.map((r) => (r.id === record.id ? notified : r)), notified],
        }));
        return { record: notified, targets };
      },

      resolveCrisis: (id) =>
        set((s) => ({ crisisRecords: resolveCrisisLogic(s.crisisRecords, id, Date.now()) })),

      requestForget: (kind) => {
        const s = get();
        const out = requestForgetLogic(
          s.forgetRequests,
          useIdentityStore.getState().identity.id,
          kind,
          Date.now()
        );
        if (out.fresh) set({ forgetRequests: out.requests });
        return { req: out.req, fresh: out.fresh };
      },

      askBi: (text) => {
        const s = get();
        if (!/违约|收益|收入|流水|评价|评分|裂变|争议|成交|统计|汇总|数据情况|多少单|几个需求|几个局/.test(text)) {
          return null;
        }
        const rows: BiRow[] = [];
        for (const w of s.waves) {
          rows.push({
            authorId: w.authorId,
            category: w.basics.category,
            createdAt: w.createdAt,
            fissionCount: w.fissionCount,
          });
        }
        for (const c of s.claims) {
          const w = s.waves.find((x) => x.id === c.waveId);
          rows.push({
            authorId: c.responderId,
            category: w?.basics.category ?? "其他",
            createdAt: c.createdAt,
            amount: c.fulfilledAt ? (c.price ?? 0) : undefined,
            violation: c.status === "breached",
          });
        }
        for (const r of s.reviews) {
          rows.push({
            authorId: r.fromId,
            category: "评价",
            createdAt: r.at,
            reviewStar: r.score,
          });
        }
        for (const d of s.disputes) {
          const w = s.waves.find((x) => x.id === d.claimId || s.claims.some((c) => c.id === d.claimId && c.waveId === x.id));
          rows.push({
            authorId: w?.authorId ?? "争议",
            category: "争议",
            createdAt: d.createdAt,
          });
        }
        return runBi(parseBiQuery(text), rows, Date.now());
      },

      allocatePrivacy: (waveId, aId, bId) =>
        set((s) => {
          const r = allocatePair(s.privacySessions, DEMO_POOL, waveId, aId, bId, Date.now());
          return { privacySessions: r.sessions };
        }),

      revokePrivacy: (waveId) =>
        set((s) => ({ privacySessions: revokeSession(s.privacySessions, waveId, Date.now()) })),

      sendIm: (fromId, toId, text, waveId) => {
        // 弱网离线队列（ADR-0014 N11 接线）：离线时消息入队缓冲，恢复后重放。
        if (typeof navigator !== "undefined" && navigator.onLine === false) {
          set((s) => {
            const payload = JSON.stringify({ fromId, toId, text, waveId: waveId ?? null });
            const out = enqueueOp(s.offlineQueue, { kind: "sendIm", payload }, Date.now());
            return { offlineQueue: out.q };
          });
          return;
        }
        set((s) => {
          const r = sendMsg(s.imThreads, s.imMessages, fromId, toId, text, Date.now(), waveId);
          return { imThreads: r.threads, imMessages: r.messages };
        });
      },

      syncOrderOp: (op) => {
        // 先入队（幂等去重：同 kind+payload 未完成不重复）再立即冲刷
        const { q, item } = enqueueOp(get().offlineQueue, op, Date.now());
        set({ offlineQueue: q });
        void flushOrderOp(op).then((ok) => {
          set({ offlineQueue: markQueuePlayed(get().offlineQueue, item.id, ok, Date.now()) });
        });
      },

      replayQueue: async () => {
        const s = get();
        const items = queueDue(s.offlineQueue, Date.now());
        if (items.length === 0) return;
        let queue = s.offlineQueue;
        const stillOffline =
          typeof navigator !== "undefined" && navigator.onLine === false;
        for (const item of items) {
          let ok = !stillOffline;
          if (ok) {
            if (
              item.op.kind === "order-publish" ||
              item.op.kind === "order-transition"
            ) {
              // Step 2 接电：权威库同步 op 走真实网络冲刷（幂等键防服务端重复）
              ok = await flushOrderOp(item.op);
            } else {
              const payload = JSON.parse(item.op.payload) as {
                fromId: string;
                toId: string;
                text: string;
                waveId: string | null;
              };
              get().sendIm(payload.fromId, payload.toId, payload.text, payload.waveId ?? undefined);
            }
          }
          queue = markQueuePlayed(queue, item.id, ok, Date.now());
        }
        set({ offlineQueue: queue });
      },

      markImRead: (threadId, whoId) =>
        set((s) => ({ imThreads: markRead(s.imThreads, threadId, whoId) })),
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
          favorites: [],
      initiatorBuffs: {},
      sentinelEvents: [],
      privacySessions: [],
      imThreads: [],
      imMessages: [],
          disputes: [],
          friendRequests: [],
          friendships: [],
          friendRequestRemovals: [],
          crisisRecords: [],
          forgetRequests: [],
          circuitBreaker: { state: "closed", failures: 0, probes: 0, openedAt: 0 },
          offlineQueue: [],
          lake: [],
          signedDocs: [],
          policies: [],
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
          favorites: s.favorites,
          initiatorBuffs: s.initiatorBuffs,
          disputes: s.disputes,
          // P2 缺陷 3 修复：履约回写位持久化（W5 五态流转终局落库），
          // 刷新后 SETTLED 终局不倒退回 MATCHED。
          fulfilment: s.fulfilment,
          friendRequests: s.friendRequests,
          friendships: s.friendships,
          friendRequestRemovals: s.friendRequestRemovals,
          privacySessions: s.privacySessions,
          imThreads: s.imThreads,
          imMessages: s.imMessages,
          crisisRecords: s.crisisRecords,
          forgetRequests: s.forgetRequests,
          circuitBreaker: s.circuitBreaker,
          offlineQueue: s.offlineQueue,
          lake: s.lake,
          signedDocs: s.signedDocs,
          policies: s.policies,
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