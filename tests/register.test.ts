import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("next/server", () => ({
  NextResponse: {
    json: (body: unknown, init?: { status?: number }) => ({
      status: init?.status ?? 200,
      json: async () => body,
    }),
  },
}));

const mockSignUp = vi.fn();
const mockProfilesInsert = vi.fn();
const mockUsersUpsert = vi.fn();

vi.mock("@/lib/supabase-client", () => ({
  getServiceClient: () => ({
    auth: {
      signUp: (...args: unknown[]) => mockSignUp(...args),
    },
    from: (table: string) => {
      if (table === "profiles") {
        return { insert: (...args: unknown[]) => mockProfilesInsert(...args) };
      }
      return { upsert: (...args: unknown[]) => mockUsersUpsert(...args) };
    },
  }),
}));

const UNIT_PW = "unit-test-pw";

function post(body: unknown) {
  return new Request("http://localhost/api/register", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  mockSignUp.mockResolvedValue({ data: { user: { id: "u-new-1" } }, error: null });
  mockProfilesInsert.mockReturnValue({
    select: () => ({
      single: () =>
        Promise.resolve({
          data: { id: "u-new-1", name: "Li", phone: "13900003333", role: "provider" },
          error: null,
        }),
    }),
  });
  mockUsersUpsert.mockResolvedValue({ error: null });
});

describe("POST /api/register", () => {
  it("非法 role（CUSTOMER/user/client/缺席）一律 400", async () => {
    const { POST } = await import("@/app/api/register/route");
    for (const role of ["CUSTOMER", "user", "client", undefined]) {
      const resp = await POST(
        post({ name: "x", email: "x@y.z", password: UNIT_PW, role }),
      );
      expect(resp.status).toBe(400);
    }
    expect(mockSignUp).not.toHaveBeenCalled();
  });

  it("provider 建号：profiles 只写 live 列 + users 回填", async () => {
    const { POST } = await import("@/app/api/register/route");
    const resp = await POST(
      post({ name: "Li", email: "li@x.com", password: UNIT_PW, phone: "13900003333", role: "provider" }),
    );
    expect(resp.status).toBe(201);
    expect(mockProfilesInsert).toHaveBeenCalledOnce();
    const payload = mockProfilesInsert.mock.calls[0][0] as Record<string, unknown>;
    expect(payload).toMatchObject({ id: "u-new-1", name: "Li", phone: "13900003333", role: "provider" });
    expect(payload).not.toHaveProperty("email");
    expect(payload).not.toHaveProperty("roles");
    expect(mockUsersUpsert).toHaveBeenCalledOnce();
    const usersPayload = mockUsersUpsert.mock.calls[0][0] as Record<string, unknown>;
    expect(usersPayload).toMatchObject({ id: "u-new-1", phone: "13900003333", role: "provider" });
  });

  it("无手机号：建号成功但跳过 users 回填（待绑手机补）", async () => {
    const { POST } = await import("@/app/api/register/route");
    const resp = await POST(
      post({ name: "Wang", email: "w@x.com", password: UNIT_PW, role: "demander" }),
    );
    expect(resp.status).toBe(201);
    expect(mockUsersUpsert).not.toHaveBeenCalled();
  });

  it("邮箱重复：409（不进 admin 兜底）", async () => {
    mockSignUp.mockResolvedValue({
      data: { user: null },
      error: { message: "User already registered" },
    });
    const { POST } = await import("@/app/api/register/route");
    const resp = await POST(
      post({ name: "x", email: "dup@x.com", password: UNIT_PW, role: "demander" }),
    );
    expect(resp.status).toBe(409);
    expect(mockProfilesInsert).not.toHaveBeenCalled();
  });
});
