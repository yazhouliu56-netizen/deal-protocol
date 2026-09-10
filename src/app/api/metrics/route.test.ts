import { describe, it, expect, vi, beforeEach } from "vitest"

vi.mock("next/server", () => ({
  NextResponse: {
    json: (body: unknown, init?: { status?: number }) => ({
      status: init?.status ?? 200,
      json: async () => body,
    }),
  },
}))

const mockInsert = vi.fn()

vi.mock("@/lib/supabase-client", () => ({
  getServiceClient: () => ({ from: () => ({ insert: mockInsert }) }),
}))

const { POST, parseMetricsBatch } = await import("./route")

function postReq(body: unknown, ip: string) {
  return {
    json: async () => body,
    headers: { get: (k: string) => (k === "x-forwarded-for" ? ip : null) },
  } as unknown as Request
}

describe("parseMetricsBatch", () => {
  it("合法批次通过", () => {
    const r = parseMetricsBatch({
      metrics: [
        { name: "growth.submit_click", value: 1, tags: { page: "m20", channel: "douyin" } },
        { name: "growth.demand_created", value: 1 },
      ],
    })
    expect(r.ok).toBe(true)
    expect(r.rows).toHaveLength(2)
    expect(r.rows[1].tags).toEqual({})
  })

  it("未知指标名整批拒绝", () => {
    expect(parseMetricsBatch({ metrics: [{ name: "hack.pwn", value: 1 }] }).ok).toBe(false)
  })

  it("非有限数值拒绝", () => {
    expect(parseMetricsBatch({ metrics: [{ name: "growth.verified", value: NaN }] }).ok).toBe(false)
    expect(parseMetricsBatch({ metrics: [{ name: "growth.verified", value: "1" }] }).ok).toBe(false)
  })

  it("空批次与超量批次拒绝", () => {
    expect(parseMetricsBatch({ metrics: [] }).ok).toBe(false)
    const big = Array.from({ length: 51 }, () => ({ name: "growth.verified", value: 1 }))
    expect(parseMetricsBatch({ metrics: big }).ok).toBe(false)
  })

  it("tags 非标拒绝（数组/超长/非字符串）", () => {
    const base = { name: "growth.verified", value: 1 }
    expect(parseMetricsBatch({ metrics: [{ ...base, tags: ["x"] }] }).ok).toBe(false)
    expect(parseMetricsBatch({ metrics: [{ ...base, tags: { a: "x".repeat(129) } }] }).ok).toBe(false)
    expect(parseMetricsBatch({ metrics: [{ ...base, tags: { a: 1 } }] }).ok).toBe(false)
  })
})

describe("POST /api/metrics", () => {
  beforeEach(() => {
    mockInsert.mockReset()
    mockInsert.mockResolvedValue({ error: null })
  })

  it("入库成功回 stored", async () => {
    const res = (await POST(
      postReq({ metrics: [{ name: "growth.submit_click", value: 1, tags: { page: "m20" } }] }, "10.9.0.1"),
    )) as { status: number; json: () => Promise<{ stored: number }> }
    expect(res.status).toBe(200)
    expect((await res.json()).stored).toBe(1)
    expect(mockInsert).toHaveBeenCalledOnce()
  })

  it("DB 失败仍 200 且 stored:0（遥测不阻断主流程）", async () => {
    mockInsert.mockResolvedValue({ error: { message: "db down" } })
    const res = (await POST(
      postReq({ metrics: [{ name: "growth.verified", value: 1 }] }, "10.9.0.2"),
    )) as { status: number; json: () => Promise<{ stored: number }> }
    expect(res.status).toBe(200)
    expect((await res.json()).stored).toBe(0)
  })

  it("非法体 200 且不写库", async () => {
    const res = (await POST(
      postReq({ metrics: [{ name: "nope", value: 1 }] }, "10.9.0.3"),
    )) as { status: number; json: () => Promise<{ stored: number }> }
    expect(res.status).toBe(200)
    expect((await res.json()).stored).toBe(0)
    expect(mockInsert).not.toHaveBeenCalled()
  })

  it("P1-T7 intent 四事件进白名单可落库", async () => {
    const res = (await POST(
      postReq(
        {
          metrics: [
            { name: "intent.assembled", value: 1 },
            { name: "intent.confirmed", value: 1 },
            { name: "intent.edit", value: 1 },
            { name: "intent.stale", value: 1 },
          ],
        },
        "10.9.0.4",
      ),
    )) as { status: number; json: () => Promise<{ stored: number }> }
    expect(res.status).toBe(200)
    expect((await res.json()).stored).toBe(4)
  })
})
