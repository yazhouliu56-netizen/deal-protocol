import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("next/server", () => ({
  NextResponse: {
    json: (body: unknown, init?: { status?: number }) => ({
      status: init?.status ?? 200,
      json: async () => body,
    }),
  },
}));

const mockSupabase = { from: vi.fn() };

vi.mock("@/lib/supabase-client", () => ({
  getServiceClient: () => mockSupabase,
}));

vi.mock("@/lib/supabase-route-client", () => ({
  getRouteClient: () => mockSupabase,
}));

vi.mock("@supabase/ssr", () => ({
  createServerClient: () => ({
    auth: {
      signInWithPassword: vi.fn().mockResolvedValue({ error: null }),
    },
  }),
}));

vi.mock("next/headers", () => ({
  cookies: () => ({
    getAll: () => [],
    set: vi.fn(),
  }),
}));

let smsStore = new Map<string, { code: string; expiresAt: number }>();

vi.mock("@/lib/sms-code-store", () => ({
  setSmsCode: (phone: string, code: string) => {
    smsStore.set(phone, { code, expiresAt: Date.now() + 300000 });
  },
  getSmsCode: (phone: string) => {
    const entry = smsStore.get(phone);
    if (!entry || entry.expiresAt < Date.now()) return null;
    return entry.code;
  },
  deleteSmsCode: (phone: string) => {
    smsStore.delete(phone);
  },
}));

function mockProfilesFind(existing: Record<string, unknown> | null) {
  const maybeSingle = vi.fn().mockResolvedValue({
    data: existing,
    error: existing ? null : new Error("not found"),
  });
  const eqPhone = vi.fn().mockReturnValue({ maybeSingle });
  const selectProfiles = vi.fn().mockReturnValue({ eq: eqPhone });
  const insert = vi.fn().mockResolvedValue({ error: null });
  const upsert = vi.fn().mockResolvedValue({ error: null });

  mockSupabase.from.mockImplementation((table: string) => {
    if (table === "profiles") {
      return { select: selectProfiles, insert, upsert, update: vi.fn() };
    }
    return { select: vi.fn().mockReturnValue({ eq: vi.fn().mockReturnValue({ maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }) }) }), insert: vi.fn(), upsert, update: vi.fn() };
  });

  return { insert, upsert, selectProfiles };
}

beforeEach(() => {
  vi.clearAllMocks();
  smsStore = new Map();
  vi.stubGlobal("crypto", { randomUUID: () => "mock-uuid-000000000000" });
});

describe("POST /api/auth/sms/send", () => {
  it("should reject invalid phone number format (Test 1)", async () => {
    const { POST } = await import("@/app/api/auth/sms/send/route");

    const resp = await POST(
      new Request("http://localhost/api/auth/sms/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone: "12345" }),
      }),
    );
    const body = await resp.json();
    expect(resp.status).toBe(400);
    expect(body.success).toBe(false);
    expect(body.error).toContain("手机号");
  });

  it("白名单测试号段可走 Mock 验码", async () => {
    mockProfilesFind(null);
    const { POST } = await import("@/app/api/auth/sms/send/route");

    const resp = await POST(
      new Request("http://localhost/api/auth/sms/send", {
        method: "POST",
        // 独立 IP 配额：避免与同文件其他 send 用例挤占 1/min 限流。
        headers: { "Content-Type": "application/json", "x-forwarded-for": "10.9.0.11" },
        body: JSON.stringify({ phone: "13000000003" }),
      }),
    );
    const body = await resp.json();
    expect(resp.status).toBe(200);
    expect(body.success).toBe(true);
    expect(body.mockCode).toBe("888888");
  });

  it("非白名单真实号在网关缺席时 fail-closed（P0 风控）", async () => {
    mockProfilesFind(null);
    const { POST } = await import("@/app/api/auth/sms/send/route");

    const resp = await POST(
      new Request("http://localhost/api/auth/sms/send", {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-forwarded-for": "10.9.0.12" },
        body: JSON.stringify({ phone: "13800138000" }),
      }),
    );
    const body = await resp.json();
    expect(resp.status).toBe(503);
    expect(body.success).toBe(false);
    expect(body.error).toBe("SMS_GATEWAY_NOT_CONFIGURED");
    expect(body).not.toHaveProperty("mockCode");
  });
});

describe("POST /api/auth/sms/verify", () => {
  it("should auto-register and login new phone user (Test 2)", async () => {
    const existingUser = null;
    mockProfilesFind(existingUser);
    const { setSmsCode } = await import("@/lib/sms-code-store");
    setSmsCode("13800138000", "888888");

    vi.stubGlobal("fetch", vi.fn().mockImplementation((url: string) => {
      if (url.includes("/auth/v1/admin/users") && url.endsWith("/auth/v1/admin/users")) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ id: "new-user-id" }),
          text: () => Promise.resolve(""),
        });
      }
      if (url.includes("/auth/v1/admin/users/")) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({}),
          text: () => Promise.resolve(""),
        });
      }
      return Promise.reject(new Error(`unhandled url: ${url}`));
    }));

    const { POST } = await import("@/app/api/auth/sms/verify/route");

    const resp = await POST(
      new Request("http://localhost/api/auth/sms/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone: "13800138000", code: "888888" }),
      }),
    );
    const body = await resp.json();
    expect(resp.status).toBe(200);
    expect(body.success).toBe(true);
    expect(body.isNewUser).toBe(true);
    expect(body.user.phone).toBe("13800138000");
  });

  it("建号 insert 只写真实列：无 roles 键（线上表结构回归）", async () => {
    const { insert } = mockProfilesFind(null);
    const { setSmsCode } = await import("@/lib/sms-code-store");
    setSmsCode("13700137000", "888888");

    vi.stubGlobal("fetch", vi.fn().mockImplementation((url: string) => {
      if (url.includes("/auth/v1/admin/users") && url.endsWith("/auth/v1/admin/users")) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ id: "col-user-id" }),
          text: () => Promise.resolve(""),
        });
      }
      if (url.includes("/auth/v1/admin/users/")) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({}),
          text: () => Promise.resolve(""),
        });
      }
      return Promise.reject(new Error(`unhandled url: ${url}`));
    }));

    const { POST } = await import("@/app/api/auth/sms/verify/route");

    const resp = await POST(
      new Request("http://localhost/api/auth/sms/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone: "13700137000", code: "888888" }),
      }),
    );
    expect(resp.status).toBe(200);
    expect(insert).toHaveBeenCalledOnce();
    const payload = insert.mock.calls[0][0] as Record<string, unknown>;
    expect(payload).toMatchObject({
      id: "col-user-id",
      phone: "13700137000",
      role: "demander",
    });
    expect(payload).not.toHaveProperty("roles");
  });

  it("should reject wrong verification code", async () => {
    mockProfilesFind(null);

    const { POST } = await import("@/app/api/auth/sms/verify/route");

    const resp = await POST(
      new Request("http://localhost/api/auth/sms/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone: "13800138000", code: "000000" }),
      }),
    );
    const body = await resp.json();
    expect(resp.status).toBe(400);
    expect(body.success).toBe(false);
  });

  it("should login existing phone user", async () => {
    const existingUser = {
      id: "existing-user-id",
      name: "老用户",
      phone: "13900139000",
      role: "demander",
      created_at: "2026-01-01T00:00:00Z",
    };
    const { insert: _insert } = mockProfilesFind(existingUser);
    const { setSmsCode } = await import("@/lib/sms-code-store");
    setSmsCode("13900139000", "888888");

    vi.stubGlobal("fetch", vi.fn().mockImplementation((url: string) => {
      if (url.includes("/auth/v1/admin/users/")) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({}),
          text: () => Promise.resolve(""),
        });
      }
      return Promise.reject(new Error(`unhandled url: ${url}`));
    }));

    const { POST } = await import("@/app/api/auth/sms/verify/route");

    const resp = await POST(
      new Request("http://localhost/api/auth/sms/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone: "13900139000", code: "888888" }),
      }),
    );
    const body = await resp.json();
    expect(resp.status).toBe(200);
    expect(body.success).toBe(true);
    expect(body.isNewUser).toBe(false);
    expect(body.user.id).toBe("existing-user-id");
  });
});
