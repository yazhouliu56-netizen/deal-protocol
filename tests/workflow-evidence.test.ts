import { describe, it, expect, vi, beforeEach } from 'vitest'
import crypto from 'crypto'
import { trackWorkflowStageEvidence } from '../src/lib/workflow-evidence-tracker'

type QueryResult = { data: unknown; error: unknown }

const mockInsert = vi.hoisted(() => vi.fn())
const mockMaybeSingle = vi.hoisted(() => vi.fn())

vi.mock('../src/lib/supabase-client', () => {
  class MockChain {
    readonly from = vi.fn((_table: string) => this)
    readonly select = vi.fn(() => this)
    readonly eq = vi.fn(() => this)
    readonly order = vi.fn(() => this)
    readonly limit = vi.fn(() => this)
    readonly maybeSingle = mockMaybeSingle
    readonly insert = mockInsert

    then<TResult1 = QueryResult, TResult2 = never>(
      onfulfilled?: ((value: QueryResult) => TResult1 | PromiseLike<TResult1>) | null,
    ): Promise<TResult1 | TResult2> {
      return Promise.resolve({ data: [], error: null }).then(onfulfilled as any)
    }
  }

  const chain = new MockChain()

  return {
    getServiceClient: vi.fn(() => ({ from: chain.from }) as any),
  }
})

beforeEach(() => {
  vi.clearAllMocks()
  mockInsert.mockReturnValue({
    then: (resolve: (v: QueryResult) => void) => resolve({ data: null, error: null }),
  })
  mockMaybeSingle.mockResolvedValue({ data: null, error: null })
})

describe('trackWorkflowStageEvidence', () => {
  it('should insert evidence_log entries for full ACCEPTED → DONE flow with valid hashes', async () => {
    const stages: Array<{
      stage: 'ACCEPTED' | 'DEPARTED' | 'ARRIVED' | 'IN_PROGRESS' | 'DONE'
      latitude?: number
      longitude?: number
    }> = [
      { stage: 'ACCEPTED' },
      { stage: 'DEPARTED' },
      { stage: 'ARRIVED', latitude: 31.2304, longitude: 121.4737 },
      { stage: 'IN_PROGRESS' },
      { stage: 'DONE' },
    ]

    for (const s of stages) {
      const result = await trackWorkflowStageEvidence({
        contractId: 'contract-001',
        userId: 'provider-u1',
        stage: s.stage,
        latitude: s.latitude,
        longitude: s.longitude,
      })

      expect(result.success).toBe(true)
      expect(result.stage).toBe(s.stage)
      expect(result.payloadHash).toMatch(/^[a-f0-9]{64}$/)
    }

    expect(mockInsert).toHaveBeenCalledTimes(5)
    const callStages = mockInsert.mock.calls.map((c) => c[0].event_type)
    expect(callStages).toEqual([
      'STAGE_ACCEPTED',
      'STAGE_DEPARTED',
      'STAGE_ARRIVED',
      'STAGE_IN_PROGRESS',
      'STAGE_DONE',
    ])
    const callHashes = mockInsert.mock.calls.map((c) => c[0].hash)
    for (const h of callHashes) {
      expect(h).toMatch(/^[a-f0-9]{64}$/)
    }
    expect(mockInsert.mock.calls[0][0].prev_hash).toBe('GENESIS')
  })

  it('should compute correct SHA-256 hash for photo URL', async () => {
    const photoUrl = 'https://example.com/photos/start-work-001.jpg'
    const expectedHash = crypto.createHash('sha256').update(photoUrl).digest('hex')

    const result = await trackWorkflowStageEvidence({
      contractId: 'contract-002',
      userId: 'provider-u1',
      stage: 'IN_PROGRESS',
      photoUrl,
    })

    expect(result.success).toBe(true)
    expect(result.payloadHash).toMatch(/^[a-f0-9]{64}$/)

    expect(mockInsert).toHaveBeenCalledTimes(1)
    const insertPayload = mockInsert.mock.calls[0][0]
    expect(insertPayload.event_type).toBe('STAGE_IN_PROGRESS')

    const parsedPayload = JSON.parse(insertPayload.payload)
    expect(parsedPayload.photoHash).toBe(expectedHash)
  })
})
