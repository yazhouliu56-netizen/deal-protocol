import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { __setSupabaseClient, __resetSupabaseClient } from '../src/lib/supabase-client'

vi.mock('../src/lib/llm-adapter', () => ({
  callLLM: vi.fn(),
  buildFunctionTool: vi.fn(),
  callLLMJson: vi.fn(),
}))
vi.mock('../src/modules/m03-category-config/category-loader', () => ({
  getCategoryConfig: vi.fn(),
}))
vi.mock('../src/modules/m11-evidence-log/evidence-chain', () => ({
  appendEvidence: vi.fn(),
}))
vi.mock('../src/modules/m07-credit/credit-engine', () => ({
  updateCredit: vi.fn(),
  getCreditScore: vi.fn(),
}))
vi.mock('../src/lib/track-metric', () => ({
  trackMetric: vi.fn(),
}))
vi.mock('@daviekong/payment-core', () => ({
  PaymentManager: vi.fn().mockImplementation(() => ({
    getChannels: vi.fn().mockResolvedValue([]),
    createPayment: vi.fn().mockResolvedValue({ id: 'pay-1', status: 'pending' }),
  })),
}))

import { callLLM, buildFunctionTool } from '../src/lib/llm-adapter'
import { getCategoryConfig } from '../src/modules/m03-category-config/category-loader'
import { appendEvidence } from '../src/modules/m11-evidence-log/evidence-chain'
import { updateCredit, getCreditScore } from '../src/modules/m07-credit/credit-engine'
import { trackMetric } from '../src/lib/track-metric'

class MockChain {
  readonly from = vi.fn(() => this)
  readonly select = vi.fn(() => this)
  readonly eq = vi.fn(() => this)
  readonly in = vi.fn(() => this)
  readonly order = vi.fn(() => this)
  readonly limit = vi.fn(() => this)
  readonly single = vi.fn()
  readonly maybeSingle = vi.fn(() => this)
  readonly insert = vi.fn(() => this)
  readonly update = vi.fn(() => this)
  readonly upsert = vi.fn(() => this)
  readonly channel = vi.fn(() => this)
  readonly subscribe = vi.fn()
  readonly send = vi.fn()
  readonly then = vi.fn((resolve) => resolve({ data: null, error: null }))
}

const defaultSchema = {
  core_fields: {
    location: { type: 'geo', required: true },
    time_window: { type: 'string', required: true },
  },
  category_fields: {
    service_type: { type: 'string', required: true },
  },
}

const defaultExtraction = JSON.stringify({
  core_fields: {
    location: { lat: 34.03, lng: -118.17, radius_km: 5 },
    time_window: 'today 14:00-18:00',
  },
  category_fields: {
    service_type: '下水道疏通',
  },
  confidence: 0.95,
})

const defaultEmbedding = JSON.stringify(new Array(1024).fill(0.1))

async function verifyCallOrder(calls: { name: string; args: any }[]): Promise<void> {
  expect(calls.length).toBeGreaterThan(0)
}

describe('E2E Integration Smoke Test', () => {
  let chain: MockChain
  let supabaseMock: any

  beforeEach(() => {
    vi.clearAllMocks()
    chain = new MockChain()
    supabaseMock = { from: chain.from, channel: chain.channel, rpc: vi.fn() }
    __setSupabaseClient(supabaseMock as any)

    buildFunctionTool.mockReturnValue({ name: 'extract_test', parameters: {} } as any)
    getCategoryConfig.mockResolvedValue({
      category: '家政',
      risk_tier: 'low',
      schema_json: defaultSchema,
      response_mode: 'grab_first',
      entry_requirements: null,
      safety_requirements: null,
      enabled: true,
      version: 1,
    } as any)

    appendEvidence.mockImplementation(async (input: any) => {
      return {
        id: input.eventType === 'completion_confirmed' ? `ev-${input.payload.confirmed_by}` : 'ev-1',
        protocol_id: input.protocolId,
        order_id: null,
        event_type: input.eventType,
        payload: input.payload,
        payload_ref: null,
        captured_by: null,
        hash: 'abc',
        prev_hash: 'GENESIS',
        created_at: '2026-01-01T00:00:00Z',
      } as any
    })

    updateCredit.mockResolvedValue({ success: true, newScore: 65 })
    getCreditScore.mockResolvedValue({
      baseScore: 50,
      categoryScore: null,
      dimensions: {},
      baseTotalDeals: 5,
    })

    trackMetric.mockImplementation(() => {})

    chain.subscribe.mockImplementation((cb?: (s: string) => void) => {
      cb?.('SUBSCRIBED')
      return chain
    })
  })

  afterEach(() => {
    __resetSupabaseClient()
  })

  it('should flow through voice->protocol->match->push->grab->hold->complete->settle->credit', async () => {
    callLLM
      .mockResolvedValueOnce(defaultEmbedding)
      .mockResolvedValueOnce(defaultExtraction)

    chain.single.mockResolvedValue({
      data: { id: 'proto-1', status: 'matching', category: 'test' },
      error: null,
    })
    supabaseMock.rpc.mockResolvedValue({
      data: [
        { user_id: 'provider-1', skills: ['cleaning'], is_online: true, distance_m: 500 },
        { user_id: 'provider-2', skills: ['cleaning'], is_online: true, distance_m: 1000 },
        { user_id: 'provider-3', skills: ['cleaning'], is_online: true, distance_m: 800 },
      ],
      error: null,
    })

    const { generateProtocol } = await import(
      '../src/modules/m04-protocol-generation/protocol-generator'
    )
    const genResult = await generateProtocol({
      userId: 'user-1',
      rawText: '我需要通下水道，今天下午2点到6点',
      category: 'test',
    })

    expect(genResult.success).toBe(true)
    expect(genResult.needConfirm).toBe(false)

    const { routeProtocol } = await import('../src/modules/m06-matching-routing/matcher')
    const matchResult = await routeProtocol({
      protocolId: 'proto-1',
      latitude: 34.03,
      longitude: -118.17,
      category: 'test',
    })

    expect(matchResult.candidateIds.length).toBeGreaterThan(0)
    expect(matchResult.responseMode).toBe('grab_first')

    const { pushToCandidates, grabOrder } = await import('../src/modules/m12-push/push-service')
    await pushToCandidates({
      protocolId: 'proto-1',
      candidateIds: matchResult.candidateIds,
      responseMode: 'grab_first',
    })

    expect(chain.channel).toHaveBeenCalledWith('protocol:proto-1')
    expect(chain.subscribe).toHaveBeenCalled()
    expect(chain.send).toHaveBeenCalled()
    expect(trackMetric).toHaveBeenCalledWith('match.candidate_count', matchResult.candidateIds.length, {
      responseMode: 'grab_first',
    })

    chain.then.mockImplementation((resolve: (v: unknown) => unknown) => resolve({ data: [{ id: 'proto-1' }], error: null }))
    const grabResult = await grabOrder('proto-1', 'provider-1')
    expect(grabResult.success).toBe(true)
    expect(grabResult.winnerId).toBe('provider-1')

    expect(chain.from).toHaveBeenCalledWith('orders')
    expect(chain.insert).toHaveBeenCalled()
    expect(appendEvidence).toHaveBeenCalledWith(
      expect.objectContaining({ eventType: 'order_grabbed' }),
    )

    const { holdPayment, confirmCompletion, settlePayment } = await import(
      '../src/modules/m13-payment/payment-service'
    )

    chain.single.mockResolvedValue({
      data: { id: 'order-1', protocol_id: 'proto-1', amount: 200 },
      error: null,
    })

    const holdResult = await holdPayment('proto-1', 200)
    expect(holdResult.success).toBe(true)

    chain.then.mockImplementation((resolve) => resolve({
      data: [{ id: 'ev-d', payload: { confirmed_by: 'demander' } }],
      error: null,
    }))
    const confirmDemander = await confirmCompletion('proto-1', 'demander')
    expect(confirmDemander.success).toBe(false)
    expect(confirmDemander.message).toBe('Awaiting confirmation from the other party')

    chain.then.mockImplementation((resolve) => resolve({
      data: [
        { id: 'ev-d', payload: { confirmed_by: 'demander' } },
        { id: 'ev-p', payload: { confirmed_by: 'provider' } },
      ],
      error: null,
    }))
    const confirmProvider = await confirmCompletion('proto-1', 'provider')
    expect(confirmProvider.success).toBe(true)

    chain.single.mockResolvedValue({
      data: { id: 'order-1', provider_income: 170, satisfaction_hold: 20, provider_id: 'provider-1' },
      error: null,
    })

    const settleResult = await settlePayment('proto-1')
    expect(settleResult.success).toBe(true)

    expect(updateCredit).toHaveBeenCalled()
  })
})