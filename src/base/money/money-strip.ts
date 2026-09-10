/**
 * 资金五态条纯投影（P2-T2）：只读不动钱（红线：零资金计算逻辑在组件）。
 * 缺数标"同步中"（#10：钱数永不编造）。
 * Pure + unit-testable; no runtime imports.
 */
import type { AtomicFiveState } from "../../types/ammo-schema.ts";

export type MoneyPhase =
  | "await"
  | "held"
  | "service"
  | "review"
  | "settled"
  | "disputed"
  | "refunded";

export interface MoneyStateInput {
  budgetYuan: number;
  fiveState: AtomicFiveState;
  claimPriceYuan?: number;
  fulfilled: boolean;
  settled: boolean;
  openDispute: boolean;
  removed: boolean;
  /** 协商结案金额（原样透出，不解读口径）。 */
  negotiatedAmountYuan?: number;
  /** 爽约保障押金（响应者侧已冻，非需求方支出；有则拆解展示）。 */
  depositYuan?: number;
}

export interface MoneyState {
  phase: MoneyPhase;
  /** 展示金额（¥）；缺数时为 0 且 label 标同步中。 */
  displayYuan: number;
  synced: boolean;
  label: string;
  /** 费用拆解行（有押金才有；只陈述事实，不做资金计算）。 */
  breakdown?: string;
}

function describeCore(input: MoneyStateInput): MoneyState {
  const price = input.claimPriceYuan ?? input.budgetYuan;
  const amount = Number.isFinite(price) && price > 0 ? Math.floor(price) : 0;
  if (amount <= 0) {
    return { phase: "await", displayYuan: 0, synced: false, label: "金额同步中…" };
  }
  if (input.removed) {
    return { phase: "refunded", displayYuan: amount, synced: true, label: `已下架·退款处理中 ¥${amount}` };
  }
  if (input.openDispute) {
    return { phase: "disputed", displayYuan: amount, synced: true, label: `争议冻结 ¥${amount}` };
  }
  if (typeof input.negotiatedAmountYuan === "number" && Number.isFinite(input.negotiatedAmountYuan)) {
    return { phase: "settled", displayYuan: amount, synced: true, label: `协商结算 ¥${amount}·结案金额¥${input.negotiatedAmountYuan}` };
  }
  if (input.settled || input.fiveState === "SETTLED") {
    return { phase: "settled", displayYuan: amount, synced: true, label: `已结算 ¥${amount}` };
  }
  if (input.fulfilled || input.fiveState === "INSPECTED") {
    return { phase: "review", displayYuan: amount, synced: true, label: `待结算 ¥${amount}（验收复核中）` };
  }
  if (input.fiveState === "IN_SERVICE") {
    return { phase: "service", displayYuan: amount, synced: true, label: `托管中 ¥${amount}（服务进行中）` };
  }
  if (input.fiveState === "PUBLISHED") {
    return { phase: "await", displayYuan: amount, synced: true, label: `预算 ¥${amount}·待接单` };
  }
  return { phase: "held", displayYuan: amount, synced: true, label: `托管中 ¥${amount}` };
}

/** 费用拆解（Angi 式信任明示）：服务款＋押金分开讲，先上车后加价的猜疑清零。 */
export function describeMoneyState(input: MoneyStateInput): MoneyState {
  const core = describeCore(input);
  const d = input.depositYuan;
  if (typeof d === "number" && Number.isFinite(d) && d > 0 && core.synced) {
    return {
      ...core,
      breakdown: `服务 ¥${core.displayYuan} · 爽约保障押金 ¥${Math.floor(d)}（师傅已押，非你支出）`,
    };
  }
  return core;
}
