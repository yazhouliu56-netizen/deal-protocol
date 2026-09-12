import type { DisputeTier } from "./types";
import type { IArbitrationPolicy } from "@/types/ammo-schema";

/**
 * ADR-0021 · 仲裁签发策略纯核（LLM 仲裁建议书 + 分级签发）。
 *
 * 法定位置：LLM（single/council arbitrator）永远只出《仲裁建议书》；
 * 能否自动生效由本模块的确定性门禁判定。纯函数、可单测、零运行时导入。
 *
 * 配置优先级（宪法 #5 引信跟弹药走）：
 *   弹药 arbitration 显式值 ＞ 协议 dispute channels 推导 ＞ 全局默认。
 */

export interface ArbitrationPolicy {
  easyMaxAmount: number;
  mediumMaxAmount: number;
  autoConfidence: number;
  advanceCompCapYuan?: number;
  appealWindowHours: number;
}

/** 全局默认（与 index.ts 历史硬编码 200/2000/0.85 字节级一致）。 */
export const DEFAULT_ARBITRATION_POLICY: ArbitrationPolicy = {
  easyMaxAmount: 200,
  mediumMaxAmount: 2000,
  autoConfidence: 0.85,
  appealWindowHours: 72,
};

/** 终裁后申诉窗（小时；窗内资金冻结不划转，ADR-0021 §三）。 */
export const APPEAL_WINDOW_HOURS = 72;

/**
 * 协议预置争议条款勾选开关（ADR-0021 §三-1 先行赔付前提①）。
 * 置 true 需客户端先发 contract.terms.arbitrationAgreement === true；
 * 在此之前保持 false = 只审计记录、不阻塞自动路径（防自动链路猝死）。
 */
export const STRICT_AGREEMENT_GATE = false;

export interface ChannelSet {
  green: { maxAmount: number };
  yellow?: { maxAmount: number } | null;
}

/**
 * 策略归一：弹药显式值优先，其次按协议通道推导
 * （green.maxAmount → EASY 上限，yellow.maxAmount → MEDIUM 上限，
 * 恰好对齐通道映射：green=小额自动、yellow=议会、red=人工），
 * 缺省回落全局默认。
 */
export function resolvePolicy(
  channels?: ChannelSet | null,
  override?: IArbitrationPolicy | null,
): ArbitrationPolicy {
  return {
    easyMaxAmount:
      override?.easyMaxAmount ?? channels?.green?.maxAmount ?? DEFAULT_ARBITRATION_POLICY.easyMaxAmount,
    mediumMaxAmount:
      override?.mediumMaxAmount ??
      channels?.yellow?.maxAmount ??
      DEFAULT_ARBITRATION_POLICY.mediumMaxAmount,
    autoConfidence:
      override?.autoConfidence ?? DEFAULT_ARBITRATION_POLICY.autoConfidence,
    advanceCompCapYuan: override?.advanceCompCapYuan,
    appealWindowHours:
      override?.appealWindowHours ?? DEFAULT_ARBITRATION_POLICY.appealWindowHours,
  };
}

/** 金额分档（HARD = 强制人工，arbitrate() 拒绝执行）。 */
export function determineTierWithPolicy(amount: number, policy: ArbitrationPolicy): DisputeTier {
  if (amount <= policy.easyMaxAmount) return "EASY";
  if (amount <= policy.mediumMaxAmount) return "MEDIUM";
  return "HARD";
}

export type EvidenceState = "NONE" | "PARTIAL" | "COMPLETE";

/**
 * 证据完备性初筛（ADR-0021 §三-2 凭证齐全）。
 * NONE = 缺失（null/空/"无证据"）→ 禁止自动生效；
 * PARTIAL = 有内容但未经逐项核验；COMPLETE 需调用方按协议
 * requiredEvidence 逐项校验后显式传入 required 命中。
 */
export function classifyEvidence(evidence: unknown, required?: string[]): EvidenceState {
  if (evidence == null) return "NONE";
  if (typeof evidence === "string") {
    const t = evidence.trim();
    if (!t || t === "无证据") return "NONE";
    return "PARTIAL";
  }
  if (Array.isArray(evidence)) return evidence.length > 0 ? "PARTIAL" : "NONE";
  if (typeof evidence === "object") {
    const rec = evidence as Record<string, unknown>;
    const keys = Object.keys(rec);
    if (keys.length === 0) return "NONE";
    if (required?.length && required.every((k) => rec[k] != null)) return "COMPLETE";
    return "PARTIAL";
  }
  return "PARTIAL";
}

export interface IssuanceInput {
  tier: DisputeTier;
  confidence: number;
  evidence: EvidenceState;
  /** 协议预置争议条款已勾选（先行赔付前提①）。 */
  agreementSigned: boolean;
  /** 商家已提交反驳举证（双方各执一词 → 转人工/议会）。 */
  providerCounterEvidence: boolean;
}

export interface IssuanceVerdict {
  decision: "AUTO" | "REVIEW";
  /** 拦截原因（阻塞性；空 = 全门禁通过）。 */
  reasons: string[];
  /** 审计备注（非阻塞，仅留痕；如协议勾选未验证）。 */
  notes: string[];
}

/**
 * 签发门禁：全部通过才 AUTO，有任一拦截即 REVIEW。
 * MEDIUM 经议会仲裁（council）且高置信仍可 AUTO——议会本身即复核；
 * 仅 HARD 恒为人工。
 */
export function evaluateIssuance(
  input: IssuanceInput,
  policy: ArbitrationPolicy = DEFAULT_ARBITRATION_POLICY,
): IssuanceVerdict {
  const reasons: string[] = [];
  const notes: string[] = [];
  if (input.tier === "HARD") reasons.push("hard-tier-manual");
  if (!(input.confidence >= policy.autoConfidence)) reasons.push("low-confidence");
  if (input.evidence === "NONE") reasons.push("no-evidence");
  if (input.providerCounterEvidence) reasons.push("counter-evidence-manual");
  if (!input.agreementSigned) {
    // 先行赔付前提①：严格门禁未开前只审计留痕，不阻塞（防自动链路猝死）。
    if (STRICT_AGREEMENT_GATE) reasons.push("no-agreement");
    else notes.push("agreement-unverified");
  }
  return { decision: reasons.length > 0 ? "REVIEW" : "AUTO", reasons, notes };
}

/** 申诉截止 = 终裁时刻 + 申诉窗（毫秒时间戳）。 */
export function appealDeadline(resolvedAtMs: number, windowHours: number = APPEAL_WINDOW_HOURS): number {
  return resolvedAtMs + windowHours * 60 * 60 * 1000;
}

export interface VerdictEnvelope {
  providerAmount: number;
  customerAmount: number;
  appealUntil: number | null;
}

/**
 * 终裁信封解析（resolver 申诉窗补划转用）。
 * 新格式含 gate/appealUntil；兼容旧 {providerAmount, customerAmount}（无窗＝到期）。
 * 不可解析 → null（调用方转人工，不猜金额）。
 */
export function parseVerdictEnvelope(raw: unknown): VerdictEnvelope | null {
  try {
    const v = typeof raw === "string" ? JSON.parse(raw) : raw;
    if (typeof v?.providerAmount !== "number" || typeof v?.customerAmount !== "number") return null;
    return {
      providerAmount: v.providerAmount,
      customerAmount: v.customerAmount,
      appealUntil: typeof v.appealUntil === "number" ? v.appealUntil : null,
    };
  } catch {
    return null;
  }
}

export type RefundTiming = "REFUND" | "HOLD_APPEAL" | "QUEUE_REVIEW";

/**
 * 划转时机判定（resolver 唯一划转闸口，防 REVIEW/窗内资金被划走）。
 * REVIEW → 只排队人工；AUTO 但窗内 → 冻结等窗过；其余 → 划转。
 */
export function decideRefundTiming(
  gate: "AUTO" | "REVIEW",
  appealUntil: number | null,
  now: number = Date.now(),
): RefundTiming {
  if (gate !== "AUTO") return "QUEUE_REVIEW";
  if (appealUntil != null && now < appealUntil) return "HOLD_APPEAL";
  return "REFUND";
}
