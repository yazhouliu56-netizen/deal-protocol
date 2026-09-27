import { describe, it, expect, vi, beforeEach } from "vitest";

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

const routeFrom = vi.fn()
const svcFrom = vi.fn()

vi.mock("@/lib/supabase-route-client", () => ({
  getRouteClient: async () => ({ from: routeFrom }),
}))

vi.mock("@/lib/supabase-client", () => ({
  getServiceClient: () => ({ from: svcFrom }),
}))

const { POST } = await import("./route")

const USER = { id: "provider-1" }
const DEMAND = { id: "d-1", demander_id: "demander-1", matched_provider_id: "provider-1" }

function makeReq(body: unknown): Request {
  return new Request("http://localhost:3000/api/guard/breadcrumb", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  })
}

function mockDemand(demand: typeof DEMAND | null) {
  routeFrom.mockImplementation(() => ({
    select: () => ({ eq: () => ({ single: async () => ({ data: demand, error: null }) }) }),
  }))
}

function mockLatest(rows: unknown[]) {
  svcFrom.mockImplementation((table: string) => {
    if (table !== "guard_breadcrumbs") throw new Error(`unexpected table ${table}`)
    return {
      insert: insertMock,
      select: () => ({
        eq: () => ({
          order: () => ({ limit: async () => ({ data: rows, error: null }) }),
        }),
      }),
    }
  })
}

const insertMock = vi.fn()

beforeEach(() => {
  routeFrom.mockReset()
  svcFrom.mockReset()
  insertMock.mockReset()
  insertMock.mockResolvedValue({ error: null })
})

describe("POST /api/guard/breadcrumb（ADR-0022）", () => {
  it("缺 demandId → 400，零触库", async () => {
    const res = await POST(makeReq({ lat: 30.1, lng: 120.1 }), USER)
    expect(res.status).toBe(400)
    expect(routeFrom).not.toHaveBeenCalled()
    expect(svcFrom).not.toHaveBeenCalled()
  })

  it("无坐标且非报平安 → 400", async () => {
    const res = await POST(makeReq({ demandId: "d-1" }), USER)
    expect(res.status).toBe(400)
    expect(svcFrom).not.toHaveBeenCalled()
  })

  it("非法坐标（超界）→ 400", async () => {
    const res = await POST(makeReq({ demandId: "d-1", lat: 91, lng: 120 }), USER)
    expect(res.status).toBe(400)
  })

  it("非履约双方 → 403 且不落盘", async () => {
    mockDemand(DEMAND)
    mockLatest([])
    const res = await POST(
      makeReq({ demandId: "d-1", lat: 30.1, lng: 120.1 }),
      { id: "stranger-9" },
    )
    expect(res.status).toBe(403)
    expect(insertMock).not.toHaveBeenCalled()
  })

  it("正常上传：坐标服务端截断 4 位 + self LIVE", async () => {
    mockDemand(DEMAND)
    mockLatest([])
    const res = await POST(
      makeReq({ demandId: "d-1", lat: 30.123456, lng: 120.654321, batteryLow: true }),
      USER,
    )
    const json = (await res.json()) as {
      ok: boolean
      persisted: boolean
      self: { state: string; batteryLow: boolean; lat: number; lng: number }
      peer: null
    }
    expect(res.status).toBe(200)
    expect(json.ok).toBe(true)
    expect(json.persisted).toBe(true)
    expect(json.self.state).toBe("LIVE")
    expect(json.self.batteryLow).toBe(true)
    expect(json.peer).toBe(null)
    expect(insertMock).toHaveBeenCalledTimes(1)
    const row = insertMock.mock.calls[0][0] as { lat: number; lng: number; checkin: boolean }
    expect(row.lat).toBe(30.1235)
    expect(row.lng).toBe(120.6543)
    expect(row.checkin).toBe(false)
  })

  it("手动报平安：无坐标落盘 checkin 行 + self LIVE", async () => {
    mockDemand(DEMAND)
    mockLatest([])
    const res = await POST(makeReq({ demandId: "d-1", checkin: true }), USER)
    const json = (await res.json()) as { ok: boolean; self: { state: string; checkin: boolean } }
    expect(res.status).toBe(200)
    expect(json.self.state).toBe("LIVE")
    expect(json.self.checkin).toBe(true)
    const row = insertMock.mock.calls[0][0] as { lat: null; lng: null; checkin: boolean }
    expect(row.lat).toBe(null)
    expect(row.checkin).toBe(true)
  })

  it("对方 12 分钟前上报 → peer DEGRADED（双可见，10~15min 复连窗外）", async () => {
    mockDemand(DEMAND)
    const peerAt = new Date(Date.now() - 12 * 60_000).toISOString()
    mockLatest([
      {
        reporter_id: "demander-1",
        lat: 30.1,
        lng: 120.1,
        accuracy_m: null,
        battery_low: false,
        gps_enabled: null,
        checkin: false,
        created_at: peerAt,
      },
    ])
    const res = await POST(makeReq({ demandId: "d-1", lat: 30.2, lng: 120.2 }), USER)
    const json = (await res.json()) as {
      self: { state: string }
      peer: { state: string; reasons: string[] }
    }
    expect(json.self.state).toBe("LIVE")
    expect(json.peer.state).toBe("DEGRADED")
    expect(json.peer.reasons).toContain("reconnect-window-exceeded")
  })

  it("落盘异常 → 200 persisted:false（宪法 #10，不阻断重试环）", async () => {
    mockDemand(DEMAND)
    mockLatest([])
    insertMock.mockResolvedValue({ error: { message: "db down" } })
    const res = await POST(makeReq({ demandId: "d-1", lat: 30.1, lng: 120.1 }), USER)
    const json = (await res.json()) as { ok: boolean; persisted: boolean; self: null }
    expect(res.status).toBe(200)
    expect(json.ok).toBe(true)
    expect(json.persisted).toBe(false)
    expect(json.self).toBe(null)
  })
})
