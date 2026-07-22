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
import { addTeamRequest, expressTeamInterest, fillTeamSlot, getTeamInfo } from '@/modules/m14-team-formation/team-formation'

class MockChain {
  readonly from = vi.fn(() => this)
  readonly select = vi.fn(() => this)
  readonly eq = vi.fn(() => this)
  readonly in = vi.fn(() => this)
  readonly order = vi.fn(() => this)
  readonly update = vi.fn(() => this)
  readonly insert = vi.fn(() => this)
  readonly delete = vi.fn(() => this)
  readonly single = vi.fn()
  readonly maybeSingle = vi.fn()
  readonly then = vi.fn((resolve) => resolve({ data: null, error: null }))
}

describe('M14 Team Formation', () => {
  let chain: MockChain

  beforeEach(() => {
    vi.clearAllMocks()
    chain = new MockChain()
    getSupabase.mockReturnValue({ from: chain.from } as any)
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
  })

  describe('addTeamRequest', () => {
    it('creates a team request', async () => {
      chain.single.mockResolvedValue({ data: { id: 'req-1' }, error: null })

      const result = await addTeamRequest({
        parentProtocolId: 'proto-1',
        leaderId: 'leader-1',
        roleDesc: 'Helper',
        requiredSkills: ['carrying'],
        reward: 50,
      })

      expect(result.success).toBe(true)
      expect(result.requestId).toBe('req-1')
      expect(chain.from).toHaveBeenCalledWith('team_requests')
      expect(chain.insert).toHaveBeenCalledWith({
        parent_protocol_id: 'proto-1',
        leader_id: 'leader-1',
        role_desc: 'Helper',
        required_skills: ['carrying'],
        reward: 50,
      })
    })

    it('returns success=false when insert returns no data', async () => {
      chain.single.mockResolvedValue({ data: null, error: 'insert failed' })

      const result = await addTeamRequest({
        parentProtocolId: 'proto-1',
        leaderId: 'leader-1',
        roleDesc: 'Helper',
        requiredSkills: [],
        reward: 0,
      })

      expect(result.success).toBe(false)
    })
  })

  describe('expressTeamInterest', () => {
    it('records interest when request status is open', async () => {
      chain.single.mockResolvedValue({ data: { id: 'req-1', status: 'open' }, error: null })

      const result = await expressTeamInterest('req-1', 'provider-1')

      expect(result.success).toBe(true)
      expect(appendEvidence).toHaveBeenCalledWith({
        protocolId: 'req-1',
        eventType: 'team_interest',
        payload: { request_id: 'req-1', provider_id: 'provider-1' },
        teamMemberId: 'provider-1',
      })
    })

    it('returns false when request is not open', async () => {
      chain.single.mockResolvedValue({ data: { id: 'req-1', status: 'filled' }, error: null })

      const result = await expressTeamInterest('req-1', 'provider-1')

      expect(result.success).toBe(false)
      expect(appendEvidence).not.toHaveBeenCalled()
    })

    it('returns false when request does not exist', async () => {
      chain.single.mockResolvedValue({ data: null, error: null })

      const result = await expressTeamInterest('nonexistent', 'provider-1')

      expect(result.success).toBe(false)
    })
  })

  describe('fillTeamSlot', () => {
    it('fills a slot successfully', async () => {
      chain.single.mockResolvedValue({
        data: { id: 'req-1', status: 'open', parent_protocol_id: 'proto-1', leader_id: 'leader-1', reward: 50 },
        error: null,
      })

      const result = await fillTeamSlot('req-1', 'provider-1')

      expect(result.success).toBe(true)
      expect(chain.update).toHaveBeenCalledWith({ status: 'filled', member_id: 'provider-1' })
      expect(chain.eq).toHaveBeenCalledWith('id', 'req-1')
      expect(appendEvidence).toHaveBeenCalledWith({
        protocolId: 'proto-1',
        eventType: 'team_slot_filled',
        payload: { request_id: 'req-1', provider_id: 'provider-1', reward: 50 },
        teamMemberId: 'provider-1',
      })
    })

    it('returns false when request is not open', async () => {
      chain.single.mockResolvedValue({
        data: { id: 'req-1', status: 'filled' },
        error: null,
      })

      const result = await fillTeamSlot('req-1', 'provider-1')

      expect(result.success).toBe(false)
    })
  })

  describe('getTeamInfo', () => {
    it('returns team info (leader + members)', async () => {
      chain.single
        .mockResolvedValueOnce({ data: { provider_id: 'leader-1' }, error: null })
        .mockResolvedValueOnce({ data: { id: 'leader-1', nickname: 'Captain' }, error: null })

      const allRequests = [
        { id: 'req-1', parent_protocol_id: 'proto-1', leader_id: 'leader-1', role_desc: 'Carrier', required_skills: ['carrying'], reward: 50, status: 'filled', member_id: 'm1' },
        { id: 'req-2', parent_protocol_id: 'proto-1', leader_id: 'leader-1', role_desc: 'Spotter', required_skills: ['spotting'], reward: 30, status: 'open' },
      ]
      chain.then.mockImplementation((resolve: (v: unknown) => unknown) => resolve({ data: allRequests, error: null }))

      const result = await getTeamInfo('proto-1')

      expect(result.leader.id).toBe('leader-1')
      expect(result.leader.nickname).toBe('Captain')
      expect(result.members).toHaveLength(1)
      expect(result.members[0].roleDesc).toBe('Carrier')
      expect(result.members[0].providerId).toBe('m1')
      expect(result.openRequests).toHaveLength(1)
      expect(result.openRequests[0].roleDesc).toBe('Spotter')
    })

    it('returns empty info when protocol does not exist', async () => {
      chain.single.mockResolvedValue({ data: null, error: null })

      const result = await getTeamInfo('nonexistent')

      expect(result.leader.id).toBe('')
      expect(result.members).toEqual([])
      expect(result.openRequests).toEqual([])
    })
  })
})
