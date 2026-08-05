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

import type { DepositPhase } from "./deposit";
import type { Fulfilment } from "./fulfilment";

export interface WaveBasics {
  /** Service category, e.g. "厨师 · 上门做饭" / "羽毛球". Hard-filter key. */
  category: string;
  /** When the service should start, e.g. "明天 11:00". */
  time: string;
  /** Where it should happen, e.g. "幸福家园小区". */
  area: string;
  /** Coverage radius the demander is willing to travel, km. */
  radiusKm: number;
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
  /** Virtual interest counter (hotness-source; physics kept separate). */
  hotness?: number;
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
  /** Fulfilment confirmed by the demander (starts the 72h review window). */
  fulfilledAt?: number;
  /** Who already reviewed this claim (idempotency). */
  reviewedBy?: string[];
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
  /** TTL in ms from now, or absolute epoch — after it the wave expires. */
  expiresAt: number;
  /** Structured service start time (epoch) — powers 24h tiered cancellation. */
  startsAt?: number;
  /** 随单支付：true = 建单即 pending(待支付)，支付完成才 active。 */
  pending?: boolean;
  createdAt: number;
  hotness?: number;
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
    expiresAt: input.expiresAt,
    startsAt: input.startsAt,
    createdAt: input.createdAt,
    status: input.pending ? "pending" : "active",
    hotness: input.hotness ?? 0,
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