import { describe, it, expect, vi, beforeEach } from "vitest"

const mockConstructEvent = vi.fn()

vi.mock("stripe", () => ({
  default: vi.fn(() => ({
    webhooks: { constructEvent: mockConstructEvent },
  })),
}))

vi.mock("@/lib/supabase-client", () => ({
  getServiceClient: () => mockSupabase,
}))

vi.mock("@/lib/contract-machine", () => ({
  addContractEvent: vi.fn(),
}))

vi.mock("@/lib/event-bus", () => ({
  emitEvent: vi.fn(),
}))

const mockSupabase = { from: vi.fn() }

const { POST } = await import("../src/app/api/webhooks/stripe/route")

function makeReq(signature?: string): Request {
  const headers: Record<string, string> = {}
  if (signature) headers["stripe-signature"] = signature
  return new Request("https://example.com/api/webhooks/stripe", {
    method: "POST",
    headers,
    body: JSON.stringify({}),
  })
}

function setupMock(existingPayment: { id: string; status: string } | null) {
  const maybeSingleFn = vi.fn().mockResolvedValue({ data: existingPayment, error: null })
  const eqPaymentsFn = vi.fn().mockReturnValue({ maybeSingle: maybeSingleFn })
  const selectPaymentsFn = vi.fn().mockReturnValue({ eq: eqPaymentsFn })
  const insertFn = vi.fn().mockResolvedValue({ error: null })
  mockSupabase.from.mockImplementation((table: string) => {
    if (table === "payments") return { select: selectPaymentsFn, insert: insertFn }
    return { select: vi.fn(), update: vi.fn(), insert: insertFn }
  })
}

beforeEach(() => {
  vi.clearAllMocks()
  process.env.STRIPE_SECRET_KEY = "sk_test_xxx"
  process.env.STRIPE_WEBHOOK_SECRET = "whsec_test"
})

describe("POST /api/webhooks/stripe (integration-level)", () => {
  it("returns 400 when stripe-signature header is missing", async () => {
    const resp = await POST(makeReq())
    const body = await resp.json()
    expect(resp.status).toBe(400)
    expect(body.error).toContain("Missing stripe-signature")
  })

  it("returns 400 when signature verification fails", async () => {
    mockConstructEvent.mockImplementation(() => { throw new Error("bad sig") })
    const resp = await POST(makeReq("invalid"))
    const body = await resp.json()
    expect(resp.status).toBe(400)
    expect(body.error).toContain("Signature verification failed")
  })

  it("returns duplicate:true when payment already processed (idempotency)", async () => {
    mockConstructEvent.mockReturnValue({
      type: "payment_intent.succeeded",
      data: { object: { id: "pi_dup_test", amount: 50000, metadata: { contractId: "c-dup" } } },
    })
    setupMock({ id: "pay-existing", status: "SUCCEEDED" })
    const resp = await POST(makeReq("valid"))
    const body = await resp.json()
    expect(resp.status).toBe(200)
    expect(body.duplicate).toBe(true)
  })
})