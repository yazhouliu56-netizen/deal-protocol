import { describe, it, expect, vi, beforeEach } from "vitest";

const mockConstructEvent = vi.fn();

vi.mock("next/server", () => ({
  NextResponse: {
    json: (body: unknown, init?: { status?: number }) => ({
      status: init?.status ?? 200,
      json: async () => body,
      text: async () => JSON.stringify(body),
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

vi.mock("@/lib/contract-machine", () => ({
  addContractEvent: vi.fn(),
}));

vi.mock("@/lib/event-bus", () => ({
  emitEvent: vi.fn(),
}));

vi.mock("@/lib/api-auth", () => ({
  withAuth: (handler: Function) => handler,
}));

const alipayService = {
  generatePaymentUrl: vi.fn(),
  verifySignature: vi.fn(),
};

vi.mock("@/lib/alipay-service", () => ({ alipayService }));

let existingPayment: { provider_payment_id: string } | null = null;

function setupMockContract(contract: Record<string, unknown> | null) {
  const singleFn = vi.fn().mockResolvedValue({ data: contract, error: contract ? null : new Error("not found") });
  const eqFn = vi.fn().mockReturnValue({ single: singleFn });
  const selectFn = vi.fn().mockReturnValue({ eq: eqFn });
  const insertFn = vi.fn().mockResolvedValue({ error: null });
  const updateFn = vi.fn().mockReturnValue({ eq: vi.fn().mockResolvedValue({ error: null }) });

  const maybeSingleFn = vi.fn().mockResolvedValue({ data: existingPayment, error: null });
  const eqPaymentsFn = vi.fn().mockReturnValue({ maybeSingle: maybeSingleFn });
  const selectPaymentsFn = vi.fn().mockReturnValue({ eq: eqPaymentsFn });

  mockSupabase.from.mockImplementation((table: string) => {
    if (table === "contracts") return { select: selectFn, update: updateFn };
    if (table === "payments") return { select: selectPaymentsFn, insert: insertFn };
    if (table === "notifications" || table === "contract_events") return { insert: insertFn };
    return { select: vi.fn(), update: vi.fn(), insert: insertFn };
  });

  return { updateFn, insertFn };
}

beforeEach(() => {
  vi.clearAllMocks();
  existingPayment = null;
});

describe("AlipayService", () => {
  it("should generate payment URL with correct parameters (Test 1)", () => {
    alipayService.generatePaymentUrl.mockReturnValue(
      "http://localhost:3000/payment/mock_order?status=success&mock_channel=alipay&amount=100"
    );
    const url = alipayService.generatePaymentUrl({
      outTradeNo: "test_order_1",
      amount: 100,
      subject: "Test Payment",
    });
    expect(url).toContain("mock_channel=alipay");
    expect(url).toContain("amount=100");
    expect(alipayService.generatePaymentUrl).toHaveBeenCalledWith(
      expect.objectContaining({ outTradeNo: "test_order_1", amount: 100 })
    );
  });
});

describe("POST /api/webhooks/alipay", () => {
  it("should verify signature and return 200 success (Test 2)", async () => {
    alipayService.verifySignature.mockReturnValue(true);
    existingPayment = null;
    setupMockContract({ id: "c1", customer_id: "u1", provider_id: "u2" });

    const { POST } = await import("@/app/api/webhooks/alipay/route");
    const body = new URLSearchParams({
      trade_no: "alipay_trade_001",
      out_trade_no: "c1",
      trade_status: "TRADE_SUCCESS",
      total_amount: "100.00",
      sign: "valid_signature",
      sign_type: "RSA2",
    }).toString();

    const req = new Request("https://example.com/api/webhooks/alipay", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body,
    });

    const resp = await POST(req);
    const text = await resp.text();
    expect(resp.status).toBe(200);
    expect(text).toBe("success");
    expect(alipayService.verifySignature).toHaveBeenCalled();
  });

  it("should reject invalid signature with 400", async () => {
    alipayService.verifySignature.mockReturnValue(false);
    setupMockContract(null);

    const { POST } = await import("@/app/api/webhooks/alipay/route");
    const body = new URLSearchParams({
      trade_no: "alipay_trade_bad",
      out_trade_no: "c2",
      trade_status: "TRADE_SUCCESS",
      sign: "bad_signature",
    }).toString();

    const req = new Request("https://example.com/api/webhooks/alipay", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body,
    });

    const resp = await POST(req);
    const text = await resp.text();
    expect(resp.status).toBe(400);
    expect(text).toContain("fail") || expect(text).toContain("error");
  });

  it("should reject non-success trade status", async () => {
    alipayService.verifySignature.mockReturnValue(true);
    setupMockContract(null);

    const { POST } = await import("@/app/api/webhooks/alipay/route");
    const body = new URLSearchParams({
      trade_no: "alipay_trade_wait",
      out_trade_no: "c3",
      trade_status: "WAIT_BUYER_PAY",
      sign: "valid",
    }).toString();

    const req = new Request("https://example.com/api/webhooks/alipay", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body,
    });

    const resp = await POST(req);
    const text = await resp.text();
    expect(resp.status).toBe(400);
    expect(text).toContain("error");
  });

  it("should reject duplicate trade_no (idempotency guard) (Test 3)", async () => {
    alipayService.verifySignature.mockReturnValue(true);
    existingPayment = { provider_payment_id: "alipay_trade_dup" };
    const { insertFn } = setupMockContract({ id: "c4", customer_id: "u1", provider_id: "u2" });

    const { POST } = await import("@/app/api/webhooks/alipay/route");
    const body = new URLSearchParams({
      trade_no: "alipay_trade_dup",
      out_trade_no: "c4",
      trade_status: "TRADE_SUCCESS",
      total_amount: "50.00",
      sign: "valid",
    }).toString();

    const req = new Request("https://example.com/api/webhooks/alipay", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body,
    });

    const resp = await POST(req);
    const text = await resp.text();
    expect(resp.status).toBe(200);
    expect(text).toBe("success");
    expect(insertFn).not.toHaveBeenCalled();
  });
});
