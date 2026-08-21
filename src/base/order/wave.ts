/**
 * Signal-wave model for the P2P broadcast loop. Pure + unit-testable.
 *
 * A demand ("signal wave") is a short-lived, broadcast-only unit of intent:
 *   base essentials (category/time/area — hard filter),
 *   custom conditions (软加权 / soft: surfaced as attention callouts),
 *   an expiry, and a claim story.
 *
 * Claim model — "谁确认接单，单子就是谁的":
 *   - direct claim (甲): responder hits accept, wave locks immediately.
 *   - negotiation (丙): each pair (demander ↔ responder) gets 3 offer/counter
 *     rounds; beyond that the offer is locked to accept / withdraw.
 *   - 开放局 (open match, capacity ≥ 2): responders 拼位 (joinSeat) instead of
 *     claiming the whole wave. Each joiner holds one seat as a "joined" claim;
 *     once the table fills (joiners = capacity − 1, the demander counts first)
 *     the wave auto-assembles (status assembled, joined → accepted). The
 *     demander can also assemble early once at least one seat is taken.
 *   - 鸽子险 (deposit): when wave.deposit is set, the locking claim carries a
 *     DepositPhase — held on lock, released / paid out / refunded at verdict.
 */

import type { DepositPhase } from "../money/deposit";
import type { Fulfilment } from "./fulfilment";
import type { TaskModuleState } from "./moduleFulfilment";
import type { GuestInfo } from "./guest";

export interface WaveBasics {
  /** Service category, e.g. "厨师 · 上门做饭" / "羽毛球". Hard-filter key. */
  category: string;
  /** When the service should start, e.g. "明天 11:00". */
  time: string;
  /** Where it should happen, e.g. "幸福家园小区". */
  area: string;
  /** Coverage radius the demander is willing to travel, km. */
  radiusKm: number;
  /** Optional explicit geo point (P3 map). Absent → deterministic fallback. */
  geo?: { lat: number; lng: number };
}

export interface WaveCustom {
  /** Human text from the demander, e.g. "30 岁左右女性厨师". */
  text: string;
  /** Keywords a responder capability can match against. */
  tags: string[];
}

/** Wave lifecycle. claimed = someone accepted; locked = negotiation closed. */
export type WaveStatus =
  | "pending"
  | "active"
  | "claimed"
  | "locked"
  | "assembled"
  | "closed"
  | "expired";

export interface Wave {
  id: string;
  authorId: string;
  basics: WaveBasics;
  budget: number;
  customs: WaveCustom[];
  /** Filled demander "磋商" dialog → claimers may negotiate price. */
  negotiable: boolean;
  negotiableNote?: string;
  /** 鸽子险: responder holds a deposit when the deal locks. */
  deposit?: boolean;
  /** 平台下架标记 — removed by moderation; hidden from the feed. */
  removed?: boolean;
  /** How many people this demand expects (1 = solo, ≥2 = 开放局 open match). */
  capacity: number;
  /** 发起人 no-show buff：该局所需拼位数减 N（成局面降标准）。 */
  buffSeats?: number;
  expiresAt: number;
  /** Structured service start time (epoch) — powers 24h tiered cancellation. */
  startsAt?: number;
  createdAt: number;
  status: WaveStatus;
  /** 1:1 claim owner (solo waves only). Open-match waves track seats, not one owner. */
  claimedById?: string;
  /** 复杂任务：LLM 拆分 + 发起人确认的模块定义（接单后锁定不可增删）。 */
  modules?: import("../ai/decompose").TaskModule[];
  /** 虚拟兴趣计数（热度来源；物理机制保持分离）。 */
  hotness?: number;
  /**
   * 弹药标识（W1 总装）：发布时经 getAmmoDefinition(category) 反查写入，
   * 供履约座舱按 ammoId 装载场景插槽（housekeeping-v1 / meetup-social-v1 …）。
   */
  ammoId?: string;
  /**
   * 需求方非标定制要求（阶段3 语义驯化产物 · 宪法条文 #2 增补不改义）：
   * 发单端注入的中性化定制契约，履约座舱 / 供给端准入 / 运行时风控消费。
   * 可选字段，缺省 undefined（既有 Wave 构建零破坏）。
   */
  customRequirements?: import("../../types/ammo-schema.ts").INormalizedCustomIntent;
  /**
   * 动态表单参数快照（P1-5 声明式表单闭环 · 宪法 #2 只增补）：
   * PublishSheet 按 ammo.holographic.formSchema 声明式驱动收集的
   * 结构化业务参数（如 { applianceType: "空调", faultDescription: "不制冷" }），
   * 随单落库供履约插槽回显（DynamicAmmoSlot / HousekeepingSlot 参数胶囊）。
   * 可选字段，缺省 undefined 向后兼容（既有 Wave 零破坏）。
   */
  bizParams?: Record<string, unknown>;
  /** 拼位裂变：真实拉新次数（有回应/成局才 +1，纯分享不计 → 防自刷）。 */
  fissionCount?: number;
  /** 分享方（发起人）匿名 id 列表，同一分享者只计一次。 */
  fissionBy?: string[];
  /** 裂变最后一次真实增量时间（系统通知 diff 用；无增量时 undefined）。 */
  fissionUpdatedAt?: number;
  /** 组织者把关层（Request to spot，对标 Meetup 成员审批）：true 时拼位须先申请、发起人审批后才占座。 */
  needApproval?: boolean;
  /** 待审批的拼位申请（responderId → 申请时刻）。审批通过才占用座位。 */
  joinRequests?: Array<{ responderId: string; at: number }>;
  /** 候补队列（开放局满员后加入；有人退出/撤单时按序自动补位转正）。 */
  waitlist?: Array<{ responderId: string; at: number }>;
  /** 公开竞价结算（P8 商业化）：组局主开标后写回真实局，持久可见。 */
  biddingSettled?: {
    winnerId: string;
    winnerName: string;
    price: number;
    feeYuan: number;
    netYuan: number;
    at: number;
  };
}

export type ClaimStatus =
  | "offered"
  | "negotiating"
  | "joined"
  | "accepted"
  | "withdrawn"
  | "breached";

/** Who sent the latest offer/message in a negotiation pair. */
export type ClaimActor = "responder" | "demander";

export interface Claim {
  id: string;
  waveId: string;
  responderId: string;
  status: ClaimStatus;
  /** Negotiation rounds already used (max MAX_ROUNDS per pair). */
  rounds: number;
  /** Current quoted price (after customs are accounted). */
  price?: number;
  /** Last message exchanged in the negotiation. */
  lastMessage?: string;
  /** Who made the last move — alternation is enforced by counterOffer. */
  lastBy?: ClaimActor;
  /** 鸽子险 phase on this claim (held once the deal locks). */
  depositPhase?: DepositPhase;
  /** Responder reported the job done (Request payment — opens the gate). */
  serviceDoneAt?: number;
  /** 验收记录 — demander confirmed (or auto-released after 72h). */
  fulfilment?: Fulfilment;
  /** 模块化履约（复杂任务）：独立模块各自的 申报/确认 状态。 */
  modules?: TaskModuleState[];
  /** Fulfilment confirmed by the demander (starts the 72h review window). */
  fulfilledAt?: number;
  /** Who already reviewed this claim (idempotency). */
  reviewedBy?: string[];
  /** no-show 欠款已结清（解除发波/拼位锁定）。 */
  settled?: boolean;
  /** 携伴登记（Meetup 吸收项 ⑤：每座最多 1 位，实名 + ageGate 合规 + 电话脱敏）。 */
  guests?: GuestInfo[];
  createdAt: number;
}

export const MAX_ROUNDS = 3;

export interface CreateWaveInput {
  id: string;
  authorId: string;
  basics: WaveBasics;
  budget: number;
  customs?: WaveCustom[];
  negotiable?: boolean;
  negotiableNote?: string;
  /** 鸽子险: responder holds a deposit when the deal locks. */
  deposit?: boolean;
  /** 开放局: demander counts as first seat, capacity ≥ 2 = open match. */
  capacity?: number;
  /** 发起人 no-show buff 抵扣拼位数（成局面降标准）。 */
  buffSeats?: number;
  /** 组织者把关层：true = 拼位需申请并获发起人审批（开放局可用）。 */
  needApproval?: boolean;
  /** TTL in ms from now, or absolute epoch — after it the wave expires. */
  expiresAt: number;
  /** Structured service start time (epoch) — powers 24h tiered cancellation. */
  startsAt?: number;
  /** 随单支付：true = 建单即 pending(待支付)，支付完成才 active。 */
  pending?: boolean;
  /** 复杂任务：发起人确认的模块定义（接单后锁定）。 */
  modules?: import("../ai/decompose").TaskModule[];
  createdAt: number;
  hotness?: number;
  /** 弹药标识（可选；发布时按品类反查写入，见 getAmmoDefinition）。 */
  ammoId?: string;
  /**
   * 需求方非标定制要求（阶段3 语义驯化产物 · 宪法条文 #2 增补不改义）：
   * 发单端（ChatPage/PublishSheet）将 intent-normalizer 清洗后的中性契约
   * 随单固化，履约座舱与插槽按此渲染定制标签与运行时风控升级。
   * 可选字段，缺省 undefined（既有调用零破坏）。
   */
  customRequirements?: import("../../types/ammo-schema.ts").INormalizedCustomIntent;
  /**
   * 动态表单参数快照（P1-5 声明式表单闭环 · 宪法 #2 只增补）：
   * PublishSheet 按 ammo.holographic.formSchema 声明式驱动收集，
   * 结构化写入 wave.bizParams 供履约插槽回显。
   */
  bizParams?: Record<string, unknown>;
}

/** Build a wave; validates essential fields (basic needs must be complete). */
export function createWave(input: CreateWaveInput): Wave {
  const { basics } = input;
  if (!basics.category.trim() || !basics.time.trim() || !basics.area.trim()) {
    throw new Error("wave.basics.incomplete");
  }
  if (!Number.isFinite(input.budget) || input.budget <= 0) {
    throw new Error("wave.budget.invalid");
  }
  return {
    id: input.id,
    authorId: input.authorId,
    basics,
    budget: Math.round(input.budget),
    customs: input.customs ?? [],
    negotiable: input.negotiable ?? false,
    negotiableNote: input.negotiableNote,
    deposit: input.deposit ?? false,
    capacity: input.capacity ?? 1,
    buffSeats: input.buffSeats,
    needApproval: input.needApproval ?? false,
    joinRequests: input.needApproval ? [] : undefined,
    modules: input.modules,
    expiresAt: input.expiresAt,
    startsAt: input.startsAt,
    createdAt: input.createdAt,
    status: input.pending ? "pending" : "active",
    hotness: input.hotness ?? 0,
    ammoId: input.ammoId,
    customRequirements: input.customRequirements,
    bizParams: input.bizParams,
  };
}

/**
 * 支付完成：pending(未付/待支付) → active(已上线、进入广播)。
 * 随单支付规则：单子的钱到位才激活；否则永远是 pending（不广播、不可响应）。
 */
export function activateWave(wave: Wave): Wave {
  if (wave.status !== "pending") {
    throw new Error(`wave.not-pending: ${wave.status}`);
  }
  return { ...wave, status: "active" };
}

export function isWaveExpired(wave: Wave, now: number): boolean {
  return wave.expiresAt < now;
}

/** Close a wave from the demander (e.g. "already found someone"). */
export function closeWave(wave: Wave): Wave {
  return { ...wave, status: "closed" };
}

/**
 * 甲·直接接单: responder accepts without negotiating → wave claimed by them.
 * Returns the updated wave and claim. A wave can only be claimed while active.
 */
export function claimDirect(
  wave: Wave,
  responderId: string,
  claimId: string,
  price?: number,
  createdAt = Date.now()
): { wave: Wave; claim: Claim } {
  if (wave.status !== "active") {
    throw new Error("wave.not-active");
  }
  if (isOpenMatch(wave)) {
    throw new Error("wave.open-match-use-join");
  }
  const claim: Claim = {
    id: claimId,
    waveId: wave.id,
    responderId,
    status: "accepted",
    rounds: 0,
    price,
    createdAt,
    depositPhase: wave.deposit ? "held" : undefined,
  };
  return { wave: { ...wave, status: "claimed", claimedById: responderId }, claim };
}

/**
 * 丙 磋商入口: responder opens a negotiation offer. Requires wave negotiable,
 * else claiming must be done via claimDirect.
 */
export function openNegotiation(
  wave: Wave,
  responderId: string,
  claimId: string,
  price: number,
  createdAt = Date.now()
): Claim {
  if (!wave.negotiable) {
    throw new Error("wave.not-negotiable");
  }
  if (wave.status !== "active") {
    throw new Error("wave.not-active");
  }
  if (!Number.isFinite(price) || price <= 0) {
    throw new Error("claim.price.invalid");
  }
  return {
    id: claimId,
    waveId: wave.id,
    responderId,
    status: "negotiating",
    rounds: 1,
    price: Math.round(price),
    lastBy: "responder",
    createdAt,
  };
}

/** Who is expected to move next for this pair. */
export function nextSpeaker(claim: Claim): ClaimActor {
  return claim.lastBy === "demander" ? "responder" : "demander";
}

/**
 * Advance a negotiation pair by one round. Alternation is enforced: the
 * caller of the current round must be the other side (same-side countering
 * throws). Returns updated claim, or throws when the 3-round budget is
 * exhausted (locked). Locked claims can only accept / withdraw.
 */
export function counterOffer(
  claim: Claim,
  price: number,
  message: string,
  actor: ClaimActor = nextSpeaker(claim)
): Claim {
  if (!Number.isFinite(price) || price <= 0) {
    throw new Error("claim.price.invalid");
  }
  if (claim.status !== "negotiating" && claim.status !== "offered") {
    throw new Error("claim.not-negotiating");
  }
  if (actor === claim.lastBy) {
    throw new Error("claim.same-side");
  }
  if (claim.rounds >= MAX_ROUNDS) {
    throw new Error("claim.rounds-exhausted");
  }
  return {
    ...claim,
    status: "negotiating",
    rounds: claim.rounds + 1,
    price: Math.round(price),
    lastMessage: message,
    lastBy: actor,
  };
}

/**
 * Lock a negotiation — called for a claim that exhausted its rounds, or when
 * the demander explicitly locks; from here the responder can only accept
 * (claim becomes accepted → wave claimed) or withdraw.
 */
export function lockNegotiation(
  wave: Wave,
  claim: Claim,
  demanderAccepted: boolean
): { wave?: Wave; error?: string } {
  if (claim.status === "accepted") {
    return { wave: { ...wave, status: "claimed", claimedById: claim.responderId } };
  }
  if (demanderAccepted) {
    return {
      wave: { ...wave, status: "claimed", claimedById: claim.responderId },
    };
  }
  return { error: "demander-declined" };
}

/** Responder walks away (or refuses after lock). */
export function withdrawClaim(claim: Claim): Claim {
  return { ...claim, status: "withdrawn" };
}

/** Mark a claim breached (didn't fulfil the order). */
export function breachClaim(claim: Claim): Claim {
  return { ...claim, status: "breached" };
}

/* ---------------------------------------------------------------------------
 * 开放局 / 拼位 (Open Match, Playtomic-style)
 *
 * capacity ≥ 2 → the demander counts as the first seat; the wave needs
 * capacity − 1 joiners. Each joiner reserves a seat via `joinSeat` (claim
 * status "joined"); the wave does NOT lock until the table fills. When the
 * last seat is taken the wave assembles: status "assembled" and every joined
 * claim becomes "accepted" (then the normal fulfilment/review loop applies).
 * The demander may also assemble early once at least one seat is taken.
 * ------------------------------------------------------------------------- */

/** Open match when the demander wants a group (capacity ≥ 2). */
export function isOpenMatch(wave: Pick<Wave, "capacity">): boolean {
  return wave.capacity >= 2;
}

/** How many joiners an open match needs (buff −1 per no-show compensation). */
export function neededJoiners(
  wave: Pick<Wave, "capacity" | "buffSeats">
): number {
  return Math.max(0, wave.capacity - 1 - (wave.buffSeats ?? 0));
}

/** Per-seat price = budget ÷ capacity (each participant pays their share). */
export function perSeatPrice(wave: Pick<Wave, "budget" | "capacity">): number {
  return Math.max(1, Math.round(wave.budget / Math.max(1, wave.capacity)));
}

/**
 * 拼位: a responder reserves one seat of an open match. Requires an active
 * open match (capacity ≥ 2) with a free seat. Returns the wave (still active
 * until the table fills, assembled once the last seat is taken) and the new
 * claim (status "joined", or "accepted" when this join completes the table).
 * Throws instead of mutating on invalid states.
 */
export function joinSeat(
  wave: Wave,
  responderId: string,
  claimId: string,
  joinedCount: number,
  createdAt = Date.now()
): { wave: Wave; claim: Claim } {
  if (!isOpenMatch(wave)) {
    throw new Error("wave.not-open-match");
  }
  if (wave.status !== "active" && wave.status !== "assembled") {
    throw new Error("wave.not-active");
  }
  if (wave.status === "assembled") {
    throw new Error("wave.assembled");
  }
  if (joinedCount >= neededJoiners(wave)) {
    throw new Error("wave.full");
  }
  const price = perSeatPrice(wave);
  const full = joinedCount + 1 >= neededJoiners(wave);
  const claim: Claim = {
    id: claimId,
    waveId: wave.id,
    responderId,
    status: full ? "accepted" : "joined",
    rounds: 0,
    price,
    createdAt,
    depositPhase: full && wave.deposit ? "held" : undefined,
  };
  return {
    wave: {
      ...wave,
      status: full ? "assembled" : "active",
    },
    claim,
  };
}

/**
 * 组织者把关层（Request to spot）：开放局发起人开启审批制（needApproval）后，
 * 拼位者先提交申请（入 joinRequests），不占实际座位、不付钱；发起人审批通过
 * 才走 joinSeat 占座 + 押金。幂等：同人重复申请不叠加。
 */
export function requestSeat(
  wave: Wave,
  responderId: string,
  now = Date.now()
): { wave: Wave } {
  if (!wave.needApproval) {
    throw new Error("wave.approval-off");
  }
  if (wave.status !== "active") {
    throw new Error("wave.not-active");
  }
  const exists = (wave.joinRequests ?? []).some(
    (r) => r.responderId === responderId
  );
  if (exists) {
    return { wave };
  }
  return {
    wave: {
      ...wave,
      joinRequests: [...(wave.joinRequests ?? []), { responderId, at: now }],
    },
  };
}

/**
 * 审批某申请：通过 → 复用 joinSeatLogic 占座（满员即成局）；拒绝 → 从申请列表移除。
 * 返回当前申请的 claim（如已占座/成局）、更新后的 wave。
 */
export function approveRequest(
  wave: Wave,
  responderId: string,
  claimId: string,
  joinedCount: number,
  now = Date.now()
): { wave: Wave; claim?: Claim; error?: string } {
  if (!wave.needApproval) {
    return { error: "wave.approval-off", wave };
  }
  const requested = (wave.joinRequests ?? []).some(
    (r) => r.responderId === responderId
  );
  if (!requested) {
    return { error: "wave.no-request", wave };
  }
  const remaining = (wave.joinRequests ?? []).filter(
    (r) => r.responderId !== responderId
  );
  // 审批就是占座：座位被占满/已成局时拒绝该请求。
  if (wave.status !== "active" || joinedCount >= neededJoiners(wave)) {
    return { error: "wave.full", wave: { ...wave, joinRequests: remaining } };
  }
  try {
    const out = joinSeat(wave, responderId, claimId, joinedCount, now);
    return {
      wave: { ...out.wave, joinRequests: remaining },
      claim: out.claim,
    };
  } catch (e) {
    return { error: e instanceof Error ? e.message : "approve-failed", wave: { ...wave, joinRequests: remaining } };
  }
}

/**
 * 拒绝某申请（或收回已批准）：只从申请列表移除，不占座、无副作用。
 */
export function rejectRequest(
  wave: Wave,
  responderId: string
): { wave: Wave } {
  return {
    wave: {
      ...wave,
      joinRequests: (wave.joinRequests ?? []).filter(
        (r) => r.responderId !== responderId
      ),
    },
  };
}

/* ---------------------------------------------------------------------------
 * 候补（waitlist，对标 Meetup 候补转正）
 *
 * 开放局满员后，仍想加入的响应者进入候补队列（wave.waitlist，FIFO）。
 * 有人退出拼位/撤单释放座位时，按序自动补位转正（promoteFromWaitlist），
 * 由 store 侧生成 joined claim 并收取拼位份额。
 * 候补是 wave 级队列，不占 ClaimStatus 枚举（宪法 #2 接口保守）。
 * ------------------------------------------------------------------------- */

/** 候补排序：FIFO 为主；同一时刻加入的按信用分降序补位（对齐「按序/信用分补位」）。 */
export function sortWaitlist(
  list: Array<{ responderId: string; at: number }>,
  scoreOf?: (responderId: string) => number
): Array<{ responderId: string; at: number }> {
  return [...list].sort((a, b) => {
    if (a.at !== b.at) return a.at - b.at;
    if (scoreOf) return (scoreOf(b.responderId) ?? 0) - (scoreOf(a.responderId) ?? 0);
    return 0;
  });
}

/** 进入候补（幂等：已在队列不重复追加）。要求活跃的开放局或已成局开放局（成局后入队 = 等让位）。 */
export function joinWaitlist(
  wave: Wave,
  responderId: string,
  now = Date.now()
): { wave: Wave } {
  if (!isOpenMatch(wave)) {
    throw new Error("wave.not-open-match");
  }
  if (wave.status !== "active" && wave.status !== "assembled") {
    throw new Error("wave.not-active");
  }
  if ((wave.waitlist ?? []).some((r) => r.responderId === responderId)) {
    return { wave };
  }
  return {
    wave: {
      ...wave,
      waitlist: [...(wave.waitlist ?? []), { responderId, at: now }],
    },
  };
}

/** 主动退出候补（幂等）。 */
export function leaveWaitlist(
  wave: Wave,
  responderId: string
): { wave: Wave } {
  return {
    wave: {
      ...wave,
      waitlist: (wave.waitlist ?? []).filter(
        (r) => r.responderId !== responderId
      ),
    },
  };
}

/**
 * 补位转正：队列首位升格为正式拼位——成局前（joined 退出）升为 joined 占座，
 * 成局让位（acceptDirect）直接升为 accepted（席位立即补齐，局保持 assembled）。
 * 队列排序按 sortWaitlist（FIFO + 同刻信用分降序）。无候补时原样返回。
 */
export function promoteFromWaitlist(
  wave: Wave,
  claimId: string,
  now = Date.now(),
  scoreOf?: (responderId: string) => number,
  acceptDirect = false
): { wave: Wave; claim?: Claim } {
  const list = sortWaitlist(wave.waitlist ?? [], scoreOf);
  if (list.length === 0) return { wave };
  const [first] = list;
  const remaining = list.slice(1);
  const price = perSeatPrice(wave);
  const claim: Claim = {
    id: claimId,
    waveId: wave.id,
    responderId: first.responderId,
    status: acceptDirect ? "accepted" : "joined",
    rounds: 0,
    price,
    createdAt: now,
    depositPhase: wave.deposit ? "held" : undefined,
  };
  return {
    wave: {
      ...wave,
      waitlist: remaining.length > 0 ? remaining : undefined,
    },
    claim,
  };
}

/**
 * 成局: the demander closes the open match early (at least one seat taken).
 * All joined claims become accepted; the wave locks to the current roster.
 * Returns the updated wave + the list of claims that transitioned.
 */
export function assembleWave(
  wave: Wave,
  claims: Claim[]
): { wave: Wave; claims: Claim[] } {
  if (!isOpenMatch(wave)) {
    throw new Error("wave.not-open-match");
  }
  if (wave.status !== "active") {
    throw new Error("wave.not-active");
  }
  const joined = claims.filter(
    (c) => c.waveId === wave.id && c.status === "joined"
  );
  if (joined.length === 0) {
    throw new Error("wave.no-seats");
  }
  const joinedIds = new Set(joined.map((j) => j.id));
  const locked: Claim[] = claims.map((c) =>
    joinedIds.has(c.id)
      ? {
          ...c,
          status: "accepted",
          depositPhase: wave.deposit ? "held" : c.depositPhase,
        }
      : c
  );
  return { wave: { ...wave, status: "assembled" }, claims: locked };
}

/**
 * 开放局 no-show（付了全款没来）：款不退，改为——
 *   ① 分摊补偿给在场其他玩家（每人 = floor(noShow金额 ÷ 在场人数)）
 *   ② 发起人获得「下次成局面降标准」buff（neededJoiners −1）
 * 纯函数：只计算分摊名单与是否发 buff，钱的实际移动由调用方（store）
 * 通过 payOrders 记账。
 */
export function resolveNoShow(input: {
  wave: Wave;
  /** The breached claim (no-show seat). */
  claim: Claim;
  /** Other accepted claims that did show up (beneficiaries). */
  attendees: Claim[];
  /** no-show 已支付金额（= 该座位人均价）。 */
  paidAmount: number;
}): {
  breachClaim: Claim;
  /** claimId → 补偿金额（进钱包）。 */
  compensations: Record<string, number>;
  /** 发起人下次发局立减所需拼位数（buff）。 */
  initiatorBuff: number;
} {
  const { wave, claim, attendees, paidAmount } = input;
  if (wave.status !== "assembled") {
    throw new Error("wave.not-assembled");
  }
  if (claim.status !== "accepted") {
    throw new Error("claim.not-accepted");
  }
  const recipients = attendees.filter((a) => a.id !== claim.id);
  const perShare =
    recipients.length > 0 ? Math.floor(paidAmount / recipients.length) : 0;
  const compensations: Record<string, number> = {};
  for (const r of recipients) {
    compensations[r.id] = perShare;
  }
  return {
    breachClaim: { ...claim, status: "breached" },
    compensations,
    initiatorBuff: 1,
  };
}