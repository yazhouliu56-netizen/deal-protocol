import { describe, it, expect, vi, beforeEach } from "vitest"

vi.mock("next/server", () => ({
  NextResponse: {
    json: (body: unknown, init?: { status?: number }) => ({
      status: init?.status ?? 200,
      json: async () => body,
    }),
  },
}))

vi.mock("@/lib/api-auth", () => ({
  withAuth: (fn: (req: Request, user: { id: string }) => unknown) => fn,
}))

const mockSupabase = { from: vi.fn() }

vi.mock("@/lib/supabase-client", () => ({
  getServiceClient: () => mockSupabase,
}))

const { GET } = await import("./route")

const user = { id: "user-1" }

let ordersCall = 0

function setupOrders(completedAmounts: number[], escrowAmounts: number[] = []) {
  ordersCall = 0
  const completedEq = vi.fn().mockResolvedValue({
    data: completedAmounts.map((amount) => ({ amount })),
    error: null,
  })
  const completedChain = vi.fn().mockReturnValue({ eq: completedEq })

  const escrowIn = vi.fn().mockResolvedValue({
    data: escrowAmounts.map((amount) => ({ amount })),
    error: null,
  })
  const escrowChain = vi.fn().mockReturnValue({ in: escrowIn })

  // R11：余额真相源为 provider_wallets；缺行回落估算。
  const walletSingle = vi.fn().mockResolvedValue({ data: null, error: null })
  const walletChain = vi.fn().mockReturnValue({ single: walletSingle })

  const pendingEq2 = vi.fn().mockResolvedValue({ data: [], error: null })
  const pendingEq1 = vi.fn().mockReturnValue({ eq: pendingEq2 })

  mockSupabase.from.mockImplementation((table: string) => {
    if (table === "orders") {
      ordersCall += 1
      if (ordersCall === 1) {
        return {
          select: vi.fn().mockReturnValue({ eq: completedChain }),
        }
      }
      return { select: vi.fn().mockReturnValue({ or: escrowChain }) }
    }
    if (table === "provider_wallets") {
      return { select: vi.fn().mockReturnValue({ eq: walletChain }) }
    }
    if (table === "withdrawal_requests") {
      return { select: vi.fn().mockReturnValue({ eq: pendingEq1 }) }
    }
    return { select: vi.fn() }
  })
}

beforeEach(() => {
  mockSupabase.from.mockClear()
})

describe("finance/overview 资金概览（R11 钱包口径）", () => {
  it("钱包缺行时，可用余额按 escrow 净得口径估算（平台费 10% → 90%）", async () => {
    setupOrders([100, 200])
    const res = await GET(new Request("http://local"), user)
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body.data?.totalEarned).toBe(300)
    expect(body.data?.availableBalance).toBe(270)
    expect(body.data?.pendingWithdrawal).toBe(0)
  })

  it("钱包有真实余额时直接用余额，不经估算", async () => {
    ordersCall = 0
    const walletSingle = vi.fn().mockResolvedValue({
      data: { balance: 42 },
      error: null,
    })
    const walletChain = vi.fn().mockReturnValue({ single: walletSingle })
    // select→eq→eq→resolve：两层 eq，第二层直接 resolve。
    const pendingEq2 = vi.fn().mockResolvedValue({ data: [{ amount: 5 }], error: null })
    const pendingEq1 = vi.fn().mockReturnValue({ eq: pendingEq2 })

    mockSupabase.from.mockImplementation((table: string) => {
      if (table === "orders") {
        ordersCall += 1
        if (ordersCall === 1) {
          return { select: vi.fn().mockReturnValue({ eq: vi.fn().mockReturnValue({ eq: vi.fn().mockResolvedValue({ data: [{ amount: 100 }], error: null }) }) }) }
        }
        return { select: vi.fn().mockReturnValue({ or: vi.fn().mockReturnValue({ in: vi.fn().mockResolvedValue({ data: [], error: null }) }) }) }
      }
      if (table === "provider_wallets") {
        return { select: vi.fn().mockReturnValue({ eq: walletChain }) }
      }
      if (table === "withdrawal_requests") {
        return { select: vi.fn().mockReturnValue({ eq: pendingEq1 }) }
      }
      return { select: vi.fn() }
    })

    const res = await GET(new Request("http://local"), user)
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body.data?.availableBalance).toBe(42)
    expect(body.data?.pendingWithdrawal).toBe(5)
  })
})