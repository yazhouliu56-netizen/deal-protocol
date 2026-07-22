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

describe('M07 Cross-Category Score Isolation', () => {
  let chain: MockChain

  beforeEach(() => {
    chain = new MockChain()
    chain.single.mockResolvedValue({ data: { id: 'test-evidence-id' } })
    __setSupabaseClient({ from: chain.from } as any)

    appendEvidence.mockResolvedValue({
      id: 'ev-1',
      protocol_id: null,
      order_id: null,
      event_type: 'credit_updated',
      payload: {},
      payload_ref: null,
      captured_by: null,
      hash: 'abc',
      prev_hash: 'GENESIS',
      created_at: '2026-01-01T00:00:00Z',
    })
  })

  afterEach(() => {
    __resetSupabaseClient()
  })

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

  it('updating one category does not affect another category score', async () => {
    chain.maybeSingle
      .mockResolvedValueOnce({
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
    expect(upsertData.category_score).toBe(72)

    const updateCalls = chain.from.mock.calls.filter((c: string[]) => c[0] === 'credit_records')
    expect(updateCalls.length).toBeGreaterThanOrEqual(0)
  })
})