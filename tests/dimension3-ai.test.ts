import { describe, it, expect, vi, beforeEach } from 'vitest'

// ─── Test 1: ASR route returns correct HTTP error for bad input ──

describe('Dimension 3 - /api/ai/asr route', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
  })

  it('POST /api/ai/asr returns 400 when no input provided', async () => {
    const { POST } = await import('@/app/api/ai/asr/route')
    const req = new Request('http://localhost:3000/api/ai/asr', { method: 'POST', body: new FormData() })
    const res = await POST(req)
    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.success).toBe(false)
    expect(body.error).toContain('No input')
  })

  it('POST /api/ai/asr returns 500 when AI provider fails', async () => {
    vi.mock('@/lib/ai-provider', () => ({
      getAIModel: vi.fn(() => { throw new Error('API key not configured') }),
    }))
    const { POST } = await import('@/app/api/ai/asr/route')
    const fd = new FormData()
    fd.append('rawText', '需要一名保洁阿姨')
    const res = await POST(new Request('http://localhost:3000/api/ai/asr', { method: 'POST', body: fd }))
    expect(res.status).toBe(500)
    const body = await res.json()
    expect(body.success).toBe(false)
  })
})

// ─── Test 2: Risk interceptor ─────────────────────────────────

describe('Dimension 3 - interceptChatRisk', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
  })

  it('detects "加微信私下转" as OFF_PLATFORM_PAYMENT', async () => {
    const { interceptChatRisk } = await import('@/lib/risk-interceptor')
    const result = interceptChatRisk('加我微信，我私下转给你')
    expect(result.hasRisk).toBe(true)
    expect(result.riskType).toBe('OFF_PLATFORM_PAYMENT')
    expect(result.warningMessage).toContain('资金托管')
  })

  it('detects "不走平台" as OFF_PLATFORM_PAYMENT', async () => {
    const { interceptChatRisk } = await import('@/lib/risk-interceptor')
    const result = interceptChatRisk('我们不走平台吧，直接线下转')
    expect(result.hasRisk).toBe(true)
    expect(result.riskType).toBe('OFF_PLATFORM_PAYMENT')
  })

  it('detects phone number "13800138000" as SENSITIVE_CONTACT', async () => {
    const { interceptChatRisk } = await import('@/lib/risk-interceptor')
    const result = interceptChatRisk('我的手机号是13800138000，你直接联系我')
    expect(result.hasRisk).toBe(true)
    expect(result.riskType).toBe('SENSITIVE_CONTACT')
    expect(result.sanitizedText).toContain('[手机号已屏蔽]')
    expect(result.sanitizedText).not.toContain('13800138000')
  })

  it('detects "加vx" as OFF_PLATFORM_PAYMENT', async () => {
    const { interceptChatRisk } = await import('@/lib/risk-interceptor')
    const result = interceptChatRisk('加vx聊，价格可以优惠')
    expect(result.hasRisk).toBe(true)
    expect(result.riskType).toBe('OFF_PLATFORM_PAYMENT')
  })

  it('detects "支付宝转" as OFF_PLATFORM_PAYMENT', async () => {
    const { interceptChatRisk } = await import('@/lib/risk-interceptor')
    const result = interceptChatRisk('支付宝转给你，不走平台了')
    expect(result.hasRisk).toBe(true)
    expect(result.riskType).toBe('OFF_PLATFORM_PAYMENT')
  })

  it('sanitizedText replaces phone number', async () => {
    const { interceptChatRisk } = await import('@/lib/risk-interceptor')
    const result = interceptChatRisk('加我微信13912345678聊')
    expect(result.hasRisk).toBe(true)
    expect(result.sanitizedText).toBe('加我微信[手机号已屏蔽]聊')
    expect(result.sanitizedText).not.toContain('13912345678')
  })

  it('returns warning message containing platform safeguard info', async () => {
    const { interceptChatRisk } = await import('@/lib/risk-interceptor')
    const result = interceptChatRisk('私下交易')
    expect(result.warningMessage).toContain('⚠️')
    expect(result.warningMessage).toContain('资金托管')
    expect(result.warningMessage).toContain('保险池')
    expect(result.warningMessage).toContain('仲裁')
  })
})

// ─── Test 3: Normal messages - no false positives ─────────────

describe('Dimension 3 - no false positives', () => {
  it('normal service request passes cleanly', async () => {
    const { interceptChatRisk } = await import('@/lib/risk-interceptor')
    const result = interceptChatRisk('需要一名保洁阿姨，明天上午10点，扫地拖地，预算200元，地点：上海人民广场')
    expect(result.hasRisk).toBe(false)
  })

  it('normal chat about price passes cleanly', async () => {
    const { interceptChatRisk } = await import('@/lib/risk-interceptor')
    const result = interceptChatRisk('请问这个服务的价格还能优惠吗？')
    expect(result.hasRisk).toBe(false)
  })

  it('normal address text passes cleanly', async () => {
    const { interceptChatRisk } = await import('@/lib/risk-interceptor')
    const result = interceptChatRisk('我在北京市朝阳区建国路88号')
    expect(result.hasRisk).toBe(false)
  })
})
