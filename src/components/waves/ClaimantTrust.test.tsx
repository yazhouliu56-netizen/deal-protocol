import { describe, it, expect } from "vitest";
import { describeTrust } from "./ClaimantTrust";

describe("describeTrust", () => {
  it("三事实齐全", () => {
    expect(
      describeTrust({ credit_score: 820, dispute_losses: 0, is_online: true }),
    ).toEqual(["信用 820 / 300", "历史零纠纷", "🟢 在线可接"]);
  });

  it("有纠纷计数如实报", () => {
    expect(
      describeTrust({ credit_score: 610, dispute_losses: 2, is_online: false }),
    ).toEqual(["信用 610 / 300", "历史纠纷 2 次", "⚪ 当前离线"]);
  });

  it("缺字段只摆有的事实", () => {
    expect(describeTrust({ is_online: true })).toEqual(["🟢 在线可接"]);
  });

  it("空档案与全缺席回 null（调用方静默不渲染）", () => {
    expect(describeTrust(null)).toBeNull();
    expect(describeTrust({})).toBeNull();
    expect(describeTrust({ credit_score: NaN })).toBeNull();
  });
});
