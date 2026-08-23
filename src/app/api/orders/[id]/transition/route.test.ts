/**
 * Step 2 权威跃迁 API 路由单测。
 * 覆盖：正常发布/幂等发布、正常跃迁/CAS 409 双保险/状态漂移 409/幂等重放防重。
 * runner 不 mock —— advanceLifecycle 纯函数真跑（红线 1：被测物含确定性规则本身）。
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("next/server", () => ({
  NextResponse: {
    json: (body: unknown, init?: { status?: number }) => ({
      status: init?.status ?? 200,
      json: async () => body,
    }),
  },
}));

const mockDb = { from: vi.fn() };

vi.mock("@/lib/supabase-client", () => ({
  getServiceClient: () => mockDb,
}));

type Final = { data: unknown; error?: { message: string } | null };

/** 链式 builder：中间方法返回自身，终端方法出队结果。 */
function chain(...finals: Final[]) {
  let i = 0;
  const b: Record<string, unknown> = {};
  const next = (): Final => finals[Math.min(i++, finals.length - 1)];
  for (const m of ["select", "eq", "update", "insert", "delete"]) {
    b[m] = vi.fn(() => b);
  }
  b.maybeSingle = vi.fn(async () => next());
  b.single = vi.fn(async () => next());
  return b;
}

import { POST as publishPOST } from "@/app/api/orders/publish/route";

describe("POST /api/orders/publish", () => {
  beforeEach(() => vi.clearAllMocks());

  it("正常创建：201 PUBLISHED version=0 并写初始审计", async () => {
    const row = { order_no: "w-1", status: "PUBLISHED", version: 0 };
    mockDb.from.mockImplementation((table: string) => {
      if (table === "orders")
        return chain({ data: null }, { data: row });
      return chain({ data: null }); // order_state_logs insert
    });
    const res = await publishPOST(
      new Request("http://x/api/orders/publish", {
        method: "POST",
        body: JSON.stringify({
          orderNo: "w-1",
          userId: "u1",
          categoryCode: "housekeeping",
          totalAmountCents: 10000,
          payableAmountCents: 10000,
        }),
      }),
    ) as never as { status: number; json: () => Promise<{ idempotent: boolean }> };
    expect(res.status).toBe(201);
    expect((await res.json()).idempotent).toBe(false);
    expect(mockDb.from).toHaveBeenCalledWith("order_state_logs");
  });

  it("幂等重放：order_no 已存在 → 200 idempotent:true 零副作用", async () => {
    const row = { order_no: "w-1", status: "MATCHED", version: 2 };
    mockDb.from.mockReturnValue(chain({ data: row }));
    const res = await publishPOST(
      new Request("http://x/api/orders/publish", {
        method: "POST",
        body: JSON.stringify({
          orderNo: "w-1",
          userId: "u1",
          categoryCode: "housekeeping",
          totalAmountCents: 10000,
          payableAmountCents: 10000,
        }),
      }),
    ) as never as { status: number; json: () => Promise<{ idempotent: boolean; order: { version: number } }> };
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.idempotent).toBe(true);
    expect(body.order.version).toBe(2);
  });

  it("缺必填字段 → 400", async () => {
    const res = await publishPOST(
      new Request("http://x/api/orders/publish", {
        method: "POST",
        body: JSON.stringify({ orderNo: "w-1" }),
      }),
    ) as never as { status: number };
    expect(res.status).toBe(400);
  });
});

import { POST as transitionPOST } from "@/app/api/orders/[id]/transition/route";

const SNAPSHOT = {
  ammoId: "default-ammo",
  category: "housekeeping",
  version: "1.0.0",
  fiveStateHooks: [],
};

function req(orderNo: string, body: unknown, key?: string) {
  return new Request(`http://x/api/orders/${orderNo}/transition`, {
    method: "POST",
    headers: key ? { "x-idempotency-key": key } : {},
    body: JSON.stringify(body),
  });
}
const ctx = (orderNo: string) => ({ params: Promise.resolve({ id: orderNo }) });

describe("POST /api/orders/[id]/transition", () => {
  beforeEach(() => vi.clearAllMocks());

  it("正常跃迁 PUBLISHED→MATCHED：200 version 0→1 且留痕", async () => {
    const readRow = {
      order_no: "w-1", status: "PUBLISHED", version: 0,
      total_amount: 10000, payable_amount: 10000, ammo_id: null, kind: "solo",
    };
    mockDb.from.mockImplementation((table: string) => {
      if (table === "orders") return chain({ data: readRow }, { data: { order_no: "w-1" } });
      return chain({ data: null }); // order_state_logs insert
    });
    const res = await transitionPOST(
      req("w-1", { toState: "MATCHED", expectedVersion: 0, ammoSnapshot: SNAPSHOT }),
      ctx("w-1"),
    ) as never as { status: number; json: () => Promise<{ ok: boolean; state: string; version: number }> };
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.ok).toBe(true);
    expect(body.state).toBe("MATCHED");
    expect(body.version).toBe(1);
  });

  it("CAS 冲突：expectedVersion 与库内不符 → 409 OPTIMISTIC_LOCK_CONFLICT", async () => {
    const readRow = {
      order_no: "w-1", status: "PUBLISHED", version: 3,
      total_amount: 10000, payable_amount: 10000, ammo_id: null, kind: "solo",
    };
    mockDb.from.mockReturnValue(chain({ data: readRow }));
    const res = await transitionPOST(
      req("w-1", { toState: "MATCHED", expectedVersion: 0, ammoSnapshot: SNAPSHOT }),
      ctx("w-1"),
    ) as never as { status: number; json: () => Promise<{ error: string }> };
    expect(res.status).toBe(409);
    expect((await res.json()).error).toBe("OPTIMISTIC_LOCK_CONFLICT");
  });

  it("状态漂移：客户端投影态 ≠ 权威态 → 409 强制重读", async () => {
    const readRow = {
      order_no: "w-1", status: "PUBLISHED", version: 0,
      total_amount: 10000, payable_amount: 10000, ammo_id: null, kind: "solo",
    };
    mockDb.from.mockReturnValue(chain({ data: readRow }));
    const res = await transitionPOST(
      req("w-1", { fromState: "IN_SERVICE", toState: "INSPECTED", expectedVersion: 0, ammoSnapshot: SNAPSHOT }),
      ctx("w-1"),
    ) as never as { status: number; json: () => Promise<{ error: string; detail: { reason: string } }> };
    expect(res.status).toBe(409);
    expect((await res.json()).detail.reason).toBe("STATE_DRIFT");
  });

  it("非法跃迁 PUBLISHED→SETTLED 直跳 → 422 ILLEGAL_TRANSITION（矩阵封闭）", async () => {
    const readRow = {
      order_no: "w-1", status: "PUBLISHED", version: 0,
      total_amount: 10000, payable_amount: 10000, ammo_id: null, kind: "solo",
    };
    mockDb.from.mockReturnValue(chain({ data: readRow }));
    const res = await transitionPOST(
      req("w-1", { toState: "SETTLED", expectedVersion: 0, ammoSnapshot: SNAPSHOT }),
      ctx("w-1"),
    ) as never as { status: number; json: () => Promise<{ error: string }> };
    expect(res.status).toBe(422);
    expect((await res.json()).error).toBe("ILLEGAL_TRANSITION");
  });

  it("幂等重放：同 X-Idempotency-Key 第二次 → 200 idempotentReplay 零重复跃迁", async () => {
    const logHit = {
      order_no: "w-1", from_state: "PUBLISHED", to_state: "MATCHED",
      version_at_trans: 0, created_at: "2026-08-23T00:00:00Z",
    };
    const curRow = { status: "MATCHED", version: 1 };
    mockDb.from.mockImplementation((table: string) => {
      if (table === "order_state_logs") return chain({ data: logHit });
      return chain({ data: curRow });
    });
    const res = await transitionPOST(
      req("w-1", { toState: "MATCHED", expectedVersion: 0 }, "idem-key-1"),
      ctx("w-1"),
    ) as never as { status: number; json: () => Promise<{ idempotentReplay: boolean; state: string; version: number }> };
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.idempotentReplay).toBe(true);
    expect(body.state).toBe("MATCHED");
    expect(body.version).toBe(1);
  });

  it("订单不存在 → 404", async () => {
    mockDb.from.mockReturnValue(chain({ data: null }));
    const res = await transitionPOST(
      req("ghost", { toState: "MATCHED", expectedVersion: 0 }),
      ctx("ghost"),
    ) as never as { status: number };
    expect(res.status).toBe(404);
  });
});
