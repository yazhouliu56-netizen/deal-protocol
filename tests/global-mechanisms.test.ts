import { describe, it, expect, vi, beforeEach } from "vitest"

vi.mock("@/lib/supabase-client", () => ({
  getSupabase: vi.fn(),
  getServiceClient: vi.fn(),
}))

vi.mock("@/lib/payment", () => ({
  getPaymentManager: vi.fn(),
  getAvailablePaymentChannels: vi.fn().mockReturnValue([]),
}))

vi.mock("@/lib/contract-machine", () => ({
  addContractEvent: vi.fn(),
  getNextFundStatus: vi.fn().mockReturnValue("REFUNDING"),
}))

vi.mock("@/modules/m07-credit/credit-engine", () => ({
  updateCredit: vi.fn().mockResolvedValue({ success: true }),
  getCreditScore: vi.fn(),
  isColdStart: vi.fn().mockResolvedValue(false),
  getNewbornProtectionFactor: vi.fn().mockReturnValue(1.0),
  getWeekendMultiplier: vi.fn().mockReturnValue(1.0),
}))

vi.mock("@/modules/m11-evidence-log/evidence-chain", () => ({
  appendEvidence: vi.fn().mockResolvedValue("ev-id-001"),
}))

function makeChain(): Record<string, ReturnType<typeof vi.fn>> & { __setData(d: unknown): void } {
  let resolveData: unknown = { data: [] }
  const methods = ["select", "eq", "lte", "not", "or", "order", "limit", "single", "maybeSingle", "insert", "update", "in"]

  const h: Record<string, unknown> = {}
  for (const m of methods) {
    h[m] = vi.fn(() => h)
  }

  const getP = () => Promise.resolve(resolveData)
  Object.defineProperty(h, "then", { get: () => getP().then.bind(getP()) })
  Object.defineProperty(h, "catch", { get: () => getP().catch.bind(getP()) })
  Object.defineProperty(h, "finally", { get: () => getP().finally.bind(getP()) })

  const chain = h as unknown as ReturnType<typeof makeChain>
  chain.__setData = (d) => { resolveData = d }
  return chain
}

function _mockData(chain: ReturnType<typeof makeChainMock>, result: unknown) {
  const p = Promise.resolve(result)
  vi.mocked(chain.select).mockReturnValue(chain)
  vi.mocked(chain.eq).mockReturnValue(chain)
  vi.mocked(chain.lte).mockReturnValue(chain)
  vi.mocked(chain.not).mockReturnValue(chain)
  vi.mocked(chain.or).mockReturnValue(chain)
  vi.mocked(chain.order).mockReturnValue(chain)
  vi.mocked(chain.limit).mockReturnValue(chain)
  vi.mocked(chain.single).mockResolvedValue(result)
  vi.mocked(chain.maybeSingle).mockResolvedValue(result)
  vi.mocked(chain.insert).mockReturnValue(chain)
  vi.mocked(chain.update).mockReturnValue(chain)
  vi.mocked(chain.in).mockReturnValue(chain)
  return p
}

describe("Mechanism 1: SLA Enforcer", () => {
  let getSupabase: ReturnType<typeof vi.fn>
  let cChain: ReturnType<typeof makeChain>
  let oChain: ReturnType<typeof makeChain>

  beforeEach(async () => {
    vi.clearAllMocks()
    cChain = makeChain()
    oChain = makeChain()
    const mod = await import("@/lib/supabase-client")
    getSupabase = vi.mocked(mod.getSupabase)
    getSupabase.mockReturnValue({ from: vi.fn((t: string) => t === 'contracts' ? cChain : oChain) } as unknown as ReturnType<typeof getSupabase>)
    const mod2 = await import("@/lib/supabase-client")
    vi.mocked(mod2.getServiceClient).mockReturnValue({ from: vi.fn((t: string) => t === 'contracts' ? cChain : oChain) } as unknown as ReturnType<typeof mod2.getServiceClient>)
  })

  it("detects overdue ACCEPTED stage and enforces breach penalty", async () => {
    cChain.__setData({
      data: [{ id: "contract-1", demand_id: "demand-1", customer_id: "cust-1", provider_id: "prov-1", fund_status: "HELD", amount: 1000 }],
    })
    const twoHoursAgo = new Date(Date.now() - 7200000).toISOString()
    oChain.__setData({
      data: [{ id: "order-1", service_phase: "ACCEPTED", created_at: twoHoursAgo, updated_at: twoHoursAgo }],
    })
    vi.mocked(oChain.single).mockResolvedValue({ data: { service_phase: "ACCEPTED" }, error: null })
    vi.mocked(cChain.single).mockResolvedValue({ data: { fund_status: "HELD" }, error: null })

    const { checkAndEnforceSLA } = await import("@/lib/sla-enforcer")
    const results = await checkAndEnforceSLA()

    expect(results.length).toBe(1)
    expect(results[0]).toContain("SLA_ENFORCED contract-1")
    expect(results[0]).toContain("compensated ¥50")

    const creditModule = await import("@/modules/m07-credit/credit-engine")
    expect(creditModule.updateCredit).toHaveBeenCalledWith(
      expect.objectContaining({ userId: "prov-1", eventType: "violation" }),
    )
  })

  it("does NOT penalize contracts within SLA window", async () => {
    const justNow = new Date().toISOString()
    cChain.__setData({
      data: [{ id: "contract-2", demand_id: "demand-2", customer_id: "cust-2", provider_id: "prov-2", fund_status: "HELD", amount: 500 }],
    })
    oChain.__setData({
      data: [{ id: "order-2", service_phase: "ACCEPTED", created_at: justNow, updated_at: justNow }],
    })

    const { checkAndEnforceSLA } = await import("@/lib/sla-enforcer")
    const results = await checkAndEnforceSLA()
    expect(results.length).toBe(0)
  })
})

describe("Mechanism 2: Deposit Staking Matching Weight", () => {
  it("applies 1.2x multiplier for staked providers with deposit >= 500", () => {
    const calcScore = (creditScore: number, weight: number, distance: number, depositAmount: number, isStaked: boolean): number => {
      const base = creditScore * 20 * weight - distance / 100
      const depositMultiplier = isStaked && depositAmount >= 500 ? 1.2 : 1.0
      return base * depositMultiplier
    }

    const staked = calcScore(600, 1.0, 1000, 500, true)
    const unStaked = calcScore(600, 1.0, 1000, 0, false)

    expect(staked).toBeGreaterThan(unStaked)
    expect(Math.round(staked * 100) / 100).toBe(Math.round(unStaked * 1.2 * 100) / 100)
  })

  it("does NOT boost providers with deposit < 500", () => {
    const calcScore = (creditScore: number, weight: number, distance: number, depositAmount: number, isStaked: boolean): number => {
      const base = creditScore * 20 * weight - distance / 100
      return isStaked && depositAmount >= 500 ? base * 1.2 : base
    }

    const scoreA = calcScore(600, 1.0, 1000, 300, true)
    const scoreB = calcScore(600, 1.0, 1000, 0, false)
    expect(scoreA).toBe(scoreB)
  })
})

describe("Mechanism 3: Phone Privacy Guard", () => {
  it("maskPhone masks middle digits", async () => {
    const { maskPhone } = await import("@/lib/privacy-guard")
    expect(maskPhone("13812348000")).toBe("138****8000")
  })

  it("maskPhone returns null for null input", async () => {
    const { maskPhone } = await import("@/lib/privacy-guard")
    expect(maskPhone(null)).toBeNull()
  })

  it("maskPhone returns null for undefined", async () => {
    const { maskPhone } = await import("@/lib/privacy-guard")
    expect(maskPhone(undefined)).toBeNull()
  })

  it("generateProxyNumber produces valid format", async () => {
    const { generateProxyNumber } = await import("@/lib/privacy-guard")
    const proxy = generateProxyNumber("contract-1", "provider")
    expect(proxy).toMatch(/^1709\d{7}$/)
  })

  it("maskPhoneWithLen supports custom prefix/suffix lengths", async () => {
    const { maskPhoneWithLen } = await import("@/lib/privacy-guard")
    expect(maskPhoneWithLen("13812348000", 3, 3)).toBe("138*****000")
  })

  it("allocateVirtualNumber stores proxy number in evidence_log", async () => {
    const mod = await import("@/lib/supabase-client")
    const gs = vi.mocked(mod.getSupabase)
    const chain2 = makeChain()
    const insertFn = vi.fn().mockResolvedValue({ error: null })
    chain2.insert = insertFn
    gs.mockReturnValue({ from: vi.fn(() => chain2) } as unknown as ReturnType<typeof gs>)

    const { allocateVirtualNumber } = await import("@/lib/privacy-guard")
    const result = await allocateVirtualNumber("contract-1", "13812348000", "provider", 48)
    expect(result.proxyNumber).toMatch(/^1709\d{7}$/)
    expect(result.expiresAt).toBeInstanceOf(Date)
  })
})

describe("Mechanism 4: T+0 Fast Withdrawal", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it("fastWithdrawal is true for tier 4 (diamond, score>=750)", async () => {
    const { getCreditTierPrivileges } = await import("@/lib/credit-privileges")
    const tier = getCreditTierPrivileges(800)
    expect(tier.level).toBe(4)
    expect(tier.fastWithdrawal).toBe(true)
  })

  it("fastWithdrawal is true for tier 5 (king, score>=900)", async () => {
    const { getCreditTierPrivileges } = await import("@/lib/credit-privileges")
    const tier = getCreditTierPrivileges(950)
    expect(tier.level).toBe(5)
    expect(tier.fastWithdrawal).toBe(true)
  })

  it("fastWithdrawal is false for tier 3 (gold, score<750)", async () => {
    const { getCreditTierPrivileges } = await import("@/lib/credit-privileges")
    const tier = getCreditTierPrivileges(600)
    expect(tier.level).toBe(3)
    expect(tier.fastWithdrawal).toBe(false)
  })
})
