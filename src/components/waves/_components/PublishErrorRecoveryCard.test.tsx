import { describe, it, expect } from "vitest";
import { mapBlockedToReason } from "./PublishErrorRecoveryCard";

describe("mapBlockedToReason 人话映射", () => {
  it("联系方式 -> contact-leak", () => {
    expect(mapBlockedToReason("检测到私密联系方式")).toBe("contact-leak");
  });
  it("多开探针 -> sentinel", () => {
    expect(mapBlockedToReason("反欺诈探针高危信号")).toBe("sentinel");
  });
  it("未成年人 -> minor", () => {
    expect(mapBlockedToReason("未成年人需监护人同意")).toBe("minor");
  });
  it("未结清 -> debt", () => {
    expect(mapBlockedToReason("未结清的 no-show")).toBe("debt");
  });
  it("空串 -> generic", () => {
    expect(mapBlockedToReason("")).toBe("generic");
  });
});
