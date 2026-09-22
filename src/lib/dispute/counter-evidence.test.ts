import { describe, expect, it } from "vitest";
import {
  canSubmitCounterEvidence,
  hasResponderCounterEvidence,
} from "./counter-evidence";

describe("hasResponderCounterEvidence 被发起侧反驳判定", () => {
  it("NULL/空串/空白/“无证据” = 无反驳", () => {
    expect(hasResponderCounterEvidence(null)).toBe(false);
    expect(hasResponderCounterEvidence(undefined)).toBe(false);
    expect(hasResponderCounterEvidence("")).toBe(false);
    expect(hasResponderCounterEvidence("   ")).toBe(false);
    expect(hasResponderCounterEvidence("无证据")).toBe(false);
    expect(hasResponderCounterEvidence({})).toBe(false);
    expect(hasResponderCounterEvidence([])).toBe(false);
  });

  it("非空文本/对象/数组 = 有反驳", () => {
    expect(hasResponderCounterEvidence("对方未到场照片")).toBe(true);
    expect(hasResponderCounterEvidence({ photo: "a" })).toBe(true);
    expect(hasResponderCounterEvidence(["a"])).toBe(true);
  });
});

describe("canSubmitCounterEvidence 被发起侧举证准入", () => {
  const base = {
    callerId: "provider-1",
    initiatorId: "customer-1",
    customerId: "customer-1",
    providerId: "provider-1",
    status: "OPEN",
  };

  it("被发起侧当事方＋OPEN → 放行", () => {
    expect(canSubmitCounterEvidence(base)).toEqual({ ok: true });
  });

  it("非 OPEN → 409", () => {
    const r = canSubmitCounterEvidence({ ...base, status: "RESOLVED" });
    expect(r).toEqual({ ok: false, code: "争议已不在待举证状态", status: 409 });
  });

  it("局外人 → 403", () => {
    const r = canSubmitCounterEvidence({ ...base, callerId: "stranger" });
    expect(r).toEqual({ ok: false, code: "仅合同当事方可举证", status: 403 });
  });

  it("发起侧走本通道 → 403（请走 evidence 字段）", () => {
    const r = canSubmitCounterEvidence({ ...base, callerId: "customer-1" });
    expect(r).toEqual({ ok: false, code: "发起侧举证请走开争议 evidence 字段", status: 403 });
  });

  it("发起侧是服务方时，客户方可举证", () => {
    const r = canSubmitCounterEvidence({
      ...base,
      callerId: "customer-1",
      initiatorId: "provider-1",
    });
    expect(r).toEqual({ ok: true });
  });
});
