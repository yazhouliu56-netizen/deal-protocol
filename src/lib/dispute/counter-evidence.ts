import { classifyEvidence } from "@/lib/arbitration/policy";

/**
 * 反驳举证侧归属（ADR-0021 后续根本解决 · 用户裁决 2026-09-23）。
 *
 * 侧归属铁律：哪一侧提交的就是哪一侧的——
 * disputes.evidence = 发起侧（开争议时写入）；
 * disputes.responder_evidence = 被发起侧（counter-evidence 路由写入）。
 * resolver 不再写死 false，实读后者进签发门禁（counter-evidence-manual）。
 *
 * 纯函数（零 DB/UI 依赖，可单测）。
 */

/** 被发起侧是否提交了有效反驳（空/“无证据”/空容器 = 无）。 */
export function hasResponderCounterEvidence(responderEvidence: unknown): boolean {
  return classifyEvidence(responderEvidence) !== "NONE";
}

export interface CounterEvidenceSubmitter {
  callerId: string;
  initiatorId: string;
  customerId: string;
  providerId: string;
  status: string;
}

export type CounterEvidenceVerdict =
  | { ok: true }
  | { ok: false; code: string; status: number };

/**
 * 被发起侧举证准入：当事方 ＋ 非发起侧 ＋ 争议 OPEN，三者缺一即拒。
 * （发起侧举证走开争议时的 evidence 字段，不走本通道。）
 */
export function canSubmitCounterEvidence(s: CounterEvidenceSubmitter): CounterEvidenceVerdict {
  if (s.status !== "OPEN") {
    return { ok: false, code: "争议已不在待举证状态", status: 409 };
  }
  if (s.callerId !== s.customerId && s.callerId !== s.providerId) {
    return { ok: false, code: "仅合同当事方可举证", status: 403 };
  }
  if (s.callerId === s.initiatorId) {
    return { ok: false, code: "发起侧举证请走开争议 evidence 字段", status: 403 };
  }
  return { ok: true };
}
