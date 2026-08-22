/**
 * 爽约保障险 (pigeon insurance) — performance deposit loop.
 *
 * Latest agreed rule (2026-08): the demander toggles 爽约保障险 at publish;
 * when a responder claims (direct lock OR negotiation accepted) the platform
 * auto-holds a small deposit from their virtual balance. The deposit is:
 *   - released (refunded) once both sides confirm the service is done,
 *   - paid out to the demander if the responder no-shows (breach, unforgiven),
 *   - refunded in full if the demander forgives a breach.
 * Platform keeps a small service fee on the fulfilment release.
 *
 * Ledger-style: pure functions over `VirtualAccount` — same shape P5's
 * server-side escrow will keep.
 */

import type { VirtualAccount } from "../trust/violation";

export const DEPOSIT_AMOUNT = 5;
export const PLATFORM_FEE = 0.5;

export type DepositPhase = "held" | "confirmed" | "forfeited" | "refunded";

export interface DepositState {
  phase: DepositPhase;
  amount: number;
  at: number;
}

/** Hold a deposit: spendable balance drops, held bucket rises. */
export function holdDeposit(
  account: VirtualAccount,
  amount = DEPOSIT_AMOUNT
): VirtualAccount {
  return {
    ...account,
    balance: Math.max(0, account.balance - amount),
  };
}

/**
 * Fulfilment release: the held deposit returns minus the platform service
 * fee. The "held" bucket is implicit in MVP (a flat deduction on hold),
 * so a release nets amount − fee back into the balance.
 */
export function releaseDeposit(
  account: VirtualAccount,
  amount = DEPOSIT_AMOUNT,
  fee = PLATFORM_FEE
): VirtualAccount {
  return {
    ...account,
    balance: account.balance + Math.max(0, amount - fee),
  };
}

/** Forfeit: deposit does not return (money goes to the platform). */
export function forfeitDeposit(account: VirtualAccount): VirtualAccount {
  return account;
}

/** Payout to the demander when the responder no-shows. */
export function payDepositPayout(
  account: VirtualAccount,
  amount = DEPOSIT_AMOUNT
): VirtualAccount {
  return {
    ...account,
    balance: account.balance + amount,
  };
}

/** Forgiveness refund: full deposit back, no platform fee. */
export function refundDeposit(
  account: VirtualAccount,
  amount = DEPOSIT_AMOUNT
): VirtualAccount {
  return {
    ...account,
    balance: account.balance + amount,
  };
}