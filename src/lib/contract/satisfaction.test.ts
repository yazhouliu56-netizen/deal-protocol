import { describe, it, expect } from "vitest";
import { isBatchDue } from "./satisfaction";

const DAY = 24 * 3600_000;
const NOW = 1_800_000_000_000;

describe("P4 双钟表批量触发（N=10 / T=7天先到为准）", () => {
  it("持有数达 N 即触发（不看龄）", () => {
    expect(isBatchDue(10, NOW, NOW, 10, 7)).toBe(true);
    expect(isBatchDue(25, NOW, NOW, 10, 7)).toBe(true);
  });

  it("未达 N 但最早龄达 T 天即触发", () => {
    expect(isBatchDue(3, NOW - 7 * DAY, NOW, 10, 7)).toBe(true);
    expect(isBatchDue(1, NOW - 30 * DAY, NOW, 10, 7)).toBe(true);
  });

  it("未达 N 且龄不足 → 不触发", () => {
    expect(isBatchDue(3, NOW - 6 * DAY, NOW, 10, 7)).toBe(false);
    expect(isBatchDue(9, NOW - 6 * DAY - 1, NOW, 10, 7)).toBe(false);
  });

  it("空持有/非法输入 → 不触发", () => {
    expect(isBatchDue(0, NOW, NOW, 10, 7)).toBe(false);
    expect(isBatchDue(-1, NOW, NOW, 10, 7)).toBe(false);
    expect(isBatchDue(3, NaN, NOW, 10, 7)).toBe(false);
  });
});
