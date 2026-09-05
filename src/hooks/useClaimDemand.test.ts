import { describe, expect, it } from "vitest";
import {
  CLAIM_DEFAULT_MESSAGE,
  CLAIM_NETWORK_MESSAGE,
  CLAIM_VERIFY_MESSAGE,
  extractAssignError,
  isClaimBlocked,
} from "@/hooks/useClaimDemand";

describe("useClaimDemand 纯逻辑", () => {
  it("实名门禁：仅已 loaded 且非 approved 时拦截", () => {
    expect(isClaimBlocked(undefined)).toBe(false);
    expect(isClaimBlocked("")).toBe(false);
    expect(isClaimBlocked("approved")).toBe(false);
    expect(isClaimBlocked("pending")).toBe(true);
    expect(isClaimBlocked("rejected")).toBe(true);
  });

  it("错误归一：reason 优先于 error，异常体回退", () => {
    expect(extractAssignError({ reason: "手慢了" }, CLAIM_DEFAULT_MESSAGE)).toBe("手慢了");
    expect(extractAssignError({ error: "boom" }, CLAIM_DEFAULT_MESSAGE)).toBe("boom");
    expect(extractAssignError({ reason: "a", error: "b" }, CLAIM_DEFAULT_MESSAGE)).toBe("a");
    expect(extractAssignError(null, CLAIM_DEFAULT_MESSAGE)).toBe(CLAIM_DEFAULT_MESSAGE);
    expect(extractAssignError("oops", CLAIM_DEFAULT_MESSAGE)).toBe(CLAIM_DEFAULT_MESSAGE);
    expect(extractAssignError({ reason: "" }, CLAIM_DEFAULT_MESSAGE)).toBe(CLAIM_DEFAULT_MESSAGE);
  });

  it("常量文案锁死（调用方断言同源）", () => {
    expect(CLAIM_VERIFY_MESSAGE).toContain("实名身份验证");
    expect(CLAIM_NETWORK_MESSAGE).toBe("网络异常，请重试");
  });
});
