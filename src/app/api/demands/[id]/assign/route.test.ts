import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("next/server", () => ({
  NextResponse: {
    json: (body: unknown, init?: { status?: number }) => ({
      status: init?.status ?? 200,
      json: async () => body,
    }),
  },
}))

vi.mock("next/cache", () => ({
  revalidatePath: () => {},
}))

vi.mock("@/lib/api-auth", () => ({
  withAuth: (fn: (req: Request, user: { id: string }, ...rest: unknown[]) => unknown) =>
    (req: Request, ctx?: unknown) =>
      fn(req, { id: "provider-1" }, ctx ?? { params: Promise.resolve({ id: "d-1" }) }),
}))

vi.mock("@/lib/gang-rules", () => ({
  checkMutualBrushPair: async () => ({ hit: false }),
  meetupSafetyPackage: () => ({ send: false, reasons: [] }),
}))

vi.mock("@/ammo/registry", () => ({
  resolveAmmoByFreeText: () => null,
  getAmmoById: () => ({ supplyCluster: "C1" }),
}))

vi.mock("@/lib/platform/config", () => ({
  getConfig: async () => ({ fees: {} }),
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

const FULL_PROFILE = {
  verification_status: "approved",
  phone_verified_at: "2026-09-01T00:00:00Z",
  verification_id_number: "110101199001011234",
  face_verified_at: "2026-09-01T00:00:00Z",
  created_at: "2026-09-27T00:00:00Z",
}

const NOW = 1_800_000_000_000;
const iso = (ms: number) => new Date(ms).toISOString();
const H = 3_600_000;

let demandRow: Record<string, unknown> | null;
let activeRows: Record<string, unknown>[] | { __throw: true };
let updateCalls: number;
let notified: unknown[];

function makeReq(): Request {
  return new Request("http://localhost:3000/api/demands/d-1/assign", { method: "POST" });
}

function mockAll() {
  updateCalls = 0;
  notified = [];
  let eqCalls = 0;
  routeFrom.mockImplementation((table: string) => {
    if (table === "profiles") {
      return {
        select: () => ({ eq: () => ({ single: async () => ({ data: FULL_PROFILE, error: null }) }) }),
      };
    }
    if (table !== "demands") throw new Error(`route unexpected table ${table}`);
    return {
      select: () => ({ eq: () => ({ single: async () => ({ data: demandRow, error: null }) }) }),
      update: () => {
        updateCalls += 1;
        return {
          eq: () => {
            eqCalls += 1;
            if (eqCalls === 1) {
              return {
                eq: () => ({
                  select: async () => ({ data: [{ id: "d-1" }], error: null }),
                }),
              };
            }
            return Promise.resolve({ error: null });
          },
        };
      },
    };
  });
  svcFrom.mockImplementation((table: string) => {
    if (table === "profiles") {
      return {
        select: () => ({ eq: () => ({ single: async () => ({ data: FULL_PROFILE, error: null }) }) }),
      };
    }
    if (table === "contracts") {
      return {
        select: () => ({ eq: () => ({ limit: async () => ({ data: [], error: null }) }) }),
      };
    }
    if (table === "demands") {
      return {
        select: () => ({
          eq: () => ({
            in: async () => {
              if (Array.isArray(activeRows)) return { data: activeRows, error: null };
              throw new Error("db down");
            },
          }),
        }),
      };
    }
    if (table === "notifications" || table === "metric_events") {
      return {
        insert: async (rows: unknown) => {
          notified.push(rows);
          return { error: null };
        },
      };
    }
    throw new Error(`svc unexpected table ${table}`);
  });
}

beforeEach(() => {
  routeFrom.mockReset();
  svcFrom.mockReset();
  demandRow = { id: "d-1", demander_id: "demander-1", title: "保洁" };
  activeRows = [];
  mockAll();
});

describe("POST assign · 撞单保护（R-0928-12）", () => {
  it("即时单（无时段）：不查在途，直接放行 200", async () => {
    const res = await POST(makeReq());
    const json = (await res.json()) as { success: boolean };
    expect(res.status).toBe(200);
    expect(json.success).toBe(true);
    expect(svcFrom).not.toHaveBeenCalledWith("demands");
    expect(updateCalls).toBeGreaterThan(0);
  });

  it("预约单无冲突：200＋武装位", async () => {
    demandRow = {
      ...demandRow,
      timeslot_start: iso(NOW + H),
      timeslot_end: iso(NOW + 2 * H),
    };
    activeRows = [];
    mockAll();
    const res = await POST(makeReq());
    const json = (await res.json()) as { success: boolean; meetupGuard: { level: string; reasons: string[] } };
    expect(res.status).toBe(200);
    expect(json.success).toBe(true);
    expect(json.meetupGuard.level).toBe("ENHANCED");
    expect(json.meetupGuard.reasons).toContain("first-order");
  });

  it("预约单撞单：409 SLOT_CONFLICT，不写库", async () => {
    demandRow = {
      ...demandRow,
      timeslot_start: iso(NOW + H),
      timeslot_end: iso(NOW + 2 * H),
    };
    activeRows = [{ timeslot_start: iso(NOW + 1.5 * H), timeslot_end: iso(NOW + 3 * H) }];
    mockAll();
    const res = await POST(makeReq());
    const json = (await res.json()) as { reason: string; code: string };
    expect(res.status).toBe(409);
    expect(json.code).toBe("SLOT_CONFLICT");
    expect(updateCalls).toBe(0);
  });

  it("在途查询异常：fail-open 放行 200", async () => {
    demandRow = {
      ...demandRow,
      timeslot_start: iso(NOW + H),
      timeslot_end: iso(NOW + 2 * H),
    };
    activeRows = { __throw: true };
    mockAll();
    const res = await POST(makeReq());
    expect(res.status).toBe(200);
  });
});
