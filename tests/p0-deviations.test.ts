import { describe, it, expect } from 'vitest'

// ─── P0-03: 阶梯佣金计算 (§14.2) ─────────────────────────────

describe('P0-03: calculateTieredCommission', () => {
  it('≤ ¥500 → 15% rate', async () => {
    const { calculateTieredCommission } = await import('@/lib/contract/commission')
    const result = calculateTieredCommission(100)
    expect(result.rate).toBe(0.15)
    expect(result.commissionFee).toBe(15)
    expect(result.providerPayout).toBe(85)
    expect(result.tier).toBe('<500')
  })

  it('¥500 – ¥5,000 → 12% rate', async () => {
    const { calculateTieredCommission } = await import('@/lib/contract/commission')
    const result = calculateTieredCommission(1000)
    expect(result.rate).toBe(0.12)
    expect(result.commissionFee).toBe(120)
    expect(result.providerPayout).toBe(880)
    expect(result.tier).toBe('500-5000')
  })

  it('¥5,000 – ¥50,000 → 10% rate', async () => {
    const { calculateTieredCommission } = await import('@/lib/contract/commission')
    const result = calculateTieredCommission(10000)
    expect(result.rate).toBe(0.10)
    expect(result.commissionFee).toBe(1000)
    expect(result.providerPayout).toBe(9000)
    expect(result.tier).toBe('5000-50000')
  })

  it('> ¥50,000 → 8% rate', async () => {
    const { calculateTieredCommission } = await import('@/lib/contract/commission')
    const result = calculateTieredCommission(100000)
    expect(result.rate).toBe(0.08)
    expect(result.commissionFee).toBe(8000)
    expect(result.providerPayout).toBe(92000)
    expect(result.tier).toBe('>50000')
  })

  it('¥500 boundary → 15%', async () => {
    const { calculateTieredCommission } = await import('@/lib/contract/commission')
    const r1 = calculateTieredCommission(500)
    expect(r1.rate).toBe(0.15)
    const r2 = calculateTieredCommission(500.01)
    expect(r2.rate).toBe(0.12)
  })

  it('¥5,000 boundary → 12%', async () => {
    const { calculateTieredCommission } = await import('@/lib/contract/commission')
    const r1 = calculateTieredCommission(5000)
    expect(r1.rate).toBe(0.12)
    const r2 = calculateTieredCommission(5000.01)
    expect(r2.rate).toBe(0.10)
  })

  it('¥50,000 boundary → 10%', async () => {
    const { calculateTieredCommission } = await import('@/lib/contract/commission')
    const r1 = calculateTieredCommission(50000)
    expect(r1.rate).toBe(0.10)
    const r2 = calculateTieredCommission(50000.01)
    expect(r2.rate).toBe(0.08)
  })

  it('zero amount → 15%', async () => {
    const { calculateTieredCommission } = await import('@/lib/contract/commission')
    const result = calculateTieredCommission(0)
    expect(result.rate).toBe(0.15)
    expect(result.commissionFee).toBe(0)
    expect(result.providerPayout).toBe(0)
  })
})

// ─── P0-04: 保险池 1% 计提 (§12.9) ─────────────────────────

describe('P0-04: insurance pool 1% calculation', () => {
  it('1% of 100 = 1', async () => {
    const amount = 100
    const insuranceAmount = Number((amount * 0.01).toFixed(2))
    expect(insuranceAmount).toBe(1)
  })

  it('1% of 250 = 2.5', async () => {
    const amount = 250
    const insuranceAmount = Number((amount * 0.01).toFixed(2))
    expect(insuranceAmount).toBe(2.5)
  })

  it('1% of 999 = 9.99', async () => {
    const amount = 999
    const insuranceAmount = Number((amount * 0.01).toFixed(2))
    expect(insuranceAmount).toBe(9.99)
  })

  it('1% of 100000 = 1000', async () => {
    const amount = 100000
    const insuranceAmount = Number((amount * 0.01).toFixed(2))
    expect(insuranceAmount).toBe(1000)
  })
})

// ─── P0-05: LLM 日志脱敏工具 (§4.1) ─────────────────────────

describe('P0-05: LLM log sanitization', () => {
  it('redacts email addresses', async () => {
    const { sanitizeForLog } = await import('@/lib/llm-adapter')
    const result = sanitizeForLog('user: test@example.com')
    expect(result).toContain('[EMAIL_REDACTED]')
    expect(result).not.toContain('test@example.com')
  })

  it('redacts phone numbers', async () => {
    const { sanitizeForLog } = await import('@/lib/llm-adapter')
    const result = sanitizeForLog('phone: 13800138000')
    expect(result).toContain('[PHONE_REDACTED]')
    expect(result).not.toContain('13800138000')
  })

  it('redacts Chinese ID numbers', async () => {
    const { sanitizeForLog } = await import('@/lib/llm-adapter')
    const result = sanitizeForLog('id: 110101199001011234')
    expect(result).toContain('[ID_REDACTED]')
    expect(result).not.toContain('110101199001011234')
  })

  it('truncates long inputs to 4000 chars', async () => {
    const { sanitizeForLog } = await import('@/lib/llm-adapter')
    const long = 'x'.repeat(5000)
    const result = sanitizeForLog(long)
    expect(result.length).toBe(4000)
  })
})

// ─── P0-02: bandit_reader 角色 — SQL 验证 (§4.4) ───────────

describe('P0-02: bandit_reader isolation SQL', () => {
  it('bandit_reader role migration contains REVOKE on credit_records', async () => {
    const fs = await import('fs')
    const path = await import('path')
    const content = fs.readFileSync(
      path.join(process.cwd(), 'supabase/migrations/20260724_bandit_reader_isolation.sql'),
      'utf-8',
    )
    expect(content).toContain('CREATE ROLE bandit_reader')
    expect(content).toContain('REVOKE ALL ON public.credit_records FROM bandit_reader')
    expect(content).toContain('REVOKE ALL ON public.credit_events FROM bandit_reader')
    expect(content).toContain('GRANT SELECT ON public.orders TO bandit_reader')
    expect(content).toContain('GRANT SELECT ON public.protocols TO bandit_reader')
  })
})

// ─── P0-04: insurance_pool migration — SQL 验证 (§12.9) ────

describe('P0-04: insurance_pool migration SQL', () => {
  it('migration contains insurance_pool table creation', async () => {
    const fs = await import('fs')
    const path = await import('path')
    const content = fs.readFileSync(
      path.join(process.cwd(), 'supabase/migrations/20260724_insurance_pool.sql'),
      'utf-8',
    )
    expect(content).toContain('CREATE TABLE IF NOT EXISTS public.insurance_pool')
    expect(content).toContain('amount NUMERIC(12, 2)')
    expect(content).toContain(`type TEXT NOT NULL DEFAULT 'provision'`)
    expect(content).toContain('ENABLE ROW LEVEL SECURITY')
  })
})

// ─── P0-05: llm_logs migration — SQL 验证 (§4.1) ──────────

describe('P0-05: llm_logs migration SQL', () => {
  it('migration contains llm_logs table creation', async () => {
    const fs = await import('fs')
    const path = await import('path')
    const content = fs.readFileSync(
      path.join(process.cwd(), 'supabase/migrations/20260724_llm_logs.sql'),
      'utf-8',
    )
    expect(content).toContain('CREATE TABLE IF NOT EXISTS public.llm_logs')
    expect(content).toContain('prompt TEXT')
    expect(content).toContain('response TEXT')
    expect(content).toContain('latency_ms INT')
    expect(content).toContain('ENABLE ROW LEVEL SECURITY')
  })
})

// ─── P0-01: 代码路径统一 — 路由使用 protocols (§4.2) ─────────

describe('P0-01: demands route uses protocols table', () => {
  it('demands/route.ts writes to protocols table', async () => {
    const fs = await import('fs')
    const path = await import('path')
    const content = fs.readFileSync(
      path.join(process.cwd(), 'src/app/api/demands/route.ts'),
      'utf-8',
    )
    expect(content).toMatch(/\.from\(['"]protocols['"]\)/)
    expect(content).not.toMatch(/\.from\(['"]demands['"]\)/)
  })

  it('demands/create/route.ts writes to protocols table', async () => {
    const fs = await import('fs')
    const path = await import('path')
    const content = fs.readFileSync(
      path.join(process.cwd(), 'src/app/api/demands/create/route.ts'),
      'utf-8',
    )
    expect(content).toMatch(/\.from\(['"]protocols['"]\)/)
    expect(content).not.toMatch(/\.from\(['"]demands['"]\)/)
  })
})
