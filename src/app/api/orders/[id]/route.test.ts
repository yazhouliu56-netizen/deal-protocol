import { describe, it, expect, vi, beforeEach } from "vitest"

vi.mock("next/server", () => ({
  NextResponse: {
    json: (body: unknown, init?: { status?: number }) => ({
      status: init?.status ?? 200,
      json: async () => body,
    }),
    redirect: () => ({}),
  },
}))

vi.mock("next/cache", () => ({
  revalidatePath: () => {},
}))

const mockSupabase = { from: vi.fn() }

vi.mock("@/lib/auth", () => ({
  auth: async () => ({ user: { id: "u1" }, supabase: mockSupabase }),
}))

vi.mock("@/lib/supabase-client", () => ({
  getServiceClient: () => mockSupabase,
}))

// D-5 Phase C：门面退役后 mock 重定向——事件/满意度/退款直连真身模块；
// 状态机校验走真实 Base 纯函数（不 mock），由下方 engine stub 的 getDefinition
// 提供协议定义数据。
vi.mock("@/lib/contract/events", () => ({
  addContractEvent: vi.fn(),
}))

vi.mock("@/lib/contract/satisfaction", () => ({
  handleSatisfactionBatch: vi.fn(),
  releaseSatisfactionBatch: vi.fn(),
}))

vi.mock("@/lib/contract/refund", () => ({
  createRefundTransactions: createRefundTransactionsMock,
}))

const createRefundTransactionsMock = vi.fn()

// D-5 Phase E：协议资产已归位 Base——考卷 mock 重定向至新资产路径，
// 提供确定性跃迁定义（真实 Base 校验逻辑不 mock，照常全量执行）。
vi.mock("@/base/order/protocol-definitions", () => ({
  getProtocol: () => ({
    transitions: [
      { action: "resolve_dispute", from: "HELD", to: "HELD", allowedRoles: ["CUSTOMER", "PROVIDER", "ADMIN"] },
      { action: "settle_after_dispute", from: "HELD", to: "SETTLED", allowedRoles: ["CUSTOMER", "PROVIDER", "ADMIN"] },
      { action: "confirm_complete", from: "HELD", to: "COMPLETED", allowedRoles: ["CUSTOMER", "PROVIDER"] },
      { action: "auto_complete", from: "HELD", to: "COMPLETED", allowedRoles: ["SYSTEM"] },
    ],
    funding: { autoReleaseTimeout: 72 * 3600 },
    dispute: { channels: { green: { maxAmount: 100 }, yellow: { maxAmount: 500 } } },
    serviceStages: [],
  }),
}))

vi.mock("@/lib/payment", () => ({
  createPayment: vi.fn(),
  getAvailablePaymentChannels: () => [],
}))

vi.mock("@/lib/event-bus", () => ({
  emitEvent: vi.fn(),
}))

vi.mock("@/modules/m11-evidence-log/evidence-chain", () => ({
  appendEvidence: vi.fn(),
}))

vi.mock("@/lib/privacy-guard", () => ({
  maskPhone: (p: string) => p,
}))

const { PATCH } = await import("./route")

const contract = {
  id: "c1",
  demand_id: "d1",
  customer_id: "cu1",
  provider_id: "pv1",
  protocol_id: "housekeeping",
  fund_status: "HELD",
  service_stage: 5,
  amount: 200,
  dispute_status: "OPEN",
  auto_complete_at: null,
  completed_at: null,
  created_at: new Date().toISOString(),
}

let disputesUpdateBodies: Record<string, unknown>[] = []
let contractUpdateResult: { data: { id: string } | null; error: unknown } = {
  data: { id: "c1" },
  error: null,
}

function setupMock(disputeVerdict: string | null = null) {
  disputesUpdateBodies = []

  const insertFn = vi.fn().mockResolvedValue({ error: null })

  const updateEq2 = vi.fn().mockReturnValue({
    select: vi.fn().mockReturnValue({
      maybeSingle: vi.fn().mockResolvedValue(contractUpdateResult),
    }),
  })
  const updateEq1 = vi.fn().mockReturnValue({ eq: updateEq2 })
  const updateFn = vi.fn().mockReturnValue({ eq: updateEq1 })

  const profileSingle = vi.fn().mockResolvedValue({
    data: { id: "u1", role: "CUSTOMER", roles: null },
    error: null,
  })
  const profileEq = vi.fn().mockReturnValue({ single: profileSingle })
  const profileSelect = vi.fn().mockReturnValue({ eq: profileEq })

  mockSupabase.from.mockImplementation((table: string) => {
    if (table === "contracts") {
      const updatedSingle = vi.fn().mockResolvedValue({
        data: { ...contract, dispute_status: "RESOLVED" },
        error: null,
      })
      const updatedEq = vi.fn().mockReturnValue({ single: updatedSingle })
      return {
        select: vi.fn().mockReturnValue({ eq: updatedEq }),
        update: updateFn,
      }
    }
    if (table === "profiles") return { select: profileSelect }
    if (table === "disputes") {
      return {
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            eq: vi.fn().mockImplementation((_col: string, value: string) => {
              if (value === "RESOLVED") {
                return {
                  order: vi.fn().mockReturnValue({
                    limit: vi.fn().mockResolvedValue({
                      data: disputeVerdict ? [{ llm_verdict: disputeVerdict }] : [],
                      error: null,
                    }),
                  }),
                }
              }
              return {
                single: vi.fn().mockResolvedValue({
                  data: disputeVerdict ? { llm_verdict: disputeVerdict } : null,
                  error: null,
                }),
              }
            }),
          }),
        }),
        insert: vi.fn().mockResolvedValue({ error: null }),
        update: vi.fn().mockImplementation((body: Record<string, unknown>) => {
          disputesUpdateBodies.push(body)
          return {
            eq: vi.fn().mockReturnValue({
              eq: vi.fn().mockResolvedValue({ error: null }),
            }),
          }
        }),
      }
    }
    return { insert: insertFn, select: vi.fn(), update: vi.fn() }
  })
}

function post(body: Record<string, unknown>) {
  return PATCH(new Request("http://local", { method: "PATCH", body: JSON.stringify(body) }), {
    params: Promise.resolve({ id: "c1" }),
  })
}

beforeEach(() => {
  mockSupabase.from.mockClear()
  contractUpdateResult = { data: { id: "c1" }, error: null }
  createRefundTransactionsMock.mockClear()
})

describe("orders/[id] 争议分账收编（P0-2）", () => {
  it("resolve_dispute 未传金额时按 escrow 原语默认五五开（200 → 100/100）", async () => {
    setupMock()

    const res = await post({ action: "resolve_dispute", reason: "仲裁结案" })
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body.contract?.dispute_status).toBe("RESOLVED")

    expect(disputesUpdateBodies.length).toBe(1)
    expect(disputesUpdateBodies[0]?.status).toBe("RESOLVED")
    const verdict = JSON.parse(disputesUpdateBodies[0]?.llm_verdict as string) as {
      providerAmount: number
      customerAmount: number
    }
    expect(verdict.providerAmount).toBe(100)
    expect(verdict.customerAmount).toBe(100)
  })

  it("resolve_dispute 带裁决金额时以显式传入为准（60/140）", async () => {
    setupMock()

    const res = await post({
      action: "resolve_dispute",
      reason: "仲裁结案",
      providerAmount: 60,
      customerAmount: 140,
    })

    expect(res.status).toBe(200)
    expect(disputesUpdateBodies.length).toBe(1)
    const verdict = JSON.parse(disputesUpdateBodies[0]?.llm_verdict as string) as {
      providerAmount: number
      customerAmount: number
    }
    expect(verdict.providerAmount).toBe(60)
    expect(verdict.customerAmount).toBe(140)
  })

  it("settle_after_dispute 有裁决 verdict 时按裁决分账（60/140），无裁决经 escrow 原语默认分账", async () => {
    setupMock(JSON.stringify({ providerAmount: 60, customerAmount: 140 }))

    const res = await post({ action: "settle_after_dispute" })

    expect(res.status).toBe(200)
    const refundCalls = createRefundTransactionsMock.mock.calls
    expect(refundCalls.length).toBe(1)
    const refund = refundCalls[0]?.[3] as { provider: number; customer: number }
    expect(refund.provider).toBe(60)
    expect(refund.customer).toBe(140)
  })

  it("settle_after_dispute 无裁决时经 escrow 原语默认分账（200 → 100/100）", async () => {
    setupMock()

    const res = await post({ action: "settle_after_dispute" })

    expect(res.status).toBe(200)
    const refundCalls = createRefundTransactionsMock.mock.calls
    expect(refundCalls.length).toBe(1)
    const refund = refundCalls[0]?.[3] as { provider: number; customer: number }
    expect(refund.provider).toBe(100)
    expect(refund.customer).toBe(100)
  })

  it("fund_status CAS 冲突（并发/重复请求）返回确定性 409", async () => {
    contractUpdateResult = { data: null, error: null }
    setupMock()

    const res = await post({ action: "confirm_complete" })
    const body = await res.json()

    expect(res.status).toBe(409)
    expect(body.code).toBe("OPTIMISTIC_LOCK_CONFLICT")
  })
})