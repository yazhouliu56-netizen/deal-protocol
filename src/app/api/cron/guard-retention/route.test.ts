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
const svcStorageFrom = vi.fn()

vi.mock("@/lib/supabase-client", () => ({
  getServiceClient: () => ({ from: svcFrom, storage: { from: svcStorageFrom } }),
}))

const { GET } = await import("./route")

const DAY = 86_400_000;
const NOW = 1_800_000_000_000;

function anchor(id: string, ageDays: number, tier: string, demandId: string | null) {
  return {
    id,
    payload: { demandId, tier },
    payload_ref: `guard-recordings/${demandId ?? "personal"}/u/${id}.webm`,
    created_at: new Date(NOW - ageDays * DAY).toISOString(),
  };
}

let anchors: ReturnType<typeof anchor>[];
let removed: string[][];
let marked: { id: string }[];
const savedSecret = process.env.CRON_SECRET;

function getReq(): Request {
  return new Request("http://localhost:3000/api/cron/guard-retention", {
    method: "GET",
    headers: { authorization: "Bearer test-cron" },
  });
}

beforeEach(() => {
  process.env.CRON_SECRET = "test-cron";
  svcFrom.mockReset();
  svcStorageFrom.mockReset();
  removed = [];
  marked = [];
  anchors = [
    anchor("old-b", 10, "B", "d-1"), // B clean 7 天 → 过期删
    anchor("fresh-b", 2, "B", "d-1"), // 未到期留
    anchor("old-a", 40, "A", "d-2"), // A clean 30 天 → 过期删
    anchor("open-d3", 20, "A", "d-3"), // d-3 有 OPEN 立案 → disputed 30 天 → 20 天留
  ];
  svcStorageFrom.mockImplementation(() => ({
    remove: async (paths: string[]) => {
      removed.push(paths);
      return { error: null };
    },
  }));
  svcFrom.mockImplementation((table: string) => {
    if (table === "evidence_log") {
      return {
        select: () => ({
          eq: () => ({
            order: () => ({ limit: async () => ({ data: anchors, error: null }) }),
          }),
        }),
        update: (row: Record<string, unknown>) => ({
          eq: (_col: string, val: string) => {
            marked.push({ id: val, ...(row as object) });
            return Promise.resolve({ error: null });
          },
        }),
      };
    }
    if (table === "contracts") {
      return {
        select: () => ({
          eq: (_col: string, val: string) => ({ limit: async () => ({ data: [{ id: `c-${val}` }] }) }),
        }),
      };
    }
    if (table === "disputes") {
      // 仅 d-3 的合同（c-d-3）有 OPEN 立案，其余无立案。
      const openFor = (contractId: string) => (contractId === "c-d-3" ? [{ id: "dp-9" }] : []);
      return {
        select: () => ({
          eq: (_col: string, val: string) => ({
            limit: async () => ({
              data: val === "c-d-3" ? [{ id: "dp-9", contract_id: val, status: "OPEN" }] : [],
            }),
            eq: () => ({ limit: async () => ({ data: openFor(val) }) }),
          }),
        }),
      };
    }
    throw new Error(`unexpected table ${table}`);
  });
  vi.spyOn(Date, "now").mockReturnValue(NOW);
});

afterEach(() => {
  vi.restoreAllMocks();
  if (savedSecret === undefined) delete process.env.CRON_SECRET;
  else process.env.CRON_SECRET = savedSecret;
});

describe("GET /api/cron/guard-retention（R-0928-09）", () => {
  it("401 无鉴权", async () => {
    const res = await GET(
      new Request("http://localhost:3000/api/cron/guard-retention", { method: "GET" }),
    );
    expect(res.status).toBe(401);
  });

  it("到期删字节＋锚标 purged；立案中不碰；链不断", async () => {
    const res = await GET(getReq());
    const json = (await res.json()) as { checked: number; purged: number; errors: string[] };
    expect(res.status).toBe(200);
    expect(json.checked).toBe(4);
    expect(json.purged).toBe(2);
    expect(json.errors).toEqual([]);
    expect(removed.flat().join(",")).toContain("old-b");
    expect(removed.flat().join(",")).toContain("old-a");
    expect(removed.flat().join(",")).not.toContain("open-d3");
    expect(marked.map((m) => m.id).sort()).toEqual(["old-a", "old-b"]);
  });

  it("OPEN 立案 → disputed 口径（40 天 A 照删，20 天 A 留）", async () => {
    anchors = [
      anchor("disp-40", 40, "A", "d-3"),
      anchor("disp-20", 20, "A", "d-3"),
    ];
    const res = await GET(getReq());
    const json = (await res.json()) as { purged: number };
    // d-3 全程 OPEN 立案 → disputed 30 天：40 天删，20 天留。
    expect(json.purged).toBe(1);
    expect(marked.map((m) => m.id)).toEqual(["disp-40"]);
  });
});
