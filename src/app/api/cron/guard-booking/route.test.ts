import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

vi.mock("next/server", () => ({
  NextResponse: {
    json: (body: unknown, init?: { status?: number }) => ({
      status: init?.status ?? 200,
      json: async () => body,
    }),
  },
}))

const svcFrom = vi.fn()

vi.mock("@/lib/supabase-client", () => ({
  getServiceClient: () => ({ from: svcFrom }),
}))

const { GET } = await import("./route")

const savedSecret = process.env.CRON_SECRET;

function getReq(): Request {
  return new Request("http://localhost:3000/api/cron/guard-booking", {
    method: "GET",
    headers: { authorization: "Bearer test-cron" },
  });
}

beforeEach(() => {
  process.env.CRON_SECRET = "test-cron";
  svcFrom.mockReset();
});

afterEach(() => {
  vi.restoreAllMocks();
  if (savedSecret === undefined) delete process.env.CRON_SECRET;
  else process.env.CRON_SECRET = savedSecret;
});

describe("GET /api/cron/guard-booking（R-0928-12）", () => {
  it("401 无鉴权", async () => {
    const res = await GET(
      new Request("http://localhost:3000/api/cron/guard-booking", { method: "GET" }),
    );
    expect(res.status).toBe(401);
  });

  it("到期 BOOKED 批量转 OPEN（CAS：仅 BOOKED 行生效）", async () => {
    const updated: string[] = [];
    svcFrom.mockImplementation((table: string) => {
      if (table !== "demands") throw new Error(`unexpected table ${table}`);
      return {
        select: () => ({
          eq: () => ({
            lte: () => ({
              limit: async () => ({ data: [{ id: "d-1" }, { id: "d-2" }], error: null }),
            }),
          }),
        }),
        update: (row: Record<string, unknown>) => ({
          eq: (_col: string, val: string) => ({
            eq: async () => {
              updated.push(`${val}:${String(row.status)}`);
              return { error: null };
            },
          }),
        }),
      };
    });
    const res = await GET(getReq());
    const json = (await res.json()) as { checked: number; opened: number };
    expect(res.status).toBe(200);
    expect(json.checked).toBe(2);
    expect(json.opened).toBe(2);
    expect(updated).toEqual(["d-1:OPEN", "d-2:OPEN"]);
  });
});
