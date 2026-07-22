import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/lib/supabase-client', () => ({
  getSupabase: vi.fn(),
}))

vi.mock('@/modules/m11-evidence-log/evidence-chain', () => ({
  appendEvidence: vi.fn(),
}))

vi.mock('@/modules/m07-credit/credit-engine', () => ({
  updateCredit: vi.fn(),
}))

import { getSupabase } from '@/lib/supabase-client'
import { appendEvidence } from '@/modules/m11-evidence-log/evidence-chain'
import { updateCredit } from '@/modules/m07-credit/credit-engine'
import { triggerSOS, getSOSStatus } from '@/modules/m10-sos/sos-service'

class MockChain {
  readonly from = vi.fn(() => this)
  readonly select = vi.fn(() => this)
  readonly eq = vi.fn(() => this)
  readonly in = vi.fn(() => this)
  readonly order = vi.fn(() => this)
  readonly limit = vi.fn(() => this)
  readonly update = vi.fn(() => this)
  readonly insert = vi.fn(() => this)
  readonly delete = vi.fn(() => this)
  readonly single = vi.fn()
  readonly maybeSingle = vi.fn()
  readonly then = vi.fn((resolve) => resolve({ data: null, error: null }))
}

describe('M10 SOS Service', () => {
  let chain: MockChain

  beforeEach(() => {
    chain = new MockChain()
    getSupabase.mockReturnValue({ from: chain.from } as any)
    chain.single.mockResolvedValue({ data: null, error: null })
    chain.maybeSingle.mockResolvedValue({ data: null, error: null })
    appendEvidence.mockResolvedValue({
      id: 'ev-1',
      protocol_id: 'proto-1',
      order_id: null,
      event_type: 'sos',
      payload: {},
      payload_ref: null,
      captured_by: 'user-1',
      hash: 'abc',
      prev_hash: 'GENESIS',
      created_at: '2026-01-01T00:00:00Z',
    })
    updateCredit.mockResolvedValue({ success: true })
    vi.spyOn(console, 'log').mockImplementation(() => {})
  })

  it('triggerSOS freezes the protocol (status -> disputed)', async () => {
    chain.single.mockResolvedValue({ data: null, error: null })

    await triggerSOS({ userId: 'user-1', protocolId: 'proto-1', latitude: 31.2, longitude: 121.5 })

    expect(chain.from).toHaveBeenCalledWith('protocols')
    expect(chain.update).toHaveBeenCalledWith({ status: 'disputed' })
    expect(chain.eq).toHaveBeenCalledWith('id', 'proto-1')
  })

  it('triggerSOS writes evidence_log', async () => {
    chain.single.mockResolvedValue({ data: null, error: null })

    await triggerSOS({ userId: 'user-1', protocolId: 'proto-1', latitude: 31.2, longitude: 121.5 })

    expect(appendEvidence).toHaveBeenCalledWith(
      expect.objectContaining({ eventType: 'sos', protocolId: 'proto-1' }),
    )
  })

  it('triggerSOS suspends provider (is_online -> false)', async () => {
    chain.single.mockResolvedValue({ data: { provider_id: 'provider-1', category: 'cleaning' }, error: null })

    await triggerSOS({ userId: 'user-1', protocolId: 'proto-1', latitude: 31.2, longitude: 121.5 })

    expect(chain.from).toHaveBeenCalledWith('provider_categories')
    expect(chain.update).toHaveBeenCalledWith({ is_online: false })
    expect(chain.eq).toHaveBeenCalledWith('user_id', 'provider-1')
  })

  it('getSOSStatus returns correct status for normal state', async () => {
    chain.single
      .mockResolvedValueOnce({ data: { status: 'matching', provider_id: 'p1' }, error: null })
    chain.maybeSingle
      .mockResolvedValueOnce({ data: { is_online: true }, error: null })
      .mockResolvedValueOnce({ data: null, error: null })

    const result = await getSOSStatus('proto-1')

    expect(result).toEqual({
      sosTriggered: false,
      protocolStatus: 'matching',
      providerSuspended: false,
    })
  })

  it('SOS without provider_id does not crash', async () => {
    chain.single
      .mockResolvedValueOnce({ data: { status: 'completed', provider_id: null }, error: null })
    chain.maybeSingle
      .mockResolvedValueOnce({ data: null, error: null })

    const result = await getSOSStatus('proto-1')

    expect(result).toEqual({
      sosTriggered: false,
      protocolStatus: 'completed',
      providerSuspended: false,
    })
  })
})
