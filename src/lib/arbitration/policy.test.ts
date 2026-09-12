import { describe, expect, it } from "vitest";

import {
  APPEAL_WINDOW_HOURS,
  DEFAULT_ARBITRATION_POLICY,
  appealDeadline,
  classifyEvidence,
  determineTierWithPolicy,
  evaluateIssuance,
  resolvePolicy,
} from "./policy";

describe("arbitration policy（ADR-0021）", () => {
  it("全局默认与历史硬编码一致：200/2000/0.85", () => {
    expect(DEFAULT_ARBITRATION_POLICY.easyMaxAmount).toBe(200);
    expect(DEFAULT_ARBITRATION_POLICY.mediumMaxAmount).toBe(2000);
    expect(DEFAULT_ARBITRATION_POLICY.autoConfidence).toBe(0.85);
  });

  it("家政通道推导：green 200 → EASY 上限，yellow 500 → MEDIUM 上限", () => {
    const p = resolvePolicy({ green: { maxAmount: 200 }, yellow: { maxAmount: 500 } });
    expect(determineTierWithPolicy(200, p)).toBe("EASY");
    expect(determineTierWithPolicy(201, p)).toBe("MEDIUM");
    expect(determineTierWithPolicy(500, p)).toBe("MEDIUM");
    expect(determineTierWithPolicy(501, p)).toBe("HARD");
  });

  it("约局通道推导：500/2000（同金额在家政是 HARD，在约局是 MEDIUM）", () => {
    const hk = resolvePolicy({ green: { maxAmount: 200 }, yellow: { maxAmount: 500 } });
    const meetup = resolvePolicy({ green: { maxAmount: 500 }, yellow: { maxAmount: 2000 } });
    expect(determineTierWithPolicy(300, hk)).toBe("MEDIUM");
    expect(determineTierWithPolicy(300, meetup)).toBe("EASY");
    expect(determineTierWithPolicy(1500, meetup)).toBe("MEDIUM");
    expect(determineTierWithPolicy(2001, meetup)).toBe("HARD");
  });

  it("弹药显式值优先于通道推导", () => {
    const p = resolvePolicy(
      { green: { maxAmount: 200 }, yellow: { maxAmount: 500 } },
      { easyMaxAmount: 100, autoConfidence: 0.9 },
    );
    expect(p.easyMaxAmount).toBe(100);
    expect(p.mediumMaxAmount).toBe(500);
    expect(p.autoConfidence).toBe(0.9);
  });

  it("无通道无覆盖 → 全局默认（动态长尾弹药兜底）", () => {
    const p = resolvePolicy(null, null);
    expect(p).toMatchObject({ easyMaxAmount: 200, mediumMaxAmount: 2000, autoConfidence: 0.85 });
  });
});

describe("classifyEvidence", () => {
  it("缺失三态 → NONE（null/空串/“无证据”/空对象/空数组）", () => {
    expect(classifyEvidence(null)).toBe("NONE");
    expect(classifyEvidence(undefined)).toBe("NONE");
    expect(classifyEvidence("")).toBe("NONE");
    expect(classifyEvidence("  ")).toBe("NONE");
    expect(classifyEvidence("无证据")).toBe("NONE");
    expect(classifyEvidence({})).toBe("NONE");
    expect(classifyEvidence([])).toBe("NONE");
  });

  it("有内容无核验清单 → PARTIAL", () => {
    expect(classifyEvidence("师傅迟到照片")).toBe("PARTIAL");
    expect(classifyEvidence({ photo: "ipfs://x" })).toBe("PARTIAL");
    expect(classifyEvidence(["a"])).toBe("PARTIAL");
  });

  it("required 逐项命中 → COMPLETE，缺一项 → PARTIAL", () => {
    const req = ["before_photo", "after_photo"];
    expect(classifyEvidence({ before_photo: "a", after_photo: "b" }, req)).toBe("COMPLETE");
    expect(classifyEvidence({ before_photo: "a" }, req)).toBe("PARTIAL");
  });
});

describe("evaluateIssuance 签发门禁", () => {
  const ok = {
    tier: "EASY" as const,
    confidence: 0.9,
    evidence: "PARTIAL" as const,
    agreementSigned: false,
    providerCounterEvidence: false,
  };

  it("全门禁通过 → AUTO（协议未验证只留痕不阻塞）", () => {
    const v = evaluateIssuance(ok);
    expect(v.decision).toBe("AUTO");
    expect(v.reasons).toEqual([]);
    expect(v.notes).toContain("agreement-unverified");
  });

  it("HARD 恒转人工（置信度满分也不自动）", () => {
    const v = evaluateIssuance({ ...ok, tier: "HARD", confidence: 1 });
    expect(v.decision).toBe("REVIEW");
    expect(v.reasons).toContain("hard-tier-manual");
  });

  it("置信度低于自动线 → REVIEW", () => {
    const v = evaluateIssuance({ ...ok, confidence: 0.84 });
    expect(v.decision).toBe("REVIEW");
    expect(v.reasons).toContain("low-confidence");
  });

  it("证据缺失 → REVIEW（“无证据”字符串自动不再直通）", () => {
    const v = evaluateIssuance({ ...ok, evidence: classifyEvidence("无证据") });
    expect(v.decision).toBe("REVIEW");
    expect(v.reasons).toContain("no-evidence");
  });

  it("商家已反驳举证 → REVIEW（双方各执一词转人工）", () => {
    const v = evaluateIssuance({ ...ok, providerCounterEvidence: true });
    expect(v.decision).toBe("REVIEW");
    expect(v.reasons).toContain("counter-evidence-manual");
  });

  it("多拦截原因全部收集（审计完备）", () => {
    const v = evaluateIssuance({ ...ok, tier: "HARD", confidence: 0.5, evidence: "NONE" });
    expect(v.reasons).toEqual(expect.arrayContaining(["hard-tier-manual", "low-confidence", "no-evidence"]));
  });

  it("弹药可调高自动线（品类收紧）", () => {
    const strict = { ...DEFAULT_ARBITRATION_POLICY, autoConfidence: 0.95 };
    expect(evaluateIssuance(ok, strict).decision).toBe("REVIEW");
    expect(evaluateIssuance({ ...ok, confidence: 0.96 }, strict).decision).toBe("AUTO");
  });
});

describe("appealDeadline", () => {
  it("终裁 + 72h（窗内资金冻结不划转）", () => {
    expect(APPEAL_WINDOW_HOURS).toBe(72);
    expect(appealDeadline(1_000_000)).toBe(1_000_000 + 72 * 3600 * 1000);
  });
});
