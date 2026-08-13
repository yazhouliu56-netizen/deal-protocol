/**
 * 履约验收状态机 — fulfilment acceptance for face-to-face services.
 *
 * Flow (aligned with Airtasker's Request payment → Release payment gate):
 *   claimed → responder `requestPayment` (服务完成申报 = "请求放款") →
 *   demander `acceptFulfilment(note)` (验收 + 凭证) → deposit confirmed +
 *   `fulfilledAt` (starts the 72h review window).
 *
 * If the demander never confirms within FULFILMENT_WINDOW_MS of the
 * responder's report, `resolveAutoFulfilment` auto-confirms (1688-style
 * auto-payout), consistent with the P4 default-good-review gate — both sides
 * can't stall the other's money forever. This is a deliberate product
 * decision (ProofWorks explicitly does NOT auto-release).
 *
 * Pure + unit-testable; no runtime imports.
 */

import type { Claim } from "./wave";

export interface Fulfilment {
  /** When the responder reported the job done (Request payment). */
  responderDoneAt: number;
  confirmedBy: "demander" | "auto";
  confirmedAt: number;
  /** 验收凭证 — mandatory short description of what was delivered. */
  note: string;
}

/** 72h: same window as reviews — accept or auto-release. */
export const FULFILMENT_WINDOW_MS = 72 * 60 * 60 * 1000;

/** Responder reports the job done — opens the demander's release gate. */
export function requestPayment(claim: Claim, now = Date.now()): Claim {
  if (claim.status !== "accepted") {
    throw new Error("claim.not-accepted");
  }
  if (claim.serviceDoneAt || claim.fulfilment) {
    throw new Error("fulfilment.already-reported");
  }
  return { ...claim, serviceDoneAt: now };
}

/**
 * Demander accepts the work — release gate. Requires the responder to have
 * reported first (Airtasker rule: posters can't release before a request)
 * and a non-empty acceptance note as evidence.
 */
export function acceptFulfilment(
  claim: Claim,
  note: string,
  now = Date.now()
): Claim {
  if (claim.status !== "accepted") {
    throw new Error("claim.not-accepted");
  }
  if (!claim.serviceDoneAt) {
    throw new Error("fulfilment.not-reported");
  }
  if (claim.fulfilment) {
    throw new Error("fulfilment.already-confirmed");
  }
  if (!note || !note.trim()) {
    throw new Error("fulfilment.note.required");
  }
  return {
    ...claim,
    fulfilment: {
      responderDoneAt: claim.serviceDoneAt,
      confirmedBy: "demander",
      confirmedAt: now,
      note: note.trim().slice(0, 80),
    },
    fulfilledAt: now,
    depositPhase: claim.depositPhase === "held" ? "confirmed" : claim.depositPhase,
  };
}

/**
 * Auto-acceptance: 72h after the responder's report without confirmation the
 * fulfilment resolves in their favour (auto-release). Returns null when not
 * due yet / already resolved. Idempotent.
 */
export function resolveAutoFulfilment(
  claim: Claim,
  now = Date.now()
): Claim | null {
  if (!claim.serviceDoneAt || claim.fulfilment) return null;
  if (now - claim.serviceDoneAt < FULFILMENT_WINDOW_MS) return null;
  return {
    ...claim,
    fulfilment: {
      responderDoneAt: claim.serviceDoneAt,
      confirmedBy: "auto",
      confirmedAt: now,
      note: "72h 未验收，系统自动放款",
    },
    fulfilledAt: now,
    depositPhase: claim.depositPhase === "held" ? "confirmed" : claim.depositPhase,
  };
}

/** Remaining window (ms) before auto-release, 0 when due/absent. */
export function autoFulfilmentRemaining(claim: Claim, now = Date.now()): number {
  if (!claim.serviceDoneAt || claim.fulfilment) return 0;
  return Math.max(0, claim.serviceDoneAt + FULFILMENT_WINDOW_MS - now);
}
