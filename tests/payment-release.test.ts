import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("next/server", () => ({
  NextResponse: {
    json: (body: unknown, init?: { status?: number }) => ({
      status: init?.status ?? 200,
      json: async () => body,
    }),
  },
}));

vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
}));

const mockGetConfig = vi.fn();

vi.mock("@/lib/platform/config", () => ({
  getConfig: (...args: unknown[]) => mockGetConfig(...args),
  getCommissionRate: (amount: number, config: { fees: { commissionTiers: { maxAmount: number; rate: number }[] } }) => {    for (const tier of config.fees.commissionTiers) {
      if (amount <= tier.maxAmount) return tier.rate;
    }
    return config.fees.commissionTiers[config.fees.commissionTiers.length - 1]?.rate ?? 0.15;
  },
}));

// 可变场景：单测按需改 demand/钱包/原子锁结果，mock 实现只读场景。
const scenario = {
  demand: {
    id: "d-1",
    title: "t",
    price: 1000,
    status: "COMPLETED",
    demander_id: "u-cliente",
    client_id: "u-cliente",
    customer_id: "u-cliente",
    matched_provider_id: "p-pro",
    released_at: null,
  },
  wallet: { balance: 0 },
  settleResult: "ok" as "ok" | "empty",
  walletUpdateCalls: 0,
  currentUserId: "u-cliente",
};

vi.mock("@/lib/supabase-client", () => ({
  getServiceClient: () => ({
    from: (table: string) => {
      if (table === "demands") {
        return {
          select: () => ({ eq: () => ({ single: async () => ({ data: scenario.demand, error: null }) }) }),
          update: () => ({
            eq: () => ({
              eq: () => ({
                is: () => ({
                  select: () => ({
                    single: async () =>
                      scenario.settleResult === "ok"
                        ? { data: { id: "d-1" }, error: null }
                        : { data: null, error: { message: "0 rows" } },
                  }),
                }),
              }),
            }),
          }),
        };
      }
      if (table === "provider_wallets") {
        return {
          select: () => ({ eq: () => ({ single: async () => ({ data: scenario.wallet, error: null }) }) }),
          update: () => ({
            eq: async () => {
              scenario.walletUpdateCalls += 1;
              return { error: null };
            },
          }),
        };
      }
      if (table === "wallet_logs") return { insert: async () => ({ error: null }) };
      throw new Error(`unexpected table ${table}`);
    },
  }),
  getSupabase: () => {
    throw new Error("should use service client in release route");
  },
}));

vi.mock("@/lib/api-auth", () => ({
  withAuth: (handler: (req: unknown, user: unknown) => unknown) => (req: unknown) =>
    handler(req, { id: scenario.currentUserId }),
}));

function post(body: unknown) {
  return new Request("http://localhost/api/payment/release", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

const CUSTOM_TIERS = {
  fees: { commissionTiers: [{ maxAmount: 500, rate: 0.15 }], satisfactionHold: 0.1 },
  credit: { levels: [] },
  rules: { cancelThreshold: 3, cancelPenaltyCount: 5, cancelPenaltyCredit: 100, cancelPenaltyDays: 7 },
  insurance: { ratePerOrder: 0.01, poolAllocation: { warranty: 0.4, customer: 0.3, provider: 0.2, sos: 0.1 } },
};

beforeEach(() => {
  vi.clearAllMocks();
  scenario.demand = {
    id: "d-1",
    title: "t",
    price: 1000,
    status: "COMPLETED",
    demander_id: "u-cliente",
    client_id: "u-cliente",
    customer_id: "u-cliente",
    matched_provider_id: "p-pro",
    released_at: null,
  };
  scenario.wallet = { balance: 0 };
  scenario.settleResult = "ok";
  scenario.walletUpdateCalls = 0;
  scenario.currentUserId = "u-cliente";
});

describe("POST /api/payment/release 阶梯费率接线", () => {
  it("配置 15% 档：1000 元单扣 150，服务者得 850", async () => {
    mockGetConfig.mockResolvedValue(CUSTOM_TIERS);
    const { POST } = await import("@/app/api/payment/release/route");
    const resp = await POST(post({ orderId: "d-1" }));
    const body = await resp.json();
    expect(resp.status).toBe(200);
    expect(body.fee).toBe(150);
    expect(body.payout).toBe(850);
  });

  it("配置读取失败：回退默认 10%，1000 元单扣 100", async () => {
    mockGetConfig.mockRejectedValue(new Error("db down"));
    const { POST } = await import("@/app/api/payment/release/route");
    const resp = await POST(post({ orderId: "d-1" }));
    const body = await resp.json();
    expect(resp.status).toBe(200);
    expect(body.fee).toBe(100);
    expect(body.payout).toBe(900);
  });
});

describe("POST /api/payment/release Step3b 幂等与守卫", () => {
  it("原子锁 0 行生效 → 409，且钱包绝不写入", async () => {
    mockGetConfig.mockResolvedValue(CUSTOM_TIERS);
    scenario.settleResult = "empty";
    const { POST } = await import("@/app/api/payment/release/route");
    const resp = await POST(post({ orderId: "d-1" }));
    const body = await resp.json();
    expect(resp.status).toBe(409);
    expect(body.error).toBe("ORDER_ALREADY_SETTLED_OR_NOT_COMPLETED");
    expect(scenario.walletUpdateCalls).toBe(0);
  });

  it("price 缺失/零 → 400 ORDER_AMOUNT_INVALID，钱包绝不写入", async () => {
    mockGetConfig.mockResolvedValue(CUSTOM_TIERS);
    scenario.demand.price = 0;
    const { POST } = await import("@/app/api/payment/release/route");
    const resp = await POST(post({ orderId: "d-1" }));
    const body = await resp.json();
    expect(resp.status).toBe(400);
    expect(body.error).toBe("ORDER_AMOUNT_INVALID");
    expect(scenario.walletUpdateCalls).toBe(0);
  });

  it("非属主调用 → 403", async () => {
    mockGetConfig.mockResolvedValue(CUSTOM_TIERS);
    scenario.currentUserId = "u-stranger";
    const { POST } = await import("@/app/api/payment/release/route");
    const resp = await POST(post({ orderId: "d-1" }));
    expect(resp.status).toBe(403);
    expect(scenario.walletUpdateCalls).toBe(0);
  });

  it("已结算复点（settled+released_at）→ 409", async () => {
    mockGetConfig.mockResolvedValue(CUSTOM_TIERS);
    scenario.demand.status = "settled";
    scenario.demand.released_at = new Date().toISOString();
    const { POST } = await import("@/app/api/payment/release/route");
    const resp = await POST(post({ orderId: "d-1" }));
    const body = await resp.json();
    expect(resp.status).toBe(409);
    expect(body.error).toBe("ORDER_ALREADY_SETTLED_OR_NOT_COMPLETED");
    expect(scenario.walletUpdateCalls).toBe(0);
  });

  it("非 COMPLETED 状态 → 400", async () => {
    mockGetConfig.mockResolvedValue(CUSTOM_TIERS);
    scenario.demand.status = "STARTED";
    const { POST } = await import("@/app/api/payment/release/route");
    const resp = await POST(post({ orderId: "d-1" }));
    expect(resp.status).toBe(400);
    expect(scenario.walletUpdateCalls).toBe(0);
  });
});
