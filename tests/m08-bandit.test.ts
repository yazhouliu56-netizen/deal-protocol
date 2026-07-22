import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { BanditRanker, recordReward } from '../src/modules/m08-bandit/bandit-ranker'
import { __setSupabaseClient, __resetSupabaseClient } from '../src/lib/supabase-client'
import type { CandidateProvider } from '../src/lib/contracts'

type MockResponse = { data: unknown; error: unknown }

class MockChain {
  readonly from = vi.fn(() => this)
  readonly select = vi.fn(() => this)
  readonly in = vi.fn<(...args: unknown[]) => Promise<MockResponse>>()
  readonly eq = vi.fn(() => this)
  readonly maybeSingle = vi.fn<(...args: unknown[]) => Promise<MockResponse>>()
  readonly insert = vi.fn(() => this)
  readonly update = vi.fn(() => this)
  readonly then = vi.fn((resolve) => resolve({ error: null }))
}

describe('M08 Bandit Ranker', () => {
  let chain: MockChain

  beforeEach(() => {
    vi.clearAllMocks()
    chain = new MockChain()
    __setSupabaseClient({ from: chain.from } as any)
  })

  afterEach(() => {
    __resetSupabaseClient()
  })

  describe('BanditRanker', () => {
    it('should return candidates in some order', async () => {
      chain.in.mockResolvedValue({
        data: [
          { provider_id: 'p1', impressions: 100, conversions: 10 },
          { provider_id: 'p2', impressions: 50, conversions: 5 },
        ],
        error: null,
      })

      const ranker = new BanditRanker(0)
      const candidates: CandidateProvider[] = [
        { provider_id: 'p1', distance_m: 100, credit_score: 80, category_score: 75, skills: ['cleaning'] },
        { provider_id: 'p2', distance_m: 200, credit_score: 70, category_score: 65, skills: ['cleaning'] },
      ]

      const ranked = await ranker.rank(candidates)
      expect(ranked).toHaveLength(2)
      expect(ranked.map((c) => c.provider_id).sort()).toEqual(['p1', 'p2'])
    })

    it('should NOT access credit_records', async () => {
      chain.in.mockResolvedValue({ data: [], error: null })

      const ranker = new BanditRanker(0)
      const candidates: CandidateProvider[] = [
        { provider_id: 'p1', distance_m: 100, credit_score: 80, category_score: 75, skills: ['cleaning'] },
      ]

      await ranker.rank(candidates)

      const creditCalls = chain.from.mock.calls.filter((c: string[]) => c[0] === 'credit_records')
      expect(creditCalls).toHaveLength(0)
    })

    it('should have epsilon between 0 and 1', () => {
      const ranker = new BanditRanker(0.05)
      const eps = ranker.getEpsilon()
      expect(eps).toBeGreaterThan(0)
      expect(eps).toBeLessThanOrEqual(1)
    })

    it('should handle empty candidates list', async () => {
      chain.in.mockResolvedValue({ data: [], error: null })
      const ranker = new BanditRanker(0.1)
      const ranked = await ranker.rank([])
      expect(ranked).toEqual([])
    })

    it('should handle providers with no stats yet', async () => {
      chain.in.mockResolvedValue({ data: [], error: null })

      const ranker = new BanditRanker(0)
      const candidates: CandidateProvider[] = [
        { provider_id: 'new_provider', distance_m: 100, credit_score: 60, category_score: 50, skills: [] },
      ]

      const ranked = await ranker.rank(candidates)
      expect(ranked).toHaveLength(1)
      expect(ranked[0]!.provider_id).toBe('new_provider')
    })
  })

  describe('recordReward', () => {
    it('should insert new bandit_stats on first reward', async () => {
      chain.maybeSingle.mockResolvedValue({ data: null, error: null })
      chain.insert.mockReturnValue(chain)

      await recordReward('p1', 'cleaning', 'conversion', 1)

      const insertCall = (chain.insert as any).mock.calls[0][0]
      expect(insertCall).toMatchObject({
        provider_id: 'p1',
        category: 'cleaning',
        impressions: 0,
        clicks: 0,
        conversions: 1,
      })
    })

    it('updates existing bandit_stats with accrued values', async () => {
      chain.maybeSingle.mockResolvedValue({
        data: { impressions: 10, clicks: 2, conversions: 1, reward_sum: 1 },
        error: null,
      })

      await recordReward('p1', 'cleaning', 'conversion', 1)

      expect(chain.update).toHaveBeenCalled()
      const updateArg = (chain.update as any).mock.calls[0][0] as { conversions: number; reward_sum: number }
      expect(updateArg.conversions).toBe(2)
      expect(updateArg.reward_sum).toBe(2)
    })

    it('handles negative weight by treating as zero', async () => {
      chain.maybeSingle.mockResolvedValue({
        data: { impressions: 0, clicks: 0, conversions: 0, reward_sum: 0 },
        error: null,
      })

      await recordReward('p1', 'cleaning', 'conversion', -5)

      const updateArg = (chain.update as any).mock.calls[0][0] as { reward_sum: number }
      expect(updateArg.reward_sum).toBe(0)
    })
  })
})