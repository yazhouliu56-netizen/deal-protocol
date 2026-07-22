import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/lib/supabase-client', () => ({
  getSupabase: vi.fn(),
}))

vi.mock('@/modules/m11-evidence-log/evidence-chain', () => ({
  appendEvidence: vi.fn(),
}))

vi.mock('@/lib/track-metric', () => ({
  trackMetric: vi.fn(),
}))

import { getSupabase } from '@/lib/supabase-client'
import { appendEvidence } from '@/modules/m11-evidence-log/evidence-chain'
import { trackMetric } from '@/lib/track-metric'
import { grabOrder, expressInterest, getInterestList, pushToCandidates, LockProvider, DatabaseLockProvider, RedisLockProvider, getLockProvider, setLockProvider } from '@/modules/m12-push/push-service'

class MockChain {
  readonly from = vi.fn(() => this)
  readonly select = vi.fn(() => this)
  readonly eq = vi.fn(() => this)
  readonly in = vi.fn(() => this)
  readonly order = vi.fn(() => this)
  readonly update = vi.fn(() => this)
  readonly insert = vi.fn(() => this)
  readonly delete = vi.fn(() => this)
  readonly channel = vi.fn(() => this)
  readonly subscribe = vi.fn()
  readonly send = vi.fn()
  readonly then = vi.fn((resolve) => resolve({ data: null, error: null }))
}

describe('M12 Push Service', () => {
  let chain: MockChain

  beforeEach(() => {
    vi.clearAllMocks()
    chain = new MockChain()
    getSupabase.mockReturnValue({ from: chain.from, channel: chain.channel } as any)
    appendEvidence.mockResolvedValue({
      id: 'ev-1',
      protocol_id: 'proto-1',
      order_id: null,
      event_type: 'test',
      payload: {},
      payload_ref: null,
      captured_by: null,
      hash: 'abc',
      prev_hash: 'GENESIS',
      created_at: '2026-01-01T00:00:00Z',
    })
    trackMetric.mockImplementation(() => {})
    chain.subscribe.mockImplementation((cb?: (s: string) => void) => {
      cb?.('SUBSCRIBED')
      return chain
    })
  })

  describe('grabOrder', () => {
    it('succeeds when status=matching', async () => {
      chain.select.mockResolvedValue({ data: [{ id: 'proto-1' }], error: null })

      const result = await grabOrder('proto-1', 'provider-1')

      expect(result.success).toBe(true)
      expect(result.winnerId).toBe('provider-1')
      expect(chain.from).toHaveBeenCalledWith('protocols')
      expect(chain.update).toHaveBeenCalledWith({
        provider_id: 'provider-1',
        status: 'matched',
      })
    })

    it('fails when status!=matching (already taken)', async () => {
      chain.select.mockResolvedValue({ data: [], error: null })

      const result = await grabOrder('proto-1', 'provider-1')

      expect(result.success).toBe(false)
      expect(result.message).toBe('Order has already been taken by another provider')
    })
  })

  describe('expressInterest', () => {
    it('writes to evidence_log', async () => {
      const result = await expressInterest('proto-1', 'provider-1')

      expect(result.success).toBe(true)
      expect(appendEvidence).toHaveBeenCalledWith({
        protocolId: 'proto-1',
        eventType: 'interest',
        payload: { provider_id: 'provider-1' },
        capturedBy: 'provider-1',
      })
    })
  })

  describe('getInterestList', () => {
    it('returns providers who expressed interest', async () => {
      chain.order.mockResolvedValue({
        data: [
          { payload: { provider_id: 'p1' }, created_at: '2026-01-01T00:00:00Z' },
          { payload: { provider_id: 'p2' }, created_at: '2026-01-02T00:00:00Z' },
        ],
        error: null,
      })

      const result = await getInterestList('proto-1')

      expect(result).toHaveLength(2)
      expect(result[0].providerId).toBe('p1')
      expect(result[1].providerId).toBe('p2')
    })

    it('returns empty list when no interest expressed', async () => {
      chain.order.mockResolvedValue({ data: [], error: null })

      const result = await getInterestList('proto-1')

      expect(result).toEqual([])
    })
  })

  describe('pushToCandidates', () => {
    it('logs the push event', async () => {
      await pushToCandidates({
        protocolId: 'proto-1',
        candidateIds: ['p1', 'p2'],
        responseMode: 'grab_first',
      })

      expect(chain.channel).toHaveBeenCalledWith('protocol:proto-1')
      expect(chain.subscribe).toHaveBeenCalled()
      expect(chain.send).toHaveBeenCalled()
      expect(appendEvidence).toHaveBeenCalledWith({
        protocolId: 'proto-1',
        eventType: 'push',
        payload: {
          candidate_count: 2,
          response_mode: 'grab_first',
        },
      })
      expect(trackMetric).toHaveBeenCalledWith('match.candidate_count', 2, {
        responseMode: 'grab_first',
      })
    })
  })
})
