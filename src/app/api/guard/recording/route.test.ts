import { describe, it, expect, vi, beforeEach } from "vitest";
import { createHash } from "node:crypto";

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

const { POST } = await import("./route")

const USER = { id: "provider-1" }

function makeReq(fields: Record<string, string | Blob>): Request {
  const fd = new FormData();
  for (const [k, v] of Object.entries(fields)) fd.append(k, v);
  return new Request("http://localhost:3000/api/guard/recording", { method: "POST", body: fd });
}

const BYTES = new Uint8Array([1, 2, 3, 4, 5]);
const EXPECTED_HASH = createHash("sha256").update(Buffer.from(BYTES)).digest("hex");

let anchors: Record<string, unknown>[];
let uploadError: { message: string } | null;
let chainRows: { hash: string }[];

beforeEach(() => {
  routeFrom.mockReset();
  svcFrom.mockReset();
  svcStorageFrom.mockReset();
  anchors = [];
  uploadError = null;
  chainRows = [];
  routeFrom.mockImplementation(() => ({
    select: () => ({
      eq: () => ({
        single: async () => ({
          data: { id: "d-1", demander_id: "demander-1", matched_provider_id: "provider-1" },
          error: null,
        }),
      }),
    }),
  }));
  svcStorageFrom.mockImplementation(() => ({
    upload: async () => (uploadError ? { data: null, error: uploadError } : { data: { path: "p" }, error: null }),
  }));
  svcFrom.mockImplementation((table: string) => {
    if (table !== "evidence_log") throw new Error(`unexpected table ${table}`);
    return {
      select: () => ({
        eq: () => ({
          order: () => ({ limit: async () => ({ data: chainRows }) }),
        }),
      }),
      insert: async (row: Record<string, unknown>) => {
        anchors.push(row);
        return { error: null };
      },
    };
  });
});

function audio(): Blob {
  return new Blob([BYTES], { type: "audio/webm" });
}

describe("POST /api/guard/recording（R-0928-08/09）", () => {
  it("B 档落盘：服务端哈希＋私有桶路径＋GENESIS 起链", async () => {
    const res = await POST(makeReq({ file: audio(), tier: "B", demandId: "d-1" }), USER);
    const json = (await res.json()) as { ok: boolean; hash: string; path: string; prevHash: string };
    expect(res.status).toBe(200);
    expect(json.ok).toBe(true);
    expect(json.hash).toBe(EXPECTED_HASH);
    expect(json.path.startsWith("guard-recordings/d-1/provider-1/")).toBe(true);
    expect(json.prevHash).toBe("GENESIS");
    expect(anchors).toHaveLength(1);
    const a = anchors[0] as Record<string, unknown>;
    expect(a.event_type).toBe("RECORDING_SEALED");
    expect(a.order_id).toBe(null);
    expect(a.hash).toBe(EXPECTED_HASH);
    expect((a.payload as Record<string, unknown>).demandId).toBe("d-1");
  });

  it("续链：同 demand 上一锚哈希进 prev_hash", async () => {
    chainRows = [{ hash: "prev-abc" }];
    const res = await POST(makeReq({ file: audio(), tier: "A", demandId: "d-1" }), USER);
    const json = (await res.json()) as { prevHash: string };
    expect(json.prevHash).toBe("prev-abc");
    expect((anchors[0] as Record<string, unknown>).prev_hash).toBe("prev-abc");
  });

  it("C 档禁音 → 403，不触存储", async () => {
    const res = await POST(makeReq({ file: audio(), tier: "C" }), USER);
    expect(res.status).toBe(403);
    expect(svcStorageFrom).not.toHaveBeenCalled();
  });

  it("超限/缺文件/非法 tier → 400", async () => {
    const big = new Blob([new Uint8Array(11 * 1024 * 1024)], { type: "audio/webm" });
    expect((await POST(makeReq({ file: big, tier: "B" }), USER)).status).toBe(400);
    expect((await POST(makeReq({ tier: "B" }), USER)).status).toBe(400);
    expect((await POST(makeReq({ file: audio(), tier: "Z" }), USER)).status).toBe(400);
  });

  it("非履约双方 → 403", async () => {
    routeFrom.mockImplementation(() => ({
      select: () => ({
        eq: () => ({
          single: async () => ({
            data: { id: "d-1", demander_id: "x", matched_provider_id: "y" },
            error: null,
          }),
        }),
      }),
    }));
    const res = await POST(makeReq({ file: audio(), tier: "B", demandId: "d-1" }), USER);
    expect(res.status).toBe(403);
  });

  it("存储失败 → 500（客户端重试；不进锚）", async () => {
    uploadError = { message: "bucket down" };
    const res = await POST(makeReq({ file: audio(), tier: "B" }), USER);
    expect(res.status).toBe(500);
    expect(anchors).toHaveLength(0);
  });

  it("JSON 否决锚：A＋demandId 留 TAMPER 痕；缺参/非双方 400/403", async () => {
    const denyReq = (body: unknown) =>
      new Request("http://localhost:3000/api/guard/recording", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body),
      });
    const res = await POST(denyReq({ tier: "A", demandId: "d-1" }), USER);
    expect(res.status).toBe(200);
    expect(anchors).toHaveLength(1);
    const a = anchors[0] as Record<string, unknown>;
    expect(a.event_type).toBe("RECORDING_TAMPER_DENIED");
    expect(a.captured_by).toBe("provider-1");
    expect((await POST(denyReq({ tier: "B", demandId: "d-1" }), USER)).status).toBe(400);
    expect((await POST(denyReq({ tier: "A" }), USER)).status).toBe(400);
  });
});
