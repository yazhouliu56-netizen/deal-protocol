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

const chainTop = () => {
  const singleDemand = vi.fn().mockResolvedValue({
    data: {
      id: "d-1",
      title: "t",
      price: 1000,
      status: "COMPLETED",
      client_id: "u-cliente",
      matched_provider_id: "p-pro",
    },
    error: null,
  });
  const eqDemand = vi.fn().mockReturnValue({ single: singleDemand });
  const selectDemand = vi.fn().mockReturnValue({ eq: eqDemand });

  const singleWallet = vi.fn().mockResolvedValue({ data: { balance: 0 }, error: null });
  const eqWallet = vi.fn().mockReturnValue({ single: singleWallet });
  const selectWallet = vi.fn().mockReturnValue({ eq: eqWallet });

  const singleUpdate = vi.fn().mockResolvedValue({ data: { id: "d-1" }, error: null });
  const selectUpdate = vi.fn().mockReturnValue({ single: singleUpdate });
  const eqUpdate2 = vi.fn().mockReturnValue({ select: selectUpdate });
  const eqUpdate1 = vi.fn().mockReturnValue({ eq: eqUpdate2 });
  const updateDemand = vi.fn().mockReturnValue({ eq: eqUpdate1 });

  const eqWalletUpdate = vi.fn().mockResolvedValue({ error: null });
  const updateWallet = vi.fn().mockReturnValue({ eq: eqWalletUpdate });

  const insertLogs = vi.fn().mockResolvedValue({ error: null });

  return { selectDemand, selectWallet, updateDemand, updateWallet, insertLogs };
};

let ties: ReturnType<typeof chainTop>;

vi.mock("@/lib/supabase-route-client", () => ({
  getRouteClient: () => ({
    from: (table: string) => {
      if (table === "demands") return { select: ties.selectDemand, update: ties.updateDemand };
      if (table === "provider_wallets") return { select: ties.selectWallet, update: ties.updateWallet };
      if (table === "wallet_logs") return { insert: ties.insertLogs };
      throw new Error(`unexpected table ${table}`);
    },
  }),
}));

vi.mock("@/lib/api-auth", () => ({
  withAuth: (handler: (req: unknown, user: unknown) => unknown) => (req: unknown) =>
    handler(req, { id: "u-cliente" }),
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
  ties = chainTop();
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
