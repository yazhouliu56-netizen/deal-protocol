import { describe, it, expect, vi } from "vitest";
import { isBatchDue, releaseSatisfactionBase } from "./satisfaction";

const DAY = 24 * 3600_000;
const NOW = 1_800_000_000_000;

// M2 互斥考卷：supabase 链式 stub（contracts single＋milestone limit 双终态）。
const msRowsState = vi.hoisted(() => ({ rows: [] as unknown[] }));
vi.mock("@/lib/supabase-client", () => ({
  getServiceClient: () => ({
    from: (table: string) => ({
      select: () => ({
        eq: () => ({
          single: async () =>
            table === "contracts"
              ? {
                  data: {
                    provider_id: "u-p",
                    customer_id: "u-c",
                    amount: 1000,
                    fund_status: "SATISFACTION_HELD",
                    demand_id: null,
                  },
                  error: null,
                }
              : { data: null, error: null },
          limit: async () => ({ data: msRowsState.rows, error: null }),
        }),
      }),
    }),
  }),
}));

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

describe("M2 互斥最小守卫（有里程碑行只走阶段路）", () => {
  it("有行 → 跳过 Type1 base（skippedMilestone，不碰钱不建 hold）", async () => {
    msRowsState.rows = [{ id: "m1" }];
    const r = await releaseSatisfactionBase("c-1");
    expect(r).toEqual({ released: false, skippedMilestone: true });
    msRowsState.rows = [];
  });
});
