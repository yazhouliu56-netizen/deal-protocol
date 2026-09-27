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

const { GET } = await import("./route")

const USER = { id: "provider-1" }
const DEMAND = { id: "d-1", demander_id: "demander-1", matched_provider_id: "provider-1" }

function makeReq(demandId: string): Request {
  return new Request(`http://localhost:3000/api/guard/state?demandId=${demandId}`, {
    method: "GET",
  })
}

function row(reporter: string, minAgo: number, extra: Record<string, unknown> = {}) {
  return {
    reporter_id: reporter,
    lat: 30.1,
    lng: 120.1,
    accuracy_m: null,
    battery_low: false,
    gps_enabled: null,
    checkin: false,
    created_at: new Date(Date.now() - minAgo * 60_000).toISOString(),
    ...extra,
  }
}

beforeEach(() => {
  routeFrom.mockReset()
  svcFrom.mockReset()
  routeFrom.mockImplementation(() => ({
    select: () => ({ eq: () => ({ single: async () => ({ data: DEMAND, error: null }) }) }),
  }))
})

function mockLatest(rows: unknown[]) {
  svcFrom.mockImplementation(() => ({
    select: () => ({
      eq: () => ({ order: () => ({ limit: async () => ({ data: rows, error: null }) }) }),
    }),
  }))
}

describe("GET /api/guard/state（ADR-0022 双可见）", () => {
  it("缺 demandId → 400", async () => {
    const res = await GET(makeReq(""), USER)
    expect(res.status).toBe(400)
  })

  it("非履约双方 → 403", async () => {
    routeFrom.mockImplementation(() => ({
      select: () => ({
        eq: () => ({ single: async () => ({ data: DEMAND, error: null }) }),
      }),
    }))
    mockLatest([])
    const res = await GET(makeReq("d-1"), { id: "stranger-9" })
    expect(res.status).toBe(403)
  })

  it("零面包屑 → self/peer 双 null（待启动态，不惊扰）", async () => {
    mockLatest([])
    const res = await GET(makeReq("d-1"), USER)
    const json = (await res.json()) as { ok: boolean; self: null; peer: null }
    expect(res.status).toBe(200)
    expect(json.ok).toBe(true)
    expect(json.self).toBe(null)
    expect(json.peer).toBe(null)
  })

  it("双方各一：self LIVE + peer LOST（20min→DEGRADED 边界外 60min 升级）", async () => {
    mockLatest([row("provider-1", 2), row("demander-1", 60)])
    const res = await GET(makeReq("d-1"), USER)
    const json = (await res.json()) as {
      self: { state: string }
      peer: { state: string; lastSeenMs: number }
    }
    expect(json.self.state).toBe("LIVE")
    expect(json.peer.state).toBe("LOST")
    expect(json.peer.lastSeenMs).toBeLessThan(Date.now() - 30 * 60_000)
  })

  it("对方关 GPS → peer TAMPER（不等窗口即时标记）", async () => {
    mockLatest([row("provider-1", 1), row("demander-1", 1, { gps_enabled: false })])
    const res = await GET(makeReq("d-1"), USER)
    const json = (await res.json()) as { peer: { state: string; reasons: string[] } }
    expect(json.peer.state).toBe("TAMPER")
    expect(json.peer.reasons).toContain("gps-off")
  })
})
