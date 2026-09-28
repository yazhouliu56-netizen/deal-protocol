import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("next/server", () => ({
  NextResponse: {
    json: (body: unknown, init?: { status?: number }) => ({
      status: init?.status ?? 200,
      json: async () => body,
    }),
  },
  after: () => {},
}))

vi.mock("next/cache", () => ({
  revalidatePath: () => {},
}))

vi.mock("@/lib/api-auth", () => ({
  withAuth: (fn: (req: Request, user: { id: string }) => unknown) => fn,
}))

vi.mock("@/lib/rate-limit", () => ({
  checkRateLimit: () => ({ allowed: true, resetAt: 0 }),
  rateLimitResponse: () => ({ status: 429, json: async () => ({}) }),
  RULE_DEFAULT: {},
}))

vi.mock("@/lib/platform/config", () => ({
  getConfig: async () => ({ fees: { publishFee: { freePerDay: 99, unitPrice: 1 } } }),
}))

const svcFrom = vi.fn()

vi.mock("@/lib/supabase-route-client", () => ({
  getRouteClient: async () => ({ from: svcFrom }),
}))

vi.mock("@/lib/supabase-client", () => ({
  getServiceClient: () => ({ from: svcFrom }),
}))

const { POST } = await import("./route");

const USER = { id: "demander-1" }
const FULL_PROFILE = {
  verification_status: "approved",
  phone_verified_at: "2026-09-01T00:00:00Z",
  verification_id_number: "110101199001011234",
  face_verified_at: "2026-09-01T00:00:00Z",
  created_at: "2026-09-27T00:00:00Z",
}

function makeReq(body: unknown): Request {
  return new Request("http://localhost:3000/api/demands", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  })
}

let insertedRows: Record<string, unknown>[];
let demandInsertError: { message: string } | null;
let deletedProtocols: string[];

function mockSvc() {
  insertedRows = [];
  demandInsertError = null;
  deletedProtocols = [];
  svcFrom.mockImplementation((table: string) => {
    if (table === "profiles") {
      return {
        select: () => ({ eq: () => ({ single: async () => ({ data: FULL_PROFILE, error: null }) }) }),
      };
    }
    if (table === "protocols") {
      return {
        insert: () => ({ select: () => ({ single: async () => ({ data: { id: "p-1" }, error: null }) }) }),
        delete: () => ({ eq: (col: string, val: string) => {
          void col;
          deletedProtocols.push(val);
          return Promise.resolve({ error: null });
        } }),
      };
    }
    if (table === "demands") {
      return {
        select: (_cols: string, opts?: { count?: string }) =>
          opts?.count
            ? { eq: () => ({ gte: async () => ({ count: 0, error: null }) }) }
            : { eq: () => ({ single: async () => ({ data: null, error: null }) }) },
        insert: (row: Record<string, unknown>) => ({
          select: () => ({
            single: async () => {
              if (demandInsertError) return { data: null, error: demandInsertError };
              insertedRows.push(row);
              return { data: { id: "d-1" }, error: null };
            },
          }),
        }),
      };
    }
    if (table === "custom_dim_floors") {
      return { select: () => ({ eq: async () => ({ data: [], error: null }) }) };
    }
    throw new Error(`unexpected table ${table}`);
  });
}

beforeEach(() => {
  svcFrom.mockReset();
  mockSvc();
});

const NOW = 1_800_000_000_000;
const iso = (ms: number) => new Date(ms).toISOString();

describe("POST /api/demands · 预约建单（R-0928-12）", () => {
  it("即时单（无时段）：OPEN 且不带时段键（老库字节等价）", async () => {
    const res = await POST(makeReq({ title: "修水管", budget: 100, category: "维修" }), USER);
    expect(res.status).toBe(201);
    expect(insertedRows).toHaveLength(1);
    const row = insertedRows[0] as Record<string, unknown>;
    expect(row.status).toBe("OPEN");
    expect("timeslot_start" in row).toBe(false);
    expect("timeslot_end" in row).toBe(false);
  });

  it("未来时段：BOOKED＋归一化时段列", async () => {
    const res = await POST(
      makeReq({
        title: "周三保洁",
        budget: 200,
        category: "保洁",
        timeslotStart: iso(NOW + 7 * 24 * 3600_000),
        timeslotEnd: iso(NOW + 7 * 24 * 3600_000 + 2 * 3600_000),
      }),
      USER,
    );
    expect(res.status).toBe(201);
    const row = insertedRows[0] as Record<string, unknown>;
    expect(row.status).toBe("BOOKED");
    expect(typeof row.timeslot_start).toBe("string");
    expect(typeof row.timeslot_end).toBe("string");
  });

  it("非法时段（倒挂）：400", async () => {
    const res = await POST(
      makeReq({
        title: "保洁",
        budget: 200,
        category: "保洁",
        timeslotStart: iso(NOW + 2 * 3600_000),
        timeslotEnd: iso(NOW + 3600_000),
      }),
      USER,
    );
    expect(res.status).toBe(400);
    expect(insertedRows).toHaveLength(0);
  });

  it("老库缺时段列：预约单 fail-closed 报迁移＋补偿删 protocol", async () => {
    demandInsertError = { message: 'column "timeslot_start" does not exist' };
    const res = await POST(
      makeReq({
        title: "周三保洁",
        budget: 200,
        category: "保洁",
        timeslotStart: iso(NOW + 7 * 24 * 3600_000),
        timeslotEnd: iso(NOW + 7 * 24 * 3600_000 + 2 * 3600_000),
      }),
      USER,
    );
    expect(res.status).toBe(500);
    const json = (await res.json()) as { error: string };
    expect(json.error).toContain("timeslot");
    expect(deletedProtocols).toEqual(["p-1"]);
  });
});
