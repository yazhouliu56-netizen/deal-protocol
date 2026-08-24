/**
 * 争议处理（dispute）— reason-first adjudication for fulfilment disputes.
 *
 *   Reason split first (fair / transparent / open): the demander picks ONE
 *   official reason → an auto-verdict with money handling follows from that
 *   reason (not from a price guess). The responder has a 48h appeal window;
 *   either side may open negotiation (Fiverr-style partial refund up to 60%).
 *   Every step lands in a `DisputeRecord` that the UI and the audit trail see.
 *
 *   Credit linkage (v4): the WRONG side loses credit — full responsibility =
 *   breach-level −1, partial responsibility = proportional credit cut.
 *
 * Pure + unit-testable; single intra-base pure import（资金分配复用 money 域最大余数法）.
 */

import { allocateByLargestRemainder } from "../money/milestone-escrow.ts";

/** Official dispute reasons (demander picks exactly one). */
export type DisputeReason =
  | "no-show" // 响应者未到场
  | "late" // 迟到/早退（时效违约）
  | "result-mismatch" // 结果/模块不符
  | "deliverable-missing" // 交付物缺失/损坏
  | "demander-change" // 需求方变更/取消
  | "force-majeure"; // 不可抗力/模糊

export const DISPUTE_REASONS: Array<{ value: DisputeReason; label: string }> = [
  { value: "no-show", label: "未到场（no-show）" },
  { value: "late", label: "迟到/早退（时效违约）" },
  { value: "result-mismatch", label: "结果/模块不符" },
  { value: "deliverable-missing", label: "交付物缺失/损坏" },
  { value: "demander-change", label: "需求方变更/取消" },
  { value: "force-majeure", label: "不可抗力/说不清" },
];

export type Responsibility =
  | "responder-full"
  | "responder-partial"
  | "demander"
  | "shared";

export type MoneyPlan =
  | { type: "fullrefund"; pct: 100 }
  | { type: "negotiate"; maxPct: number }
  | { type: "keep-to-responder"; pct: 0 };

export interface AutoVerdict {
  responsibility: Responsibility;
  money: MoneyPlan;
  label: string;
}

/** Auto money handling bound to the reason (reason → money, not money → reason). */
export function autoVerdict(reason: DisputeReason): AutoVerdict {
  switch (reason) {
    case "no-show":
      return { responsibility: "responder-full", money: { type: "fullrefund", pct: 100 }, label: "未到场：全退需求方" };
    case "deliverable-missing":
      return { responsibility: "responder-full", money: { type: "fullrefund", pct: 100 }, label: "交付物缺失：全退需求方" };
    case "late":
      return { responsibility: "responder-partial", money: { type: "negotiate", maxPct: 60 }, label: "时效违约：协商部分退（上限 60%）" };
    case "result-mismatch":
      return { responsibility: "responder-partial", money: { type: "negotiate", maxPct: 60 }, label: "结果/模块不符：协商部分退（上限 60%）" };
    case "demander-change":
      return { responsibility: "demander", money: { type: "keep-to-responder", pct: 0 }, label: "需求方变更：已发生成本归响应者" };
    case "force-majeure":
      return { responsibility: "shared", money: { type: "negotiate", maxPct: 50 }, label: "不可抗力：协商均摊" };
  }
}

/** One dispute event in the audit trail. */
export interface DisputeRecord {
  /** Unique id — the claim id (one open dispute per claim). */
  id: string;
  claimId: string;
  reason: DisputeReason;
  /** Demander's evidence text (required, MVP text-only). */
  evidence: string;
  /** Auto verdict at open time. */
  verdict: AutoVerdict;
  /** Responder appeal deadline (48h from open). */
  appealDeadline: number;
  /** Final agreed refund amount (¥) once settled. */
  agreedAmount?: number;
  outcome?: DisputeOutcome;
  createdAt: number;
}

export type DisputeOutcome =
  | { kind: "auto"; note: string }
  | { kind: "negotiated"; note: string; agreedAmount: number }
  | { kind: "withdrawn"; note: string };

/** Open a dispute. Requires a reason + evidence; auto-verdict computed. */
export function openDispute(
  input: { claimId: string; reason: DisputeReason; evidence: string },
  now = Date.now()
): DisputeRecord {
  if (!input.evidence || !input.evidence.trim()) {
    throw new Error("dispute.evidence.required");
  }
  return {
    id: input.claimId,
    claimId: input.claimId,
    reason: input.reason,
    evidence: input.evidence.trim().slice(0, 200),
    verdict: autoVerdict(input.reason),
    appealDeadline: now + 48 * 60 * 60 * 1000,
    createdAt: now,
  };
}

/** Resolve without negotiation (auto path or appeal timeout). */
export function resolveAuto(
  record: DisputeRecord,
  note: string
): DisputeRecord {
  if (record.outcome) throw new Error("dispute.already-resolved");
  return { ...record, outcome: { kind: "auto", note }, agreedAmount: 0 };
}

/**
 * Fiverr-style negotiation: responder proposes a partial refund (< max),
 * demander accepts → settlement. One shot per dispute; a full refund is
 * free to propose too (≤ maxPct).
 */
export function negotiate(
  record: DisputeRecord,
  proposedPct: number,
  willAccept: boolean,
  note: string
): DisputeRecord {
  if (record.outcome) throw new Error("dispute.already-resolved");
  const v = record.verdict;
  if (v.money.type !== "negotiate") {
    return { ...record, outcome: { kind: "auto", note: "全责原因不可协商" }, agreedAmount: 0 };
  }
  const pct = Math.round(Math.max(0, Math.min(proposedPct, v.money.maxPct)));
  if (!willAccept) return resolveAuto(record, "协商被拒，回到自动档位");
  return {
    ...record,
    outcome: { kind: "negotiated", note, agreedAmount: pct },
  };
}

/**
 * Credit delta for the WRONG side, by responsibility (v4):
 *   responder-full → −1 (breach level)  ·  responder-partial → −(pct/100)
 *   demander → +... (demander stake not in responder credit model, 0 here)
 */
export function creditDeltaFor(record: DisputeRecord): number {
  const resp = record.verdict.responsibility;
  if (resp === "responder-full") return -2;
  if (resp === "responder-partial") {
    const pct = record.outcome?.kind === "negotiated" ? record.outcome.agreedAmount : 0;
    return -Math.max(1, Math.round(pct / 20)); // pct%(0-60) → −1..−3 gradient
  }
  return 0; // demander / shared: no responder credit cut here
}

/* =====================================================================
 * AI 仲裁确定性护栏（批次 3b · 条文 #1）：LLM 产出的责任比例在进入任何
 * 资金计算前，必须经此纯函数校验并按整数分最大余数法守恒分配。
 * LLM 编排本身禁止入底座（红线 1），本护栏是其唯一合法落地通道。
 * ===================================================================== */

export interface IArbitrationSplitCents {
  /** 退还需求方金额（分）——随服务方责任比例缩放 */
  refundCents: number;
  /** 结清服务方金额（分）——随需求方责任比例缩放 */
  payoutCents: number;
}

/** 校验比例 ∈ [0,100] 且和为 100（浮点容差 1e-9）；违规抛点码错误。 */
export function validateArbitrationRatios(
  demanderRatio: number,
  providerRatio: number,
): void {
  for (const [label, r] of [
    ["demanderRatio", demanderRatio],
    ["providerRatio", providerRatio],
  ] as const) {
    if (typeof r !== "number" || !Number.isFinite(r) || r < 0 || r > 100) {
      throw new Error(`arbitration.ratio.out-of-range: ${label}=${r}`);
    }
  }
  if (Math.abs(demanderRatio + providerRatio - 100) > 1e-9) {
    throw new Error("arbitration.ratio.sum-must-be-100");
  }
}

/**
 * 比例 → 整数分守恒分配：先过比例护栏，再按最大余数法无损切分总额。
 * refund 随 providerRatio（服务方过失越大退得越多）、payout 随 demanderRatio，
 * 与历史仲裁语义一致；refund + payout ≡ totalAmountCents 由分配器断言保证。
 */
export function splitArbitrationAmountsCents(
  totalAmountCents: number,
  demanderRatio: number,
  providerRatio: number,
): IArbitrationSplitCents {
  validateArbitrationRatios(demanderRatio, providerRatio);
  const [refundCents, payoutCents] = allocateByLargestRemainder(totalAmountCents, [
    providerRatio,
    demanderRatio,
  ]);
  return { refundCents, payoutCents };
}

/**
 * 小法官结算护栏（方向 1 接线 B · 红线 1 物理闭合）：
 * AI/LLM 建议的 refundPct 语义 =「退还需求方的百分比」，与 splitArbitrationAmountsCents
 * 的「refund∝providerRatio（过失越大退越多）」相反——本函数显式换位权重
 * [refundPct, 100−refundPct]，杜绝调用方踩反直觉映射坑。
 * 返回整数分守恒切分：refund + payout ≡ totalAmountCents。
 */
export function guardArbitrationSettlement(
  totalAmountCents: number,
  refundPct: number,
): IArbitrationSplitCents {
  validateArbitrationRatios(refundPct, 100 - refundPct);
  const [refundCents, payoutCents] = allocateByLargestRemainder(totalAmountCents, [
    refundPct,
    100 - refundPct,
  ]);
  return { refundCents, payoutCents };
}