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
  withAuth: (fn: (req: Request, user: { id: string }, ...rest: unknown[]) => unknown) =>
    (req: Request, ctx?: unknown) =>
      fn(req, { id: "demander-1" }, ctx ?? { params: Promise.resolve({ id: "d-1" }) }),
}))

vi.mock("@/ammo/registry", () => ({
  resolveAmmoByFreeText: () => null,
  getAmmoById: () => ({ supplyCluster: "C1" }),
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

function makeReq(): Request {
  return new Request("http://localhost:3000/api/demands/d-1/confirm-arrival", { method: "POST" });
}

let demandRow: Record<string, unknown> | null;
let updated: Record<string, unknown>[];
let anchors: Record<string, unknown>[];

beforeEach(() => {
  routeFrom.mockReset();
  svcFrom.mockReset();
  updated = [];
  anchors = [];
  demandRow = {
    id: "d-1",
    demander_id: "demander-1",
    matched_provider_id: "provider-1",
    status: "ARRIVED",
    title: "保洁",
    arrival_confirmed_at: null,
  };
  routeFrom.mockImplementation((table: string) => {
    if (table !== "demands") throw new Error(`route unexpected table ${table}`);
    return {
      select: () => ({ eq: () => ({ single: async () => ({ data: demandRow, error: null }) }) }),
      update: (row: Record<string, unknown>) => ({
        eq: () => ({
          eq: async () => {
            updated.push(row);
            return { error: null };
          },
        }),
      }),
    };
  });
  svcFrom.mockImplementation((table: string) => {
    if (table === "contracts") {
      return {
        select: () => ({ eq: () => ({ limit: async () => ({ data: [], error: null }) }) }),
      };
    }
    if (table === "evidence_log") {
      return {
        insert: async (row: Record<string, unknown>) => {
          anchors.push(row);
          return { error: null };
        },
      };
    }
    throw new Error(`svc unexpected table ${table}`);
  });
});

describe("POST confirm-arrival（R-0928-08 双确认）", () => {
  it("需求方确认：落 confirmed_at＋首单 ENHANCED 落 auto-start 锚", async () => {
    const res = await POST(makeReq());
    const json = (await res.json()) as { ok: boolean; autoRecord: boolean; anchored: boolean };
    expect(res.status).toBe(200);
    expect(json.ok).toBe(true);
    expect(updated).toHaveLength(1);
    expect(json.autoRecord).toBe(true);
    expect(json.anchored).toBe(true);
    expect(anchors).toHaveLength(1);
    const a = anchors[0] as Record<string, unknown>;
    expect(a.event_type).toBe("RECORDING_AUTOSTART");
    expect((a.payload as Record<string, unknown>).tier).toBe("A");
  });

  it("非 ARRIVED → 409；非需求方 → 403；重复 → already 幂等", async () => {
    demandRow = { ...demandRow, status: "STARTED" };
    expect((await POST(makeReq())).status).toBe(409);
    demandRow = { ...(demandRow as object), status: "ARRIVED", demander_id: "other" } as Record<string, unknown>;
    expect((await POST(makeReq())).status).toBe(403);
    demandRow = {
      id: "d-1",
      demander_id: "demander-1",
      matched_provider_id: "provider-1",
      status: "ARRIVED",
      arrival_confirmed_at: "2026-09-28T10:00:00Z",
    };
    const res = await POST(makeReq());
    const json = (await res.json()) as { already: boolean };
    expect(res.status).toBe(200);
    expect(json.already).toBe(true);
    expect(anchors).toHaveLength(0);
  });
});
