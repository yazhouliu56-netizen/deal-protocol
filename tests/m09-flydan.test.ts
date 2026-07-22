import { describe, it, expect, vi } from 'vitest'

vi.mock('../src/lib/llm-adapter', () => ({
  callLLM: vi.fn(),
  buildFunctionTool: vi.fn(),
}))
vi.mock('../src/modules/m11-evidence-log/evidence-chain', () => ({
  appendEvidence: vi.fn(),
}))

import { callLLM } from '../src/lib/llm-adapter'

describe('M09 飞单检测 (detectOffPlatformDeal)', () => {
  it('should detect obvious private contact exchange', async () => {
    callLLM.mockResolvedValueOnce(
      JSON.stringify({
        suspected: true,
        confidence: 0.95,
        reason: 'Detected WeChat ID (wx123456) in message',
      }),
    )

    const { detectOffPlatformDeal } = await import('../src/modules/m09-content-audit/content-audit')

    const result = await detectOffPlatformDeal(
      '我的微信号是 wx123456，加我微信聊吧，不用走平台',
    )

    expect(result.suspected).toBe(true)
    expect(result.confidence).toBeGreaterThanOrEqual(0.9)
    expect(result.reason).toBeTruthy()
  })

  it('should detect implied off-platform deal', async () => {
    callLLM.mockResolvedValueOnce(
      JSON.stringify({
        suspected: true,
        confidence: 0.85,
        reason: 'Message suggests direct payment to bypass platform fees',
      }),
    )

    const { detectOffPlatformDeal } = await import('../src/modules/m09-content-audit/content-audit')

    const result = await detectOffPlatformDeal(
      '直接转账便宜100，平台手续费太高了，我们私下交易吧',
    )

    expect(result.suspected).toBe(true)
    expect(result.confidence).toBeGreaterThanOrEqual(0.8)
    expect(result.reason).toBeTruthy()
  })

  it('should NOT detect normal message', async () => {
    callLLM.mockResolvedValueOnce(
      JSON.stringify({
        suspected: false,
        confidence: 0.05,
      }),
    )

    const { detectOffPlatformDeal } = await import('../src/modules/m09-content-audit/content-audit')

    const result = await detectOffPlatformDeal(
      '你好，请问明天下午两点方便吗？我想预约保洁服务。',
    )

    expect(result.suspected).toBe(false)
    expect(result.confidence).toBeLessThan(0.5)
  })
})

describe('auditProtocolSubmission with off-platform detection', () => {
  it('should flag protocol with off-platform deal content', async () => {
    callLLM
      .mockResolvedValueOnce(
        JSON.stringify({ pass: true, risk_level: 'safe', reason: 'No illegal content' }),
      )
      .mockResolvedValueOnce(
        JSON.stringify({
          suspected: true,
          confidence: 0.92,
          reason: 'Contains WeChat contact for off-platform negotiation',
        }),
      )

    const { auditProtocolSubmission } = await import('../src/modules/m09-content-audit/content-audit')

    const result = await auditProtocolSubmission('p1', '加微信 13800138000 联系，价格可以商量')

    expect(result.risk_level).toBe('warning')
    expect(result.pass).toBe(true)
    expect(result.reason).toContain('WeChat')
  })
})
