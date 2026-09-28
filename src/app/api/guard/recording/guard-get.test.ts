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
const svcStorageFrom = vi.fn()

vi.mock("@/lib/supabase-route-client", () => ({
  getRouteClient: async () => ({ from: routeFrom }),
}))

vi.mock("@/lib/supabase-client", () => ({
  getServiceClient: () => ({ from: svcFrom, storage: { from: svcStorageFrom } }),
}))

const { GET } = await import("./guard-get")

const USER = { id: "provider-1" }
const REF = "guard-recordings/d-1/provider-1/123.webm"

function anchor(over: Record<string, unknown> = {}) {
  return {
    hash: "h1",
    payload: { demandId: "d-1", tier: "B", mime: "audio/webm", bytes: 5 },
    payload_ref: REF,
    captured_by: "provider-1",
    created_at: new Date().toISOString(),
    ...over,
  };
}

function getReq(qs: string): Request {
  return new Request(`http://localhost:3000/api/guard/recording${qs}`, { method: "GET" });
}

let anchors: Record<string, unknown>[];
let auditRows: Record<string, unknown>[];
let disputeStatus: string | null;
let party: boolean;

beforeEach(() => {
  routeFrom.mockReset();
  svcFrom.mockReset();
  svcStorageFrom.mockReset();
  anchors = [anchor()];
  auditRows = [];
  disputeStatus = "OPEN";
  party = true;
  routeFrom.mockImplementation(() => ({
    select: () => ({
      eq: () => ({
        single: async () => ({
          data: party
            ? { id: "d-1", demander_id: "demander-1", matched_provider_id: "provider-1" }
            : { id: "d-1", demander_id: "x", matched_provider_id: "y" },
          error: null,
        }),
      }),
    }),
  }));
  svcStorageFrom.mockImplementation(() => ({
    createSignedUrl: async () => ({ data: { signedUrl: "https://signed/1" }, error: null }),
  }));
  svcFrom.mockImplementation((table: string) => {
    if (table === "evidence_log") {
      return {
        select: () => ({
          eq: (col: string, val: string) => {
            if (col === "payload_ref") {
              return {
                limit: async () => ({
                  data: anchors.filter((a) => (a as { payload_ref: string }).payload_ref === val),
                }),
              };
            }
            return {
              eq: () => ({
                order: () => ({
                  limit: async () => ({ data: anchors }),
                }),
              }),
            };
          },
        }),
        insert: async (row: Record<string, unknown>) => {
          auditRows.push(row);
          return { error: null };
        },
      };
    }
    if (table === "contracts") {
      return {
        select: () => ({
          eq: () => ({ limit: async () => ({ data: [{ id: "c-1", demand_id: "d-1" }] }) }),
        }),
      };
    }
    if (table === "disputes") {
      return {
        select: () => ({
          eq: (col: string, val: string) => {
            if (col === "contract_id") {
              const rows =
                disputeStatus === "OPEN" ? [{ id: "dp-1", contract_id: val, status: "OPEN" }] : [];
              // 双形状兼容：resolve 单 eq＋limit / playback 双 eq＋limit。
              return {
                limit: async () => ({ data: rows }),
                eq: () => ({ limit: async () => ({ data: rows }) }),
              };
            }
            return {
              eq: () => ({
                limit: async () => ({
                  data: disputeStatus === "OPEN" ? [{ id: "dp-1" }] : [],
                }),
              }),
            };
          },
        }),
      };
    }
    throw new Error(`unexpected table ${table}`);
  });
});

describe("GET /api/guard/recording（R-0928-09 立案解密）", () => {
  it("回放：OPEN 立案＋双方 → 60s URL＋审计锚", async () => {
    const res = await GET(getReq(`?path=${encodeURIComponent(REF)}`), USER);
    const json = (await res.json()) as { ok: boolean; url: string; expiresIn: number };
    expect(res.status).toBe(200);
    expect(json.ok).toBe(true);
    expect(json.url).toBe("https://signed/1");
    expect(json.expiresIn).toBe(60);
    expect(auditRows).toHaveLength(1);
    expect((auditRows[0] as Record<string, unknown>).event_type).toBe("RECORDING_ACCESSED");
  });

  it("无锚 → 404；个人录音 → 403；非法路径 → 400", async () => {
    anchors = [];
    expect((await GET(getReq(`?path=${encodeURIComponent(REF)}`), USER)).status).toBe(404);
    anchors = [anchor({ payload: { tier: "B" } })];
    expect((await GET(getReq(`?path=${encodeURIComponent(REF)}`), USER)).status).toBe(403);
    expect((await GET(getReq("?path=other/x"), USER)).status).toBe(400);
  });

  it("非双方 → 403；无 OPEN 立案 → 403 DISPUTE_REQUIRED", async () => {
    party = false;
    expect((await GET(getReq(`?path=${encodeURIComponent(REF)}`), USER)).status).toBe(403);
    party = true;
    disputeStatus = null;
    const res = await GET(getReq(`?path=${encodeURIComponent(REF)}`), USER);
    const json = (await res.json()) as { code: string };
    expect(res.status).toBe(403);
    expect(json.code).toBe("DISPUTE_REQUIRED");
  });

  it("列表 demandId：元数据无 URL，已销毁过滤", async () => {
    anchors = [anchor(), anchor({ payload_ref: REF + "2", payload: { demandId: "d-1", tier: "A", purged: true } })];
    const res = await GET(getReq("?demandId=d-1"), USER);
    const json = (await res.json()) as { ok: boolean; items: { ref: string; hash: string }[] };
    expect(res.status).toBe(200);
    expect(json.items).toHaveLength(1);
    expect(json.items[0].ref).toBe(REF);
    expect("url" in json.items[0]).toBe(false);
  });

  it("列表 disputeId：争议→合同→需求解析", async () => {
    disputeStatus = "OPEN";
    const res = await GET(getReq("?disputeId=dp-1"), USER);
    const json = (await res.json()) as { ok: boolean; items: unknown[] };
    expect(res.status).toBe(200);
    expect(json.items).toHaveLength(1);
  });

  it("缺参 → 400", async () => {
    expect((await GET(getReq(""), USER)).status).toBe(400);
  });
});
