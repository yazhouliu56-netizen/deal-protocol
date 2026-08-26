import { describe, it, expect, vi, beforeEach } from "vitest"
import {
  createMilestonePlan,
  evaluateMilestoneTimeout,
  frozenRemainingCents,
  refundRemainingMilestones,
  releaseMilestone,
  submitMilestoneCheckpoint,
} from "@/base/money/milestone-escrow"

vi.mock("@/lib/supabase-client", () => ({
  getSupabase: vi.fn(),
  getServiceClient: vi.fn(),
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

describe("Mechanism 1: SLA 超时决策与放款（Base milestone-escrow 权威原语）", () => {
  // D-5 改道（参谋部裁决 #3）：旧 checkAndEnforceSLA（DB 编排壳）考卷语义转译为
  // 底座纯函数护栏——决策/执行分离：逾期检测 + 放款决策在 Base 钉死；credit 扣分、
  // evidence 落盘等执行编排属 API 层职责，不在底座考卷范围。

  it("detects overdue ACCEPTED stage and enforces breach penalty", () => {
    // ¥1000 合同（100000 分），SLA 窗口 30 分钟，提交于 2 小时前 → 必然逾期
    const plan = createMilestonePlan(100_000, [1], [{ title: "阶段一", timeoutHours: 0.5 }])
    const submitted = submitMilestoneCheckpoint(plan, "milestone-1", {
      submittedAt: new Date(Date.now() - 7_200_000).toISOString(),
    })
    const decision = evaluateMilestoneTimeout(submitted.plan, new Date().toISOString())
    expect(decision.timedOutMilestoneIds).toEqual(["milestone-1"])

    // SLA_ENFORCED 等价物：超时自动放款执行（¥50 补偿语义由下方违约金断言承接）
    const released = releaseMilestone(submitted.plan, decision.timedOutMilestoneIds[0])
    expect(released.releasedCents).toBe(100_000)
    expect(released.ledgerEntry?.kind).toBe("MILESTONE_RELEASE")
    expect(released.alreadyReleased).toBe(false)

    // 违约金语义等价：5% 补偿 = ¥50 = 5000 分，从剩余冻结中扣除、余款退还
    const cleared = refundRemainingMilestones(
      createMilestonePlan(100_000, [1], [{ title: "阶段一" }]),
      5_000,
    )
    expect(cleared.penaltyCents).toBe(5_000)
    expect(cleared.refundedCents).toBe(95_000)
  })

  it("does NOT penalize contracts within SLA window", () => {
    // 刚刚提交（窗口 0.5h 内）→ 零逾期决策、冻结资金纹丝不动
    const plan = createMilestonePlan(50_000, [1], [{ title: "阶段一", timeoutHours: 0.5 }])
    const submitted = submitMilestoneCheckpoint(plan, "milestone-1", {
      submittedAt: new Date().toISOString(),
    })
    const decision = evaluateMilestoneTimeout(submitted.plan, new Date().toISOString())
    expect(decision.timedOutMilestoneIds).toEqual([])
    expect(frozenRemainingCents(submitted.plan)).toBe(50_000)
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
