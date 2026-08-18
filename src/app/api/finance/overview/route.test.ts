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

  const profileSingle = vi.fn().mockResolvedValue({ data: null, error: null })
  const profileChain = vi.fn().mockReturnValue({ single: profileSingle })

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
    if (table === "profiles") {
      return { select: vi.fn().mockReturnValue({ eq: profileChain }) }
    }
    return { select: vi.fn() }
  })
}

beforeEach(() => {
  mockSupabase.from.mockClear()
})

describe("finance/overview 资金概览（P0-2 收编口径）", () => {
  it("profile 无余额时，可用余额按 escrow 净得口径估算（平台费 10% → 90%）", async () => {
    setupOrders([100, 200])
    const res = await GET(new Request("http://local"), user)
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body.data?.totalEarned).toBe(300)
    expect(body.data?.availableBalance).toBe(270)
  })

  it("profile 有真实余额时直接用余额，不经估算", async () => {
    ordersCall = 0
    const profileSingle = vi.fn().mockResolvedValue({
      data: { balance: 42, pending_withdrawal: 0 },
      error: null,
    })
    const profileChain = vi.fn().mockReturnValue({ single: profileSingle })

    mockSupabase.from.mockImplementation((table: string) => {
      if (table === "orders") {
        ordersCall += 1
        if (ordersCall === 1) {
          return { select: vi.fn().mockReturnValue({ eq: vi.fn().mockReturnValue({ eq: vi.fn().mockResolvedValue({ data: [{ amount: 100 }], error: null }) }) }) }
        }
        return { select: vi.fn().mockReturnValue({ or: vi.fn().mockReturnValue({ in: vi.fn().mockResolvedValue({ data: [], error: null }) }) }) }
      }
      if (table === "profiles") {
        return { select: vi.fn().mockReturnValue({ eq: profileChain }) }
      }
      return { select: vi.fn() }
    })

    const res = await GET(new Request("http://local"), user)
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body.data?.availableBalance).toBe(42)
  })
})