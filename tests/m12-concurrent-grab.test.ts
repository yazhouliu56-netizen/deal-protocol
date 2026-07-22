import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/lib/supabase-client', () => ({
  getSupabase: vi.fn(),
}))

vi.mock('@/modules/m11-evidence-log/evidence-chain', () => ({
  appendEvidence: vi.fn(),
}))

import { getSupabase } from '@/lib/supabase-client'
import { appendEvidence } from '@/modules/m11-evidence-log/evidence-chain'
import { grabOrder } from '@/modules/m12-push/push-service'

class MockChain {
  readonly from = vi.fn(() => this)
  readonly select = vi.fn(() => this)
  readonly eq = vi.fn(() => this)
  readonly update = vi.fn(() => this)
  readonly insert = vi.fn(() => this)
  readonly then = vi.fn((resolve: (v: unknown) => unknown) => resolve({ data: [{ id: 'proto-1' }], error: null }))
}

describe('M12 Concurrent Grab', () => {
  let chain: MockChain

  beforeEach(() => {
    vi.clearAllMocks()
    chain = new MockChain()
    getSupabase.mockReturnValue({ from: chain.from } as any)
    appendEvidence.mockResolvedValue({
      id: 'ev-1',
      protocol_id: 'proto-1',
      order_id: null,
      event_type: 'order_grabbed',
      payload: {},
      payload_ref: null,
      captured_by: null,
      hash: 'abc',
      prev_hash: 'GENESIS',
      created_at: '2026-01-01T00:00:00Z',
    })
  })

  it('uses DB optimistic lock: WHERE status=matching', async () => {
    await grabOrder('proto-1', 'provider-1')

    expect(chain.update).toHaveBeenCalledWith({
      provider_id: 'provider-1',
      status: 'matched',
    })
    expect(chain.eq).toHaveBeenCalledWith('status', 'matching')
  })

  it('succeeds when UPDATE matches a row', async () => {
    chain.then.mockImplementation((resolve: (v: unknown) => unknown) => resolve({ data: [{ id: 'proto-1' }], error: null }))

    const result = await grabOrder('proto-1', 'provider-1')

    expect(result.success).toBe(true)
    expect(result.winnerId).toBe('provider-1')
  })

  it('fails when UPDATE matches zero rows (already taken)', async () => {
    chain.then.mockImplementation((resolve: (v: unknown) => unknown) => resolve({ data: [], error: null }))

    const result = await grabOrder('proto-1', 'provider-1')

    expect(result.success).toBe(false)
    expect(result.message).toBe('Order has already been taken by another provider')
  })

  it('returns failure when protocol does not exist', async () => {
    chain.then.mockImplementation((resolve: (v: unknown) => unknown) => resolve({ data: [], error: null }))

    const result = await grabOrder('proto-nonexistent', 'provider-1')

    expect(result.success).toBe(false)
    expect(result.message).toBe('Order has already been taken by another provider')
  })

  it('allows only one winner among 10 concurrent grabbers', async () => {
    let callCount = 0
    chain.then.mockImplementation((resolve: (v: unknown) => unknown) => {
      callCount++
      if (callCount === 1) {
        return resolve({ data: [{ id: 'proto-1' }], error: null })
      }
      return resolve({ data: [], error: null })
    })

    const providers = Array.from({ length: 10 }, (_, i) => `provider-${i + 1}`)
    const results = await Promise.all(providers.map((pid) => grabOrder('proto-1', pid)))

    const winners = results.filter((r) => r.success)
    expect(winners).toHaveLength(1)
    expect(winners[0].winnerId).toBeDefined()

    const losers = results.filter((r) => !r.success)
    expect(losers).toHaveLength(9)
  })
})