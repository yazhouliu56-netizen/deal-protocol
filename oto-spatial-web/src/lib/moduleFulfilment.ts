/**
 * 模块化履约（module fulfilment）— independent acceptance state machine for
 * complex tasks split into modules by the LLM at publish time.
 *
 *   claim.modules[] each carry their own state:
 *     pending → (responder reports) → done → (demander confirms) → confirmed
 *   Money release: every module confirmed → full release. An unconfirmed
 *   module keeps its weight frozen (refundable on dispute).
 *
 * Kept separate from the single-point `fulfilment` (simple tasks) on purpose —
 * the two models don't share state.
 *
 * Pure + unit-testable; no runtime imports.
 */

import type { Claim } from "./wave";

export type ModuleStatus = "pending" | "done" | "confirmed";

export interface TaskModuleState {
  /** Index into the wave's locked module list. */
  idx: number;
  status: ModuleStatus;
  /** When the responder reported this module done. */
  doneAt?: number;
  /** When the demander confirmed this module. */
  confirmedAt?: number;
}

/** Attach module states to a complex-task claim (created with the claim). */
export function initModuleStates(count: number): TaskModuleState[] {
  return Array.from({ length: count }, (_, i) => ({ idx: i, status: "pending" }));
}

/**
 * Responder reports ONE module done. Modules are reported independently —
 * a complex job is finished module by module, each opening its own gate.
 */
export function reportModule(
  claim: Claim,
  moduleIdx: number,
  now = Date.now()
): Claim {
  const modules = claim.modules;
  if (!modules) throw new Error("module.not-modular");
  const m = modules[moduleIdx];
  if (!m) throw new Error("module.not-found");
  if (m.status !== "pending") throw new Error("module.already-reported");
  const next = modules.map((x) =>
    x.idx === moduleIdx ? { ...x, status: "done" as const, doneAt: now } : x
  );
  return { ...claim, modules: next };
}

/**
 * Demander confirms ONE module's acceptance. The demander may confirm any
 * module that's been reported done; unconfirmed modules stay frozen.
 */
export function confirmModule(
  claim: Claim,
  moduleIdx: number,
  now = Date.now()
): Claim {
  const modules = claim.modules;
  if (!modules) throw new Error("module.not-modular");
  const m = modules[moduleIdx];
  if (!m) throw new Error("module.not-found");
  if (m.status !== "done") throw new Error("module.not-done");
  const next = modules.map((x) =>
    x.idx === moduleIdx ? { ...x, status: "confirmed" as const, confirmedAt: now } : x
  );
  return { ...claim, modules: next };
}

/** All modules confirmed → the whole job is accepted. */
export function allModulesConfirmed(claim: Claim): boolean {
  return !!claim.modules && claim.modules.every((m) => m.status === "confirmed");
}

/** How many modules are confirmed (drives progress UI). */
export function confirmedCount(claim: Claim): number {
  return claim.modules?.filter((m) => m.status === "confirmed").length ?? 0;
}