import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { __setSupabaseClient, __resetSupabaseClient } from '../src/lib/supabase-client'
import { validateChineseId } from '../src/lib/id-validator'

vi.mock('../src/modules/m11-evidence-log/evidence-chain', () => ({
  appendEvidence: vi.fn(),
}))
vi.mock('../src/modules/m07-credit/credit-engine', () => ({
  updateCredit: vi.fn(),
}))

import { appendEvidence } from '../src/modules/m11-evidence-log/evidence-chain'
import { updateCredit } from '../src/modules/m07-credit/credit-engine'

class MockChain {
  readonly from = vi.fn(() => this)
  readonly select = vi.fn(() => this)
  readonly eq = vi.fn(() => this)
  readonly single = vi.fn()
  readonly update = vi.fn(() => this)
}

describe('M02 Identity Verification', () => {
  let chain: MockChain

  beforeEach(() => {
    chain = new MockChain()
    __setSupabaseClient({ from: chain.from } as any)
    delete process.env.REAL_NAME_API_KEY
    process.env.PII_ENCRYPTION_KEY = '000102030405060708090a0b0c0d0e0f101112131415161718191a1b1c1d1e1f'

    appendEvidence.mockResolvedValue({
      id: 'ev-1',
      protocol_id: null,
      order_id: null,
      event_type: 'audit',
      payload: {},
      payload_ref: null,
      captured_by: null,
      hash: 'abc',
      prev_hash: 'GENESIS',
      created_at: '2026-01-01T00:00:00Z',
    })
    updateCredit.mockResolvedValue({ success: true })
  })

  afterEach(() => {
    __resetSupabaseClient()
  })

  describe('verifyIdentity', () => {
    it('should auto-verify for low-risk category', async () => {
      chain.single.mockResolvedValue({
        data: { risk_tier: 'low', entry_requirements: null },
        error: null,
      })

      const { verifyIdentity } = await import('../src/modules/m02-auth/verify-identity')

      const result = await verifyIdentity({
        userId: 'u1',
        phone: '13800138000',
        realName: '张三',
        idNumber: '110101199001012344',
        category: 'test_cat',
      })

      expect(result.success).toBe(true)
      expect(result.status).toBe('verified')
      expect(updateCredit).toHaveBeenCalledWith(
        expect.objectContaining({ userId: 'u1', eventType: 'verification' }),
      )
    })

    it('should require manual review for high-risk category', async () => {
      chain.single.mockResolvedValue({
        data: { risk_tier: 'high', entry_requirements: null },
        error: null,
      })

      const { verifyIdentity } = await import('../src/modules/m02-auth/verify-identity')

      const result = await verifyIdentity({
        userId: 'u1',
        phone: '13800138000',
        realName: '张三',
        idNumber: '110101199001012344',
        category: 'test_cat',
      })

      expect(result.success).toBe(true)
      expect(result.status).toBe('pending_manual_review')
      expect(result.reason).toContain('High-risk')
      expect(appendEvidence).toHaveBeenCalledWith(
        expect.objectContaining({
          eventType: 'audit',
          payload: expect.objectContaining({ status: 'pending_manual_review' }),
        }),
      )
    })

    it('should return failed for unknown category', async () => {
      chain.single.mockResolvedValue({
        data: null,
        error: { message: 'Not found' },
      })

      const { verifyIdentity } = await import('../src/modules/m02-auth/verify-identity')

      const result = await verifyIdentity({
        userId: 'u1',
        phone: '13800138000',
        realName: '张三',
        idNumber: '110101199001012344',
        category: 'unknown_cat',
      })

      expect(result.success).toBe(false)
      expect(result.status).toBe('failed')
      expect(result.reason).toContain('Unknown category')
    })
  })

  describe('validateChineseId', () => {
    it('should reject invalid format', () => {
      const result = validateChineseId('123')
      expect(result.valid).toBe(false)
      expect(result.reason).toContain('format')
    })

    it('should reject invalid birth date year', () => {
      const result = validateChineseId('110101180001012346')
      expect(result.valid).toBe(false)
      expect(result.reason).toContain('year')
    })

    it('should reject invalid check digit', () => {
      const result = validateChineseId('110101199001012347')
      expect(result.valid).toBe(false)
      expect(result.reason).toContain('Check digit')
    })

    it('should accept valid Chinese ID', () => {
      const result = validateChineseId('110101199001012344')
      expect(result.valid).toBe(true)
      expect(result.parsed).toBeDefined()
      expect(result.parsed!.dob).toBe('1990-01-01')
      expect(result.parsed!.gender).toBe('female')
    })
  })
})
