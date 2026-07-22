import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { __setSupabaseClient, __resetSupabaseClient } from '../src/lib/supabase-client'

vi.mock('../src/modules/m11-evidence-log/evidence-chain', () => ({
  appendEvidence: vi.fn(),
}))

import { appendEvidence } from '../src/modules/m11-evidence-log/evidence-chain'

class MockChain {
  readonly from = vi.fn(() => this)
  readonly select = vi.fn(() => this)
  readonly eq = vi.fn(() => this)
  readonly maybeSingle = vi.fn()
  readonly single = vi.fn()
  readonly insert = vi.fn(() => this)
  readonly upsert = vi.fn(() => this)
}

describe('M07 Credit System', () => {
  let chain: MockChain

  beforeEach(() => {
    chain = new MockChain()
    chain.single.mockResolvedValue({ data: { id: 'test-evidence-id' } })
    __setSupabaseClient({ from: chain.from } as any)
  })

  afterEach(() => {
    __resetSupabaseClient()
  })

  describe('getCreditScore', () => {
    it('should return default scores for new user', async () => {
      chain.maybeSingle.mockResolvedValue({ data: null })

      const { getCreditScore } = await import('../src/modules/m07-credit/credit-engine')

      const result = await getCreditScore('new_user')

      expect(result.baseScore).toBe(60)
      expect(result.categoryScore).toBeNull()
      expect(result.dimensions.integrity).toBe(60)
      expect(result.dimensions.capability).toBe(60)
      expect(result.dimensions.reliability).toBe(60)
      expect(result.dimensions.communication).toBe(60)
      expect(result.dimensions.safety).toBe(60)
      expect(result.dimensions.contribution).toBe(60)
    })
  })

  describe('updateCredit', () => {
    it('should not throw when evidenceId is provided', async () => {
      chain.maybeSingle.mockResolvedValue({ data: null })

      const { updateCredit } = await import('../src/modules/m07-credit/credit-engine')

      const result = await updateCredit({
        userId: 'u1',
        eventType: 'verification',
        evidenceId: 'test-evidence-id',
        description: 'Base credit initialized',
      })

      expect(result.success).toBe(true)
      expect(result.newScore).toBeDefined()
    })

    it('should calculate delta correctly for completion event', async () => {
      chain.maybeSingle.mockResolvedValue({
        data: {
          integrity_score: 60,
          capability_score: 60,
          reliability_score: 60,
          communication_score: 60,
          safety_score: 60,
          contribution_score: 60,
          base_score: 60,
          base_total_deals: 0,
        },
      })

      const { updateCredit } = await import('../src/modules/m07-credit/credit-engine')

      await updateCredit({
        userId: 'u1',
        eventType: 'completion',
        evidenceId: 'test-evidence-id',
        description: 'Order completed',
      })

      const insertCalls = chain.insert.mock.calls as Array<Array<Record<string, unknown>>>
      const deltas = insertCalls.map((c) => ({ dimension: c[0].dimension, delta: c[0].delta }))

      expect(deltas).toContainEqual({ dimension: 'integrity', delta: 1 })
      expect(deltas).toContainEqual({ dimension: 'capability', delta: 0.5 })
      expect(deltas).toContainEqual({ dimension: 'reliability', delta: 0.5 })
    })

    it('should calculate delta correctly for violation event', async () => {
      chain.maybeSingle.mockResolvedValue({
        data: {
          integrity_score: 60,
          capability_score: 60,
          reliability_score: 60,
          communication_score: 60,
          safety_score: 60,
          contribution_score: 60,
          base_score: 60,
          base_total_deals: 0,
        },
      })

      const { updateCredit } = await import('../src/modules/m07-credit/credit-engine')

      await updateCredit({
        userId: 'u1',
        eventType: 'violation',
        evidenceId: 'test-evidence-id',
        description: 'Rule violation',
      })

      const insertCalls = chain.insert.mock.calls as Array<Array<Record<string, unknown>>>
      const deltas = insertCalls.map((c) => ({ dimension: c[0].dimension, delta: c[0].delta }))

      expect(deltas).toContainEqual({ dimension: 'integrity', delta: -10 })
      expect(deltas).toContainEqual({ dimension: 'reliability', delta: -5 })
      expect(deltas).toContainEqual({ dimension: 'safety', delta: -5 })
    })

    it('should calculate delta correctly for report event', async () => {
      chain.maybeSingle.mockResolvedValue({
        data: {
          integrity_score: 60,
          capability_score: 60,
          reliability_score: 60,
          communication_score: 60,
          safety_score: 60,
          contribution_score: 60,
          base_score: 60,
          base_total_deals: 0,
        },
      })

      const { updateCredit } = await import('../src/modules/m07-credit/credit-engine')

      await updateCredit({
        userId: 'u1',
        eventType: 'report',
        evidenceId: 'test-evidence-id',
        description: 'User reported',
      })

      const insertCalls = chain.insert.mock.calls as Array<Array<Record<string, unknown>>>
      const deltas = insertCalls.map((c) => ({ dimension: c[0].dimension, delta: c[0].delta }))

      expect(deltas).toContainEqual({ dimension: 'safety', delta: -3 })
      expect(deltas).toContainEqual({ dimension: 'communication', delta: -2 })
    })

    it('should calculate delta correctly for sos event', async () => {
      chain.maybeSingle.mockResolvedValue({
        data: {
          integrity_score: 60,
          capability_score: 60,
          reliability_score: 60,
          communication_score: 60,
          safety_score: 60,
          contribution_score: 60,
          base_score: 60,
          base_total_deals: 0,
        },
      })

      const { updateCredit } = await import('../src/modules/m07-credit/credit-engine')

      await updateCredit({
        userId: 'u1',
        eventType: 'sos',
        evidenceId: 'test-evidence-id',
        description: 'SOS triggered',
      })

      const insertCalls = chain.insert.mock.calls as Array<Array<Record<string, unknown>>>
      const deltas = insertCalls.map((c) => ({ dimension: c[0].dimension, delta: c[0].delta }))

      expect(deltas).toContainEqual({ dimension: 'safety', delta: -20 })
      expect(deltas).toContainEqual({ dimension: 'integrity', delta: -5 })
    })

    it('should calculate delta correctly for verification event', async () => {
      chain.maybeSingle.mockResolvedValue({
        data: {
          integrity_score: 60,
          capability_score: 60,
          reliability_score: 60,
          communication_score: 60,
          safety_score: 60,
          contribution_score: 60,
          base_score: 60,
          base_total_deals: 0,
        },
      })

      const { updateCredit } = await import('../src/modules/m07-credit/credit-engine')

      await updateCredit({
        userId: 'u1',
        eventType: 'verification',
        evidenceId: 'test-evidence-id',
        description: 'Verified',
      })

      const insertCalls = chain.insert.mock.calls as Array<Array<Record<string, unknown>>>
      const deltas = insertCalls.map((c) => ({ dimension: c[0].dimension, delta: c[0].delta }))

      expect(deltas).toContainEqual({ dimension: 'contribution', delta: 2 })
    })

    it('should increase integrity by 1 when completing an order', async () => {
      chain.maybeSingle.mockResolvedValue({
        data: {
          integrity_score: 60,
          capability_score: 60,
          reliability_score: 60,
          communication_score: 60,
          safety_score: 60,
          contribution_score: 60,
          base_score: 60,
          base_total_deals: 0,
        },
      })

      const { updateCredit } = await import('../src/modules/m07-credit/credit-engine')

      const result = await updateCredit({
        userId: 'u1',
        eventType: 'completion',
        evidenceId: 'test-evidence-id',
        description: 'Order completed',
      })

      expect(result.success).toBe(true)
      expect(result.newScore).toBeGreaterThan(60)
    })

    it('should decrease integrity by 10 for violation', async () => {
      chain.maybeSingle.mockResolvedValue({
        data: {
          integrity_score: 60,
          capability_score: 60,
          reliability_score: 60,
          communication_score: 60,
          safety_score: 60,
          contribution_score: 60,
          base_score: 60,
          base_total_deals: 0,
        },
      })

      const { updateCredit } = await import('../src/modules/m07-credit/credit-engine')

      const result = await updateCredit({
        userId: 'u1',
        eventType: 'violation',
        evidenceId: 'test-evidence-id',
        description: 'Rule violation',
      })

      expect(result.success).toBe(true)
      expect(result.newScore).toBeLessThan(60)
    })
  })

  describe('cross-category isolation', () => {
    it('getCreditScore returns different scores for different categories', async () => {
      chain.maybeSingle
        .mockResolvedValueOnce({
          data: {
            base_score: 65, category_score: 70, category: '家政',
            integrity_score: 65, capability_score: 65, reliability_score: 65,
            communication_score: 65, safety_score: 65, contribution_score: 65,
            base_total_deals: 5,
          },
        })
        .mockResolvedValueOnce({
          data: {
            base_score: 72, category_score: 80, category: '按摩',
            integrity_score: 72, capability_score: 72, reliability_score: 72,
            communication_score: 72, safety_score: 72, contribution_score: 72,
            base_total_deals: 10,
          },
        })

      const { getCreditScore } = await import('../src/modules/m07-credit/credit-engine')

      const score1 = await getCreditScore('u1', '家政')
      const score2 = await getCreditScore('u1', '按摩')

      expect(score1.categoryScore).toBe(70)
      expect(score2.categoryScore).toBe(80)
      expect(score1.categoryScore).not.toBe(score2.categoryScore)
    })

    it('updating one category uses the correct category in upsert', async () => {
      chain.maybeSingle.mockResolvedValue({
        data: {
          base_score: 60, category_score: 70, category: '家政',
          integrity_score: 60, capability_score: 60, reliability_score: 60,
          communication_score: 60, safety_score: 60, contribution_score: 60,
          base_total_deals: 5,
        },
      })

      const { updateCredit } = await import('../src/modules/m07-credit/credit-engine')

      await updateCredit({
        userId: 'u1',
        category: '家政',
        eventType: 'completion',
        evidenceId: 'test-evidence-id',
        description: 'Completed 家政 order',
      })

      const upsertCalls = chain.upsert.mock.calls as Array<Array<Record<string, unknown>>>
      const upsertData = upsertCalls[0][0]
      expect(upsertData.category).toBe('家政')
    })
  })
})
