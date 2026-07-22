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

import { callLLM, buildFunctionTool } from '../src/lib/llm-adapter'
import { getCategoryConfig } from '../src/modules/m03-category-config/category-loader'

class MockChain {
  readonly from = vi.fn(() => this)
  readonly select = vi.fn(() => this)
  readonly eq = vi.fn(() => this)
  readonly single = vi.fn()
  readonly insert = vi.fn(() => this)
  readonly update = vi.fn(() => this)
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

describe('M04 Protocol Generation', () => {
  let chain: MockChain

  beforeEach(() => {
    chain = new MockChain()
    __setSupabaseClient({ from: chain.from } as any)
    buildFunctionTool.mockReturnValue({ name: 'extract_test', parameters: {} } as any)
    getCategoryConfig.mockResolvedValue({
      category: 'test_cat',
      risk_tier: 'low',
      schema_json: defaultSchema,
      response_mode: 'interest_list',
      entry_requirements: null,
      safety_requirements: null,
      enabled: true,
      version: 1,
    } as any)
  })

  afterEach(() => {
    __resetSupabaseClient()
  })

  it('should return missing fields when required fields are absent', async () => {
    callLLM
      .mockResolvedValueOnce(defaultEmbedding)
      .mockResolvedValueOnce(
        JSON.stringify({ core_fields: {}, category_fields: {}, confidence: 0.95 }),
      )

    const { generateProtocol } = await import('../src/modules/m04-protocol-generation/protocol-generator')

    const result = await generateProtocol({
      userId: 'u1',
      rawText: 'I need cleaning service',
      category: 'test_cat',
    })

    expect(result.success).toBe(false)
    expect(result.missingFields).toBeDefined()
    expect(result.missingFields!.length).toBeGreaterThan(0)
    expect(result.error).toContain('Missing required fields')
  })

  it('should auto-match for low-risk category', async () => {
    callLLM
      .mockResolvedValueOnce(defaultEmbedding)
      .mockResolvedValueOnce(defaultExtraction)

    chain.single.mockResolvedValue({
      data: { id: 'protocol_1', status: 'matching' },
      error: null,
    })

    const { generateProtocol } = await import('../src/modules/m04-protocol-generation/protocol-generator')

    const result = await generateProtocol({
      userId: 'u1',
      rawText: 'I need cleaning service',
      category: 'test_cat',
    })

    expect(result.success).toBe(true)
    expect(result.needConfirm).toBe(false)
  })

  it('should force pending_confirm for high-risk category', async () => {
    getCategoryConfig.mockResolvedValue({
      category: 'test_cat',
      risk_tier: 'high',
      schema_json: defaultSchema,
      response_mode: 'interest_list',
      entry_requirements: null,
      safety_requirements: null,
      enabled: true,
      version: 1,
    } as any)

    callLLM
      .mockResolvedValueOnce(defaultEmbedding)
      .mockResolvedValueOnce(defaultExtraction)

    chain.single.mockResolvedValue({
      data: { id: 'protocol_2', status: 'pending_confirm' },
      error: null,
    })

    const { generateProtocol } = await import('../src/modules/m04-protocol-generation/protocol-generator')

    const result = await generateProtocol({
      userId: 'u1',
      rawText: 'I need high-risk service',
      category: 'test_cat',
    })

    expect(result.success).toBe(true)
    expect(result.needConfirm).toBe(true)
  })

  it('should force confirm when LLM confidence is below 0.7', async () => {
    callLLM
      .mockResolvedValueOnce(defaultEmbedding)
      .mockResolvedValueOnce(
        JSON.stringify({
          core_fields: {
            location: { lat: 34.03, lng: -118.17 },
            time_window: 'today 14:00',
          },
          category_fields: { service_type: 'cleaning' },
          confidence: 0.45,
        }),
      )

    chain.single.mockResolvedValue({
      data: { id: 'protocol_3', status: 'pending_confirm' },
      error: null,
    })

    const { generateProtocol } = await import('../src/modules/m04-protocol-generation/protocol-generator')

    const result = await generateProtocol({
      userId: 'u1',
      rawText: 'I need cleaning',
      category: 'test_cat',
    })

    expect(result.success).toBe(true)
    expect(result.needConfirm).toBe(true)
  })

  it('should strip hallucinated fields not in schema', async () => {
    callLLM
      .mockResolvedValueOnce(defaultEmbedding)
      .mockResolvedValueOnce(
        JSON.stringify({
          core_fields: {
            location: { lat: 34.03, lng: -118.17 },
            time_window: 'today 14:00',
            hallucinated_field: 'should be deleted',
          },
          category_fields: {
            service_type: 'cleaning',
            fake_field: 'also deleted',
          },
        }),
      )

    chain.single.mockResolvedValue({
      data: { id: 'protocol_4' },
      error: null,
    })

    const { generateProtocol } = await import('../src/modules/m04-protocol-generation/protocol-generator')

    const result = await generateProtocol({
      userId: 'u1',
      rawText: 'I need cleaning',
      category: 'test_cat',
    })

    expect(result.success).toBe(true)

    const insertArg = (chain.insert as any).mock.calls[0][0] as Record<string, unknown>
    const coreFields = insertArg.core_fields as Record<string, unknown>
    const categoryFields = insertArg.category_fields as Record<string, unknown>

    expect(coreFields.hallucinated_field).toBeUndefined()
    expect(categoryFields.fake_field).toBeUndefined()
    expect(coreFields.location).toBeDefined()
    expect(coreFields.time_window).toBeDefined()
    expect(categoryFields.service_type).toBeDefined()
  })
})
