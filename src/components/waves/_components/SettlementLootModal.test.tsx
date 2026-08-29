import { describe, it, expect } from "vitest";
import { deriveSettlementReward } from "./SettlementLootModal";

describe("deriveSettlementReward 确定性礼遇", () => {
  it("同 waveId 两次调用等价（确定性）", () => {
    const a = deriveSettlementReward("wave-1-abc");
    const b = deriveSettlementReward("wave-1-abc");
    expect(a).toEqual(b);
  });
  it("hash %10===0 触发暴击", () => {
    // 暴力搜一个命中暴击的 id
    let hit = "";
    for (let i = 0; i < 200; i++) {
      const id = `wave-${i}-crit`;
      if (deriveSettlementReward(id).isCritical) {
        hit = id;
        break;
      }
    }
    expect(hit).not.toBe("");
    expect(deriveSettlementReward(hit).isCritical).toBe(true);
  });
  it("hash %3 轮转三类型均可出现", () => {
    const types = new Set<string>();
    for (let i = 0; i < 30; i++) types.add(deriveSettlementReward(`wave-${i}`).type);
    expect(types.has("XP")).toBe(true);
    expect(types.has("COUPON")).toBe(true);
    expect(types.has("CREDIT_SURGE")).toBe(true);
  });
  it("空串不抛错且返回合法结构", () => {
    const r = deriveSettlementReward("");
    expect(["XP", "COUPON", "CREDIT_SURGE"]).toContain(r.type);
    expect(r.title.length).toBeGreaterThan(0);
  });
});
