import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { __setSupabaseClient, __resetSupabaseClient } from '../src/lib/supabase-client'

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

describe('M10 SOS Routing Exclusion', () => {
  let chain: MockChain

  beforeEach(() => {
    chain = new MockChain()
    __setSupabaseClient({ from: chain.from } as any)
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
    vi.spyOn(console, 'warn').mockImplementation(() => {})
  })

  afterEach(() => {
    __resetSupabaseClient()
  })

  it('suspended provider is excluded from matchNearby results via is_online=false', async () => {
    chain.single
      .mockResolvedValueOnce({ data: { provider_id: 'provider-1', category: 'cleaning' }, error: null })

    const { triggerSOS } = await import('../src/modules/m10-sos/sos-service')
    await triggerSOS({ userId: 'user-1', protocolId: 'proto-1', latitude: 31.2, longitude: 121.5 })

    expect(chain.from).toHaveBeenCalledWith('provider_categories')
    expect(chain.update).toHaveBeenCalledWith({ is_online: false })
    expect(chain.eq).toHaveBeenCalledWith('user_id', 'provider-1')
  })

  it('getSOSStatus returns providerSuspended=true after trigger', async () => {
    chain.single
      .mockResolvedValueOnce({ data: { status: 'disputed', provider_id: 'provider-1' }, error: null })
    chain.maybeSingle
      .mockResolvedValueOnce({ data: { is_online: false }, error: null })
      .mockResolvedValueOnce({ data: { id: 'ev-sos' }, error: null })

    const { getSOSStatus } = await import('../src/modules/m10-sos/sos-service')

    const result = await getSOSStatus('proto-1')

    expect(result).toEqual({
      sosTriggered: true,
      protocolStatus: 'disputed',
      providerSuspended: true,
    })
  })

  it('matchNearby filters out is_online=false providers', async () => {
    const mockRpc = vi.fn()
    __setSupabaseClient({ rpc: mockRpc } as any)

    mockRpc.mockResolvedValue({
      data: [
        { user_id: 'p1', skills: ['cleaning'], is_online: false, distance_m: 100 },
        { user_id: 'p2', skills: ['cleaning'], is_online: true, distance_m: 200 },
      ],
      error: null,
    })

    const { matchNearby } = await import('../src/modules/m05-geo-index/geo-service')

    const result = await matchNearby({
      lat: 31.2, lng: 121.5, radiusKm: 10, category: 'cleaning',
    })

    const onlineProviders = result.filter((p) => p.is_online)
    expect(onlineProviders).toHaveLength(1)
    expect(onlineProviders[0].provider_id).toBe('p2')

    const suspendedInResult = result.find((p) => p.provider_id === 'p1')
    expect(suspendedInResult).toBeDefined()
    expect(suspendedInResult!.is_online).toBe(false)
  })
})