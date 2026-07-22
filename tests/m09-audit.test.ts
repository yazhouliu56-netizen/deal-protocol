import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { __setSupabaseClient, __resetSupabaseClient } from '../src/lib/supabase-client'

vi.mock('../src/lib/llm-adapter', () => ({
  callLLM: vi.fn(),
  buildFunctionTool: vi.fn(),
}))
vi.mock('../src/modules/m11-evidence-log/evidence-chain', () => ({
  appendEvidence: vi.fn(),
}))
vi.mock('../src/modules/m07-credit/credit-engine', () => ({
  updateCredit: vi.fn(),
}))

import { callLLM } from '../src/lib/llm-adapter'
import { appendEvidence } from '../src/modules/m11-evidence-log/evidence-chain'
import { updateCredit } from '../src/modules/m07-credit/credit-engine'

class MockChain {
  readonly from = vi.fn(() => this)
  readonly select = vi.fn(() => this)
  readonly eq = vi.fn(() => this)
  readonly single = vi.fn()
  readonly update = vi.fn(() => this)
}

describe('M09 Content Audit', () => {
  let chain: MockChain

  beforeEach(() => {
    chain = new MockChain()
    __setSupabaseClient({ from: chain.from } as any)
  })

  afterEach(() => {
    __resetSupabaseClient()
  })

  describe('auditChatMessage', () => {
    it('should detect off-platform transaction keywords', async () => {
      const { auditChatMessage } = await import('../src/modules/m09-content-audit/content-audit')

      const result = await auditChatMessage(
        'p1',
        '请加微信联系，我们可以私下交易',
        'u1',
      )

      expect(result.pass).toBe(false)
      expect(result.risk_level).toBe('warning')
      expect(result.reason).toContain('Suspicious content')
      expect(appendEvidence).toHaveBeenCalledWith(
        expect.objectContaining({
          eventType: 'chat_flag',
          protocolId: 'p1',
          capturedBy: 'u1',
        }),
      )
    })

    it('should detect threatening language', async () => {
      const { auditChatMessage } = await import('../src/modules/m09-content-audit/content-audit')

      const result = await auditChatMessage(
        'p1',
        '你等着，我要弄死你',
        'u1',
      )

      expect(result.pass).toBe(false)
      expect(result.risk_level).toBe('warning')
      expect(result.reason).toContain('Suspicious content')
    })

    it('should pass safe message', async () => {
      callLLM.mockResolvedValue(
        JSON.stringify({
          pass: true,
          risk_level: 'safe',
          reason: 'Normal content',
        }),
      )

      const { auditChatMessage } = await import('../src/modules/m09-content-audit/content-audit')

      const result = await auditChatMessage(
        'p1',
        '你好，请问明天下午方便吗？',
        'u1',
      )

      expect(result.pass).toBe(true)
      expect(result.risk_level).toBe('safe')
    })
  })

  describe('handleReport', () => {
    it('should trigger high severity for safety report', async () => {
      appendEvidence.mockResolvedValue({ id: 'ev_1' } as any)

      chain.single.mockResolvedValue({
        data: { provider_id: 'provider_1', category: '家政' },
        error: null,
      })

      const { handleReport } = await import('../src/modules/m09-content-audit/content-audit')

      await handleReport({
        reporterId: 'reporter_1',
        protocolId: 'protocol_1',
        reportType: 'safety',
        description: 'Unsafe behavior during service',
      })

      expect(appendEvidence).toHaveBeenCalledWith(
        expect.objectContaining({
          eventType: 'report',
          payload: expect.objectContaining({ severity: 'high' }),
        }),
      )

      expect(updateCredit).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: 'provider_1',
          eventType: 'report',
        }),
      )
    })
  })
})
