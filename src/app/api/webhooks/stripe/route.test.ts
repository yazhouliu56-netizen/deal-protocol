import { describe, it, expect, vi, beforeEach } from "vitest"
const mockConstructEvent = vi.fn()
const mockRetrievePaymentIntent = vi.fn()

vi.mock("next/server", () => ({
  NextResponse: {
    json: (body: unknown, init?: { status?: number }) => ({
      status: init?.status ?? 200,
      json: async () => body,
    }),
  },
}))

vi.mock("stripe", () => ({
  default: vi.fn(() => ({
    webhooks: { constructEvent: mockConstructEvent },
    paymentIntents: { retrieve: mockRetrievePaymentIntent },
  })),
}))

const mockSupabase = { from: vi.fn() }

vi.mock("@/lib/supabase-client", () => ({
  getServiceClient: () => mockSupabase,
}))

vi.mock("@/lib/contract-machine", () => ({
  addContractEvent: vi.fn(),
}))

vi.mock("@/lib/event-bus", () => ({
  emitEvent: vi.fn(),
}))

const { POST } = await import("./route")

let existingPayment: { provider_payment_id: string } | null = null

function setupMockContract(contract: Record<string, unknown> | null) {
  const singleFn = vi.fn().mockResolvedValue({ data: contract, error: contract ? null : new Error("not found") })
  const eqFn = vi.fn().mockReturnValue({ single: singleFn })
  const selectFn = vi.fn().mockReturnValue({ eq: eqFn })
  const insertFn = vi.fn().mockResolvedValue({ error: null })
  const updateFn = vi.fn().mockReturnValue({ eq: vi.fn().mockResolvedValue({ error: null }) })

  const maybeSingleFn = vi.fn().mockResolvedValue({ data: existingPayment, error: null })
  const eqPaymentsFn = vi.fn().mockReturnValue({ maybeSingle: maybeSingleFn })
  const selectPaymentsFn = vi.fn().mockReturnValue({ eq: eqPaymentsFn })

  mockSupabase.from.mockImplementation((table: string) => {
    if (table === "contracts") return { select: selectFn, update: updateFn }
    if (table === "payments") return { select: selectPaymentsFn, insert: insertFn }
    if (table === "notifications" || table === "contract_events") return { insert: insertFn }
    return { select: vi.fn(), update: vi.fn(), insert: insertFn }
  })

  return { updateFn, insertFn }
}

beforeEach(() => {
  vi.clearAllMocks()
  process.env.STRIPE_SECRET_KEY = "test_sk_value"
  process.env.STRIPE_WEBHOOK_SECRET = "test_whsec_value"
})

describe("POST /api/webhooks/stripe", () => {
  describe("signature verification", () => {
    it("returns 400 when stripe-signature header is missing", async () => {
      const req = new Request("https://example.com/api/webhooks/stripe", {
        method: "POST",
        body: JSON.stringify({}),
      })
      const resp = await POST(req)
      const body = await resp.json()
      expect(resp.status).toBe(400)
      expect(body.error).toContain("Missing stripe-signature")
    })

    it("returns 400 when signature verification fails", async () => {
      mockConstructEvent.mockImplementation(() => { throw new Error("bad signature") })
      const req = new Request("https://example.com/api/webhooks/stripe", {
        method: "POST",
        headers: { "stripe-signature": "invalid" },
        body: JSON.stringify({}),
      })
      const resp = await POST(req)
      const body = await resp.json()
      expect(resp.status).toBe(400)
      expect(body.error).toContain("Signature verification failed")
    })
  })

  describe("payment_intent.succeeded", () => {
    it("updates contract fund_status to HELD", async () => {
      mockConstructEvent.mockReturnValue({
        type: "payment_intent.succeeded",
        data: { object: { id: "pi_test_123", amount: 50000, metadata: { contractId: "c1" } } },
      })
      const { updateFn } = setupMockContract({ id: "c1", fund_status: "PENDING", customer_id: "u1", provider_id: "u2" })
      const req = new Request("https://example.com/api/webhooks/stripe", {
        method: "POST",
        headers: { "stripe-signature": "valid" },
        body: JSON.stringify({}),
      })
      const resp = await POST(req)
      expect(resp.status).toBe(200)
      const heldUpdates = updateFn.mock.calls.filter(
(c: unknown[]) => (c[0] as Record<string, string>)?.fund_status === "HELD")
      expect(heldUpdates.length).toBe(1)
    })

    it("skips when contract already HELD (idempotency)", async () => {
      mockConstructEvent.mockReturnValue({
        type: "payment_intent.succeeded",
        data: { object: { id: "pi_test_456", amount: 30000, metadata: { contractId: "c2" } } },
      })
      const { updateFn } = setupMockContract({ id: "c2", fund_status: "HELD", customer_id: "u1", provider_id: "u2" })
      const req = new Request("https://example.com/api/webhooks/stripe", {
        method: "POST",
        headers: { "stripe-signature": "valid" },
        body: JSON.stringify({}),
      })
      const resp = await POST(req)
      expect(resp.status).toBe(200)
      const heldUpdates = updateFn.mock.calls.filter(
(c: unknown[]) => (c[0] as Record<string, string>)?.fund_status === "HELD")
      expect(heldUpdates.length).toBe(0)
    })

    it("skips when contractId missing from metadata", async () => {
      mockConstructEvent.mockReturnValue({
        type: "payment_intent.succeeded",
        data: { object: { id: "pi_test_noid", amount: 10000, metadata: {} } },
      })
      const { updateFn } = setupMockContract(null)
      const req = new Request("https://example.com/api/webhooks/stripe", {
        method: "POST",
        headers: { "stripe-signature": "valid" },
        body: JSON.stringify({}),
      })
      const resp = await POST(req)
      expect(resp.status).toBe(200)
      const heldUpdates = updateFn.mock.calls.filter(
(c: unknown[]) => (c[0] as Record<string, string>)?.fund_status === "HELD")
      expect(heldUpdates.length).toBe(0)
    })
  })

  describe("checkout.session.completed", () => {
    it("silently acknowledges checkout.session.completed (falls through to payment_intent.succeeded)", async () => {
      mockConstructEvent.mockReturnValue({
        type: "checkout.session.completed",
        data: { object: { id: "cs_test_789", payment_intent: "pi_checkout_1", metadata: { contractId: "c3" } } },
      })
      const { updateFn } = setupMockContract({ id: "c3", fund_status: "PENDING", customer_id: "u1", provider_id: "u2" })
      const req = new Request("https://example.com/api/webhooks/stripe", {
        method: "POST",
        headers: { "stripe-signature": "valid" },
        body: JSON.stringify({}),
      })
      const resp = await POST(req)
      expect(resp.status).toBe(200)
      expect(mockRetrievePaymentIntent).not.toHaveBeenCalled()
      const heldUpdates = updateFn.mock.calls.filter(
(c: unknown[]) => (c[0] as Record<string, string>)?.fund_status === "HELD")
      expect(heldUpdates.length).toBe(0)
    })
  })

  describe("payment_intent.payment_failed", () => {
    it("handles payment failure gracefully", async () => {
      mockConstructEvent.mockReturnValue({
        type: "payment_intent.payment_failed",
        data: { object: { id: "pi_fail_1", amount: 50000, metadata: { contractId: "c4" } } },
      })
      setupMockContract(null)
      const req = new Request("https://example.com/api/webhooks/stripe", {
        method: "POST",
        headers: { "stripe-signature": "valid" },
        body: JSON.stringify({}),
      })
      const resp = await POST(req)
      expect(resp.status).toBe(200)
    })
  })

  describe("idempotency - duplicate event", () => {
    it("processes duplicate event without duplicate fund_status update", async () => {
      mockConstructEvent.mockReturnValue({
        type: "payment_intent.succeeded",
        data: { object: { id: "pi_dup_1", amount: 50000, metadata: { contractId: "c5" } } },
      })
      const { updateFn } = setupMockContract({ id: "c5", fund_status: "PENDING", customer_id: "u1", provider_id: "u2" })
      function makeReq() {
        return new Request("https://example.com/api/webhooks/stripe", {
          method: "POST",
          headers: { "stripe-signature": "valid" },
          body: JSON.stringify({}),
        })
      }

      await POST(makeReq())
      setupMockContract({ id: "c5", fund_status: "HELD", customer_id: "u1", provider_id: "u2" })
      await POST(makeReq())

      const heldUpdates = updateFn.mock.calls.filter(
(c: unknown[]) => (c[0] as Record<string, string>)?.fund_status === "HELD")
      expect(heldUpdates.length).toBe(1)
    })
  })
})
