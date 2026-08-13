/**
 * 通用钱包账本（P8 商业化本地闭环）—— 竞价佣金 / 订阅扣费 / 服务收益走同一账本。
 * 纯函数：入账金额计算无 IO 无随机，时间注入，SSR/测试安全。
 */

export type LedgerKind =
  | "penalty"
  | "payout"
  | "deposit"
  | "commission"
  | "subscription"
  | "income";

export interface LedgerEntry {
  id: string;
  kind: LedgerKind;
  /** Negative = money left the wallet; positive = money in. */
  amount: number;
  note: string;
  at: number;
}

export interface LedgerAccount {
  balance: number;
}

/** 应用一笔动账：正数入账即时可用，负数出账不下穿 0。 */
export function applyLedger(
  account: LedgerAccount,
  amount: number
): LedgerAccount {
  return { ...account, balance: Math.max(0, account.balance + amount) };
}

/** 构造账本条目（防呆：同一时间戳/同 kind 批次可幂等覆盖）。 */
export function makeLedgerEntry(
  kind: LedgerKind,
  amount: number,
  note: string,
  at: number
): LedgerEntry {
  return {
    id: `ledger-${at.toString(36)}-${Math.random().toString(36).slice(2, 6)}`,
    kind,
    amount,
    note,
    at,
  };
}