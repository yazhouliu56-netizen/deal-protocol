/**
 * Legacy compat layer. All pure state-machine functions delegate to ProtocolEngine.
 * DB operations extracted to lib/contract/*.
 * New code should import from the specific modules or from engine directly.
 */

// ── Re-export DB operations from split modules ──
export { addContractEvent } from "./contract/events"
export { createRefundTransactions } from "./contract/refund"
export { handleSatisfactionBatch, releaseSatisfactionBatch } from "./contract/satisfaction"
export { checkCancelPenalty } from "./contract/penalty"

// ── Re-export engine wrappers (backward compat for tests) ──
import { getEngine } from "./protocol/engine"

export const FUND_STATUSES = {
  PENDING_HELD: "PENDING_HELD",
  HELD: "HELD",
  COMPLETED: "COMPLETED",
  DISPUTED: "DISPUTED",
  CANCELLED: "CANCELLED",
  SATISFACTION_HELD: "SATISFACTION_HELD",
  SETTLED: "SETTLED",
} as const

export type FundStatus = (typeof FUND_STATUSES)[keyof typeof FUND_STATUSES]

export const SERVICE_STAGES = {
  NOT_ACCEPTED: 0,
  ACCEPTED: 1,
  DEPARTED: 2,
  ARRIVED: 3,
  IN_PROGRESS: 4,
  DONE: 5,
} as const

export type ServiceStage = (typeof SERVICE_STAGES)[keyof typeof SERVICE_STAGES]

import type { TransitionCtx } from "./protocol/types"
export type { TransitionCtx }

export function validateTransition(protocolId: string, action: string, ctx: TransitionCtx): string | null {
  const engine = getEngine(protocolId)
  if (!engine) return `未知协议: ${protocolId}`
  return engine.validateTransition(action, ctx)
}

export function getNextFundStatus(protocolId: string, action: string): string | null {
  const engine = getEngine(protocolId)
  if (!engine) return null
  return engine.getNextFundStatus(action)
}

export function getNextServiceStage(protocolId: string, action: string): number | null {
  const engine = getEngine(protocolId)
  if (!engine) return null
  return engine.getNextServiceStage(action)
}

export function calcRefund(protocolId: string, serviceStage: number, amount: number): { provider: number; customer: number } {
  const engine = getEngine(protocolId)
  if (!engine) return { provider: 0, customer: amount }
  return engine.calcRefund(serviceStage, amount)
}

export function isServiceStageOnlyAction(protocolId: string, action: string): boolean {
  const engine = getEngine(protocolId)
  if (!engine) return false
  return engine.isServiceStageOnlyAction(action)
}

export function getAllowedActions(protocolId: string, fromState: string, role: string): string[] {
  const engine = getEngine(protocolId)
  if (!engine) return []
  return engine.getAllowedActions(fromState, role)
}
