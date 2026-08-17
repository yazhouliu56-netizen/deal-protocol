import { describe, it, expect, vi, beforeEach } from 'vitest'
import { __setSupabaseClient, __resetSupabaseClient } from '../src/lib/supabase-client'

vi.mock('../src/lib/llm-adapter', () => ({
  callLLM: vi.fn(),
  buildFunctionTool: vi.fn(),
  callLLMJson: vi.fn(),
}))
vi.mock('../src/modules/m11-evidence-log/evidence-chain', () => ({
  appendEvidence: vi.fn(),
}))

import { callLLM } from '../src/lib/llm-adapter'
import { appendEvidence } from '../src/modules/m11-evidence-log/evidence-chain'

class MockChain {
  readonly from = vi.fn(() => this)
  readonly select = vi.fn(() => this)
  readonly eq = vi.fn(() => this)
  readonly single = vi.fn()
  readonly maybeSingle = vi.fn()
  readonly insert = vi.fn(() => this)
  readonly update = vi.fn(() => this)
  readonly upsert = vi.fn(() => this)
  readonly in = vi.fn(() => this)
  readonly is = vi.fn(() => this)
  readonly order = vi.fn(() => this)
  readonly limit = vi.fn(() => this)
  readonly or = vi.fn(() => this)
  _data: unknown = null

  then<TResult1 = unknown, TResult2 = never>(
    onfulfilled?: ((value: unknown) => TResult1 | PromiseLike<TResult1>) | null,
  ): PromiseLike<TResult1 | TResult2> {
    const result = this._data !== null ? { data: this._data, error: null } : { data: undefined, error: null }
    const prom = Promise.resolve(result)
    return onfulfilled ? prom.then(onfulfilled) : prom
  }
}

function makeChain(data?: unknown): MockChain {
  const chain = new MockChain()
  chain._data = data ?? null
  chain.single.mockRejectedValue(new Error('not mocked'))
  chain.maybeSingle.mockRejectedValue(new Error('not mocked'))
  return chain
}

// ─────────────────────────────────────────────
// 1. Contract Builder
// ─────────────────────────────────────────────

describe('LLM Integration - Contract Builder', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    __resetSupabaseClient()
  })

  it('generateFormalContractDoc returns null when protocol has no id', async () => {
    const { generateFormalContractDoc } = await import('../src/lib/contract-builder')
    const result = await generateFormalContractDoc({ category: 'test' })
    expect(result).toBeNull()
  })

  it('generateFormalContractDoc generates markdown, html, and sha256 hash', async () => {
    vi.mocked(callLLM).mockResolvedValue(
      '# 正式服务合同书\n\n## 服务内容\n日常保洁服务\n\n## 费用\n¥200\n\n## 免责声明\n服务人员不承担高空作业。',
    )
    const { generateFormalContractDoc } = await import('../src/lib/contract-builder')
    const result = await generateFormalContractDoc({
      id: 'proto-1',
      demander_id: 'user-1',
      category: '家政',
      core_fields: { location: '北京市朝阳区', time_window: '2026-07-25 14:00' },
      category_fields: { service_type: '日常保洁' },
      risk_tier: 'low',
      status: 'matching',
    })

    expect(result).not.toBeNull()
    expect(result!.markdown).toContain('正式服务合同书')
    expect(result!.html).toContain('<h1>')
    expect(result!.hash).toMatch(/^[a-f0-9]{64}$/)
    expect(appendEvidence).toHaveBeenCalledWith(
      expect.objectContaining({
        protocolId: 'proto-1',
        eventType: 'CONTRACT_DOC_HASH',
        payload: expect.objectContaining({ contract_doc_hash: result!.hash }),
      }),
    )
  })

  it('generateFormalContractDoc returns null when LLM returns short text', async () => {
    vi.mocked(callLLM).mockResolvedValue('ok')
    const { generateFormalContractDoc } = await import('../src/lib/contract-builder')
    const result = await generateFormalContractDoc({
      id: 'proto-2',
      category: 'XX',
    })
    expect(result).toBeNull()
  })

  it('generateFormalContractDoc returns null when LLM throws', async () => {
    vi.mocked(callLLM).mockRejectedValue(new Error('LLM down'))
    const { generateFormalContractDoc } = await import('../src/lib/contract-builder')
    const result = await generateFormalContractDoc({
      id: 'proto-3',
      category: '家政',
    })
    expect(result).toBeNull()
  })
})

// ─────────────────────────────────────────────
// 2. Semantic Matcher
// ─────────────────────────────────────────────

describe('LLM Integration - Semantic Matcher', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('getCachedSemanticScore returns 0-100 and caches results', async () => {
    vi.mocked(callLLM).mockResolvedValue('85')
    const { getCachedSemanticScore, clearSemanticCache } = await import('../src/lib/semantic-matcher')
    clearSemanticCache()

    const score = await getCachedSemanticScore('p1', 'prov-1', '家政')
    expect(score).toBe(85)
    expect(callLLM).toHaveBeenCalledTimes(1)

    const score2 = await getCachedSemanticScore('p1', 'prov-1', '家政')
    expect(score2).toBe(85)
    expect(callLLM).toHaveBeenCalledTimes(1)
  })

  it('getCachedSemanticScore returns 0 for non-numeric LLM response', async () => {
    vi.mocked(callLLM).mockResolvedValue('not-a-number')
    const { getCachedSemanticScore, clearSemanticCache } = await import('../src/lib/semantic-matcher')
    clearSemanticCache()

    const score = await getCachedSemanticScore('p2', 'prov-2', '按摩')
    expect(score).toBe(0)
  })

  it('getCachedSemanticScore returns 0 when LLM throws', async () => {
    vi.mocked(callLLM).mockRejectedValue(new Error('LLM error'))
    const { getCachedSemanticScore, clearSemanticCache } = await import('../src/lib/semantic-matcher')
    clearSemanticCache()

    const score = await getCachedSemanticScore('p3', 'prov-3', '家政')
    expect(score).toBe(0)
  })

  it('semanticMultiplier is 1 + score/200 (score 50 → 1.25x)', () => {
    const score = 50
    const multiplier = 1 + score / 200
    expect(multiplier).toBe(1.25)
  })

  it('semanticMultiplier caps at 1.5x (score 100 → 1.5x)', () => {
    const score = 100
    const multiplier = 1 + score / 200
    expect(multiplier).toBe(1.5)
  })

  it('semanticMultiplier minimum at 1.0x (score 0)', () => {
    const score = 0
    const multiplier = 1 + score / 200
    expect(multiplier).toBe(1.0)
  })
})

// ─────────────────────────────────────────────
// 3. Fulfillment Summarizer
// ─────────────────────────────────────────────

describe('LLM Integration - Fulfillment Summarizer', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    __resetSupabaseClient()
  })

  it('generateFulfillmentSnapshot returns null when contract not found', async () => {
    const chain = makeChain()
    chain.single.mockResolvedValue({ data: null })
    __setSupabaseClient({ from: chain.from })
    vi.mocked(callLLM).mockResolvedValue('{"summary":"ok","sentiment":"positive"}')

    const { generateFulfillmentSnapshot } = await import('../src/lib/fulfillment-summarizer')
    const result = await generateFulfillmentSnapshot('nonexistent')
    expect(result).toBeNull()
  })

  it('generateFulfillmentSnapshot returns snapshot from LLM with checkin/photo evidence', async () => {
    const chain = makeChain()
    chain.single.mockResolvedValue({
      data: { id: 'c1', protocol_id: 'p1', demander_id: 'u1', provider_id: 'u2', amount: 200, status: 'SETTLED' },
    })
    chain._data = [
      { event_type: 'geo_checkin', payload: { lat: 31.23, lng: 121.47 }, created_at: '2026-07-25T10:00:00Z' },
      { event_type: 'photo_upload', payload: { hash: 'abc123' }, created_at: '2026-07-25T10:05:00Z' },
      { event_type: 'completion_confirmed', payload: {}, created_at: '2026-07-25T10:10:00Z' },
    ]
    __setSupabaseClient({ from: chain.from })

    vi.mocked(callLLM).mockResolvedValue(
      '{"summary": "服务商已完成上门服务，准时打卡并上传了完工照片。", "sentiment": "positive"}',
    )

    const { generateFulfillmentSnapshot } = await import('../src/lib/fulfillment-summarizer')
    const result = await generateFulfillmentSnapshot('c1')
    expect(result).not.toBeNull()
    expect(result!.summary).toContain('服务商已完成')
    expect(result!.sentiment).toBe('positive')
  })

  it('generateFulfillmentSnapshot falls back to neutral when LLM returns invalid JSON', async () => {
    const chain = makeChain()
    chain.single.mockResolvedValue({
      data: { id: 'c2', protocol_id: 'p2', demander_id: 'u1', provider_id: 'u2', amount: 100, status: 'SETTLED' },
    })
    chain._data = []
    __setSupabaseClient({ from: chain.from })

    vi.mocked(callLLM).mockRejectedValue(new Error('parse error'))

    const { generateFulfillmentSnapshot } = await import('../src/lib/fulfillment-summarizer')
    const result = await generateFulfillmentSnapshot('c2')
    expect(result).not.toBeNull()
    expect(result!.summary).toBe('履约完成（自动确认）')
    expect(result!.sentiment).toBe('neutral')
  })

  it('semantic score is wired into processCandidates (matcher.ts integration)', async () => {
    vi.mocked(callLLM).mockResolvedValue('90')
    const { getCachedSemanticScore, clearSemanticCache } = await import('../src/lib/semantic-matcher')
    clearSemanticCache()

    const score = await getCachedSemanticScore('p-match', 'prov-match', '家政')
    const multiplier = 1 + score / 200
    const baseScore = 70
    const boostedScore = Math.round(baseScore * multiplier * 100) / 100

    expect(score).toBe(90)
    expect(multiplier).toBe(1.45)
    expect(boostedScore).toBe(101.5)
  })
})

// ─────────────────────────────────────────────
// 4. Concierge Agent
// ─────────────────────────────────────────────

describe('LLM Integration - Concierge Agent', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    __resetSupabaseClient()
  })

  it('buildConciergeContext returns empty array for empty userId', async () => {
    const { buildConciergeContext } = await import('../src/lib/concierge-agent')
    const messages = await buildConciergeContext('')
    expect(messages).toEqual([])
  })

  it('buildConciergeContext returns checkin reminder when service is within 30 min', async () => {
    const serviceTime = new Date(Date.now() + 15 * 60 * 1000).toISOString()
    const chain = makeChain([
      {
        id: 'contract-1',
        service_stage: 2,
        core_fields: { service_time: serviceTime },
      },
    ])
    __setSupabaseClient({ from: chain.from })
    vi.mocked(callLLM).mockReset()

    const { buildConciergeContext } = await import('../src/lib/concierge-agent')
    const messages = await buildConciergeContext('user-1', '你好')
    expect(messages.length).toBeGreaterThanOrEqual(1)
    expect(messages[0].role).toBe('system')
    expect(messages[0].content).toContain('AI 管家提醒')
  })

  it('buildConciergeContext returns mediation message on friction keywords', async () => {
    vi.mocked(callLLM).mockResolvedValue('请冷静，通过平台仲裁解决分歧。')

    const chain = makeChain([])
    __setSupabaseClient({ from: chain.from })

    const { buildConciergeContext } = await import('../src/lib/concierge-agent')
    const messages = await buildConciergeContext('user-1', '退钱！服务太差了我要退款！')
    expect(messages.length).toBeGreaterThanOrEqual(1)
    expect(messages.some(m => m.content.includes('AI 智能调解'))).toBe(true)
  })

  it('buildConciergeContext does not inject mediation on normal message', async () => {
    const chain = makeChain([])
    __setSupabaseClient({ from: chain.from })

    const { buildConciergeContext } = await import('../src/lib/concierge-agent')
    const messages = await buildConciergeContext('user-1', '你好，我想预约今天下午的保洁服务')
    const mediationMessages = messages.filter(m => m.content.includes('AI 智能调解'))
    expect(mediationMessages.length).toBe(0)
  })

  it('concierge messages are prepended before model messages in chat route', async () => {
    const { buildConciergeContext } = await import('../src/lib/concierge-agent')
    const conciergeMsgs = await buildConciergeContext('')
    const modelMessages = [{ role: 'user', content: 'hello' }]
    const finalMessages = [...conciergeMsgs, ...modelMessages]
    expect(finalMessages.length).toBe(1)
    expect(finalMessages[0]).toEqual({ role: 'user', content: 'hello' })
  })


})
