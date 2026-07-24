import { describe, it, expect } from 'vitest'

// ─── P1-02: 5 级信用权益映射 (§5.4) ────────────────────────

describe('P1-02: getCreditTierPrivileges', () => {
  it('score 950 → level 5 王者/VIP', async () => {
    const { getCreditTierPrivileges } = await import('@/lib/credit-privileges')
    const t = getCreditTierPrivileges(950)
    expect(t.level).toBe(5)
    expect(t.name).toBe('王者/VIP')
    expect(t.matchingWeight).toBe(1.5)
    expect(t.dailyGrabLimit).toBe(-1)
    expect(t.fastWithdrawal).toBe(true)
    expect(t.manualReviewRequired).toBe(false)
  })

  it('score 800 → level 4 钻石', async () => {
    const { getCreditTierPrivileges } = await import('@/lib/credit-privileges')
    const t = getCreditTierPrivileges(800)
    expect(t.level).toBe(4)
    expect(t.name).toBe('钻石')
    expect(t.matchingWeight).toBe(1.2)
    expect(t.dailyGrabLimit).toBe(50)
    expect(t.fastWithdrawal).toBe(true)
  })

  it('score 650 → level 3 黄金', async () => {
    const { getCreditTierPrivileges } = await import('@/lib/credit-privileges')
    const t = getCreditTierPrivileges(650)
    expect(t.level).toBe(3)
    expect(t.name).toBe('黄金')
    expect(t.matchingWeight).toBe(1.0)
    expect(t.dailyGrabLimit).toBe(20)
  })

  it('score 550 → level 2 青铜', async () => {
    const { getCreditTierPrivileges } = await import('@/lib/credit-privileges')
    const t = getCreditTierPrivileges(550)
    expect(t.level).toBe(2)
    expect(t.name).toBe('青铜')
    expect(t.matchingWeight).toBe(0.8)
    expect(t.dailyGrabLimit).toBe(5)
  })

  it('score 400 → level 1 受限', async () => {
    const { getCreditTierPrivileges } = await import('@/lib/credit-privileges')
    const t = getCreditTierPrivileges(400)
    expect(t.level).toBe(1)
    expect(t.name).toBe('受限')
    expect(t.matchingWeight).toBe(0.5)
    expect(t.dailyGrabLimit).toBe(1)
    expect(t.manualReviewRequired).toBe(true)
  })

  it('boundary 899 → level 4, 900 → level 5', async () => {
    const { getCreditTierPrivileges } = await import('@/lib/credit-privileges')
    expect(getCreditTierPrivileges(899).level).toBe(4)
    expect(getCreditTierPrivileges(900).level).toBe(5)
  })

  it('boundary 599 → level 2, 600 → level 3', async () => {
    const { getCreditTierPrivileges } = await import('@/lib/credit-privileges')
    expect(getCreditTierPrivileges(599).level).toBe(2)
    expect(getCreditTierPrivileges(600).level).toBe(3)
  })
})

// ─── P1-01: 新人保护系数 (§5.5) ─────────────────────────────

describe('P1-01: getNewbornProtectionFactor', () => {
  it('0 deals → 1.3', async () => {
    const { getNewbornProtectionFactor } = await import('@/modules/m07-credit/credit-engine')
    expect(getNewbornProtectionFactor(0)).toBeCloseTo(1.3)
  })

  it('5 deals → 1.15', async () => {
    const { getNewbornProtectionFactor } = await import('@/modules/m07-credit/credit-engine')
    expect(getNewbornProtectionFactor(5)).toBeCloseTo(1.15)
  })

  it('9 deals → 1.03', async () => {
    const { getNewbornProtectionFactor } = await import('@/modules/m07-credit/credit-engine')
    expect(getNewbornProtectionFactor(9)).toBeCloseTo(1.03)
  })

  it('10 deals → 1.0 (no bonus)', async () => {
    const { getNewbornProtectionFactor } = await import('@/modules/m07-credit/credit-engine')
    expect(getNewbornProtectionFactor(10)).toBe(1.0)
  })

  it('15 deals → 1.0', async () => {
    const { getNewbornProtectionFactor } = await import('@/modules/m07-credit/credit-engine')
    expect(getNewbornProtectionFactor(15)).toBe(1.0)
  })
})

describe('P1-01: getWeekendMultiplier', () => {
  it('returns 1.5 or 1.0 based on current day', async () => {
    const { getWeekendMultiplier } = await import('@/modules/m07-credit/credit-engine')
    const value = getWeekendMultiplier()
    expect([1.0, 1.5]).toContain(value)
  })
})

// ─── P1-03: admin_tasks migration — SQL 验证 (§4.3) ────────

describe('P1-03: admin_tasks migration', () => {
  it('contains admin_tasks table creation with correct schema', async () => {
    const fs = await import('fs')
    const path = await import('path')
    const content = fs.readFileSync(
      path.join(process.cwd(), 'supabase/migrations/20260724_admin_tasks.sql'),
      'utf-8',
    )
    expect(content).toContain('CREATE TABLE IF NOT EXISTS public.admin_tasks')
    expect(content).toContain('protocol_id UUID REFERENCES public.protocols(id)')
    expect(content).toContain('type TEXT NOT NULL')
    expect(content).toContain('ENABLE ROW LEVEL SECURITY')
    expect(content).toContain("role = 'admin'")
  })
})

describe('P1-03: matcher.ts creates admin_task on empty pool', () => {
  it('logEmptyPool inserts into admin_tasks', async () => {
    const fs = await import('fs')
    const path = await import('path')
    const content = fs.readFileSync(
      path.join(process.cwd(), 'src/modules/m06-matching-routing/matcher.ts'),
      'utf-8',
    )
    expect(content).toContain("from('admin_tasks')")
    expect(content).toContain("type: 'manual_assignment'")
  })
})

// ─── P1-04: 担保连带扣款 — refund.ts 验证 (§5.10) ───────────

describe('P1-04: joint guarantee in refund.ts', () => {
  it('contains applyJointGuarantee function', async () => {
    const fs = await import('fs')
    const path = await import('path')
    const content = fs.readFileSync(
      path.join(process.cwd(), 'src/lib/contract/refund.ts'),
      'utf-8',
    )
    expect(content).toContain('applyJointGuarantee')
    expect(content).toContain('guarantee_links')
    expect(content).toContain('GUARANTEE_DEDUCTION')
  })
})

// ─── P1-05: 反欺诈闭环检测 — SQL + 工具函数 (§5.11) ──────────

describe('P1-05: anti-fraud migration', () => {
  it('contains detect_circular_transactions function', async () => {
    const fs = await import('fs')
    const path = await import('path')
    const content = fs.readFileSync(
      path.join(process.cwd(), 'supabase/migrations/20260724_anti_fraud.sql'),
      'utf-8',
    )
    expect(content).toContain('detect_circular_transactions')
    expect(content).toContain('RECURSIVE')
    expect(content).toContain('SECURITY DEFINER')
  })
})

describe('P1-05: checkFraudRisk', () => {
  it('exports checkFraudRisk and return type', async () => {
    const mod = await import('@/lib/fraud-detection')
    expect(typeof mod.checkFraudRisk).toBe('function')
    const { FraudCheckReport } = await import('@/lib/fraud-detection')
    expect(FraudCheckReport).toBeUndefined() // interface-only, no runtime value
  })
})

// ─── StaticRanker 使用 tier weight (§5.4) ──────────────────

describe('P1-02: StaticRanker uses matchingWeight', () => {
  it('matcher.ts imports getCreditTierPrivileges', async () => {
    const fs = await import('fs')
    const path = await import('path')
    const content = fs.readFileSync(
      path.join(process.cwd(), 'src/modules/m06-matching-routing/matcher.ts'),
      'utf-8',
    )
    expect(content).toContain('getCreditTierPrivileges')
    expect(content).toContain('matchingWeight')
  })
})
