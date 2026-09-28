import { describe, it, expect } from "vitest";
import { DEMAND_STATUSES, validateDemandTransition } from "./state";

describe("demand state · BOOKED 预约前态（R-0928-12，只增补）", () => {
  it("旧跃迁全部保留（接口保守）", () => {
    expect(validateDemandTransition("OPEN", "MATCHED")).toBe(null);
    expect(validateDemandTransition("ASSIGNED", "DEPARTED")).toBe(null);
    expect(validateDemandTransition("STARTED", "COMPLETED")).toBe(null);
    expect(validateDemandTransition("OPEN", "COMPLETED")).not.toBe(null);
  });

  it("BOOKED：仅 →OPEN / →CANCELLED", () => {
    expect(validateDemandTransition("BOOKED", "OPEN")).toBe(null);
    expect(validateDemandTransition("BOOKED", "CANCELLED")).toBe(null);
    expect(validateDemandTransition("BOOKED", "ASSIGNED")).not.toBe(null);
    expect(validateDemandTransition("BOOKED", "MATCHED")).not.toBe(null);
  });

  it("PENDING 可进 BOOKED（预约建单）", () => {
    expect(validateDemandTransition("PENDING", "BOOKED")).toBe(null);
  });

  it("终态无出边", () => {
    expect(DEMAND_STATUSES.BOOKED).toBe("BOOKED");
    expect(validateDemandTransition("COMPLETED", "BOOKED")).not.toBe(null);
  });
});
