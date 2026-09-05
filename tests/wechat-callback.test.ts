import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("next/server", () => ({
  NextResponse: {
    json: (body: unknown, init?: { status?: number }) => ({
      status: init?.status ?? 200,
      json: async () => body,
    }),
    redirect: (url: string | URL) => ({
      status: 307,
      headers: new Map([["location", String(url)]]),
    }),
  },
}));

const chain = {
  insert: vi.fn(),
  maybeSingle: vi.fn(),
  single: vi.fn(),
  eq: vi.fn(),
  select: vi.fn(),
};

vi.mock("@/lib/supabase-client", () => ({
  getServiceClient: () => ({
    from: () => ({
      select: (...args: unknown[]) => {
        chain.select(...args);
        return { eq: chain.eq };
      },
      insert: (...args: unknown[]) => {
        chain.insert(...args);
        return { select: () => ({ single: chain.single }) };
      },
    }),
  }),
}));

function wireLookup(existing: { id: string } | null) {
  chain.maybeSingle.mockResolvedValue({ data: existing, error: null });
  chain.eq.mockReturnValue({ maybeSingle: chain.maybeSingle });
  chain.single.mockResolvedValue({ data: existing ?? { id: "wx-new" }, error: null });
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("GET /api/auth/wechat/callback", () => {
  it("缺 code 回登录页", async () => {
    const { GET } = await import("@/app/api/auth/wechat/callback/route");
    const resp = (await GET(new Request("http://localhost/api/auth/wechat/callback"))) as unknown as {
      status: number;
      headers: Map<string, string>;
    };
    expect(resp.status).toBe(307);
    expect(resp.headers.get("location")).toContain("missing_code");
    expect(chain.insert).not.toHaveBeenCalled();
  });

  it("建号只写 live 安全列：无 roles/wechat_openid/CUSTOMER", async () => {
    wireLookup(null);
    const { GET } = await import("@/app/api/auth/wechat/callback/route");
    await GET(new Request("http://localhost/api/auth/wechat/callback?code=testcode123"));
    expect(chain.insert).toHaveBeenCalledOnce();
    const payload = chain.insert.mock.calls[0][0] as Record<string, unknown>;
    expect(payload).toMatchObject({ role: "user" });
    expect(String(payload.name)).toMatch(/^wx_/);
    expect(payload).not.toHaveProperty("roles");
    expect(payload).not.toHaveProperty("wechat_openid");
    expect(payload).not.toHaveProperty("CUSTOMER");
    expect(Object.values(payload)).not.toContain("CUSTOMER");
  });

  it("回头客按 name 幂等：不再重复插入", async () => {
    wireLookup({ id: "wx-existing" });
    const { GET } = await import("@/app/api/auth/wechat/callback/route");
    await GET(new Request("http://localhost/api/auth/wechat/callback?code=testcode123"));
    expect(chain.insert).not.toHaveBeenCalled();
  });
});
