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
  | "active"
  | "claimed"
  | "locked"
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
  /** How many people this demand expects (1 = solo). */
  capacity: number;
  expiresAt: number;
  createdAt: number;
  status: WaveStatus;
  claimedById?: string;
  /** Virtual interest counter (hotness-source; physics kept separate). */
  hotness?: number;
}

export type ClaimStatus =
  | "offered"
  | "negotiating"
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
  capacity?: number;
  /** TTL in ms from now, or absolute epoch — after it the wave expires. */
  expiresAt: number;
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
    expiresAt: input.expiresAt,
    createdAt: input.createdAt,
    status: "active",
    hotness: input.hotness ?? 0,
  };
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