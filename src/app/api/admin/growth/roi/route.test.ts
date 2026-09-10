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

const mockSingle = vi.fn()
const mockGte = vi.fn()

const mockSupabase = {
  from: vi.fn((table: string) => {
    if (table === "profiles") {
      return { select: () => ({ eq: () => ({ single: mockSingle }) }) }
    }
    return { select: () => ({ gte: mockGte }) }
  }),
}

vi.mock("@/lib/supabase-client", () => ({
  getServiceClient: () => mockSupabase,
}))

const { GET, aggregateRoi } = await import("./route")

const admin = { id: "admin-1" }

function getReq(days?: string) {
  const url = days === undefined ? "http://x/api/admin/growth/roi" : `http://x/api/admin/growth/roi?days=${days}`
  return { url } as unknown as Request
}

describe("aggregateRoi", () => {
  it("按 source+campaign 分组并按量倒序", () => {
    const rows = aggregateRoi([
      { attribution: { source: "douyin", campaign: "m20-launch" }, created_at: "2026-09-01T00:00:00Z" },
      { attribution: { source: "douyin", campaign: "m20-launch" }, created_at: "2026-09-03T00:00:00Z" },
      { attribution: { source: "xiaohongshu", campaign: "" }, created_at: "2026-09-02T00:00:00Z" },
    ])
    expect(rows).toHaveLength(2)
    expect(rows[0]).toMatchObject({ source: "douyin", campaign: "m20-launch", demands: 2 })
    expect(rows[0].first).toBe("2026-09-01T00:00:00Z")
    expect(rows[0].last).toBe("2026-09-03T00:00:00Z")
  })

  it("缺失归因归 direct", () => {
    const rows = aggregateRoi([
      { attribution: null, created_at: "2026-09-01T00:00:00Z" },
      { attribution: { source: "", campaign: 7 }, created_at: "2026-09-01T00:00:00Z" },
    ])
    expect(rows).toHaveLength(1)
    expect(rows[0]).toMatchObject({ source: "direct", campaign: "", demands: 2 })
  })
})

describe("GET /api/admin/growth/roi", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockSingle.mockResolvedValue({ data: { role: "ADMIN" }, error: null })
  })

  it("非 ADMIN 403", async () => {
    mockSingle.mockResolvedValue({ data: { role: "user" }, error: null })
    const res = (await GET(getReq(), admin)) as { status: number }
    expect(res.status).toBe(403)
  })

  it("ADMIN 聚合返回 rows+total+days", async () => {
    mockGte.mockResolvedValue({
      data: [
        { category_fields: { attribution: { source: "douyin", campaign: "c1" } }, created_at: "2026-09-02T00:00:00Z" },
        { category_fields: {}, created_at: "2026-09-03T00:00:00Z" },
      ],
      error: null,
    })
    const res = (await GET(getReq("7"), admin)) as {
      status: number
      json: () => Promise<{ rows: { source: string; demands: number }[]; total: number; days: number }>
    }
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.total).toBe(2)
    expect(body.days).toBe(7)
    expect(body.rows[0].source).toBe("douyin")
  })

  it("days 越界收敛到 1..90", async () => {
    mockGte.mockResolvedValue({ data: [], error: null })
    const res = (await GET(getReq("9999"), admin)) as {
      status: number
      json: () => Promise<{ days: number }>
    }
    expect((await res.json()).days).toBe(90)
  })
})
