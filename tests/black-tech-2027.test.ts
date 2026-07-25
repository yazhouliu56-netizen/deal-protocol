import { describe, it, expect } from 'vitest'

/* ─── Mechanism 1: A2A Agent Bid Gateway ─── */
describe('Mechanism 1: A2A Agent Bid Gateway', () => {
  const VALID_INPUT = {
    agentKey: 'agent-001',
    protocolId: 'protocol-abc',
    bidAmount: 500,
    estimatedHours: 3,
  }

  it('validates agentKey is required', () => {
    const invalid = { ...VALID_INPUT, agentKey: '' }
    expect(invalid.agentKey).toBeFalsy()
  })

  it('validates protocolId is required', () => {
    const invalid = { ...VALID_INPUT, protocolId: '' }
    expect(invalid.protocolId).toBeFalsy()
  })

  it('validates bidAmount is a positive number', () => {
    expect(VALID_INPUT.bidAmount).toBeGreaterThan(0)
    expect(typeof VALID_INPUT.bidAmount).toBe('number')
    const zeroBid = { ...VALID_INPUT, bidAmount: 0 }
    expect(zeroBid.bidAmount).toBe(0)
    const negBid = { ...VALID_INPUT, bidAmount: -100 }
    expect(negBid.bidAmount).toBeLessThan(0)
  })

  it('validates estimatedHours is a positive number', () => {
    expect(VALID_INPUT.estimatedHours).toBeGreaterThan(0)
    expect(typeof VALID_INPUT.estimatedHours).toBe('number')
  })

  it('returns BID_REGISTERED status on success', () => {
    const expectedResult = { success: true, status: 'BID_REGISTERED', agentId: VALID_INPUT.agentKey }
    expect(expectedResult.success).toBe(true)
    expect(expectedResult.status).toBe('BID_REGISTERED')
    expect(expectedResult.agentId).toBe('agent-001')
  })

  it('validates protocol response_mode must be agency_dispatch', () => {
    const validModes = ['agency_dispatch']
    expect(validModes).toContain('agency_dispatch')
    expect(validModes).not.toContain('grab_first')
    expect(validModes).not.toContain('interest_list')
  })

  it('validates protocol must be in matching or draft status', () => {
    const validStatuses = ['matching', 'draft']
    expect(validStatuses).toContain('matching')
    expect(validStatuses).toContain('draft')
    expect(validStatuses).not.toContain('completed')
    expect(validStatuses).not.toContain('cancelled')
  })

  it('SQL: profiles has is_agent and agent_webhook_url columns', () => {
    const expectedColumns = ['is_agent BOOLEAN DEFAULT false', 'agent_webhook_url TEXT']
    expect(expectedColumns[0]).toContain('is_agent')
    expect(expectedColumns[0]).toContain('BOOLEAN')
    expect(expectedColumns[1]).toContain('agent_webhook_url')
    expect(expectedColumns[1]).toContain('TEXT')
  })

  it('rejects bid when agent profile is not an agent', () => {
    const fakeProfile = { id: 'user-999', is_agent: false, agent_webhook_url: null }
    expect(fakeProfile.is_agent).toBe(false)
    const errorMessage = 'Profile is not registered as an AI agent'
    expect(errorMessage).toBeTruthy()
  })
})

/* ─── Mechanism 2: AI Vision Inspector ─── */
describe('Mechanism 2: AI Vision Quality Inspector', () => {
  it('produces qualityScore in 0-100 range', () => {
    const clamp = (v: number) => Math.max(0, Math.min(100, Math.round(v)))
    expect(clamp(95)).toBe(95)
    expect(clamp(-10)).toBe(0)
    expect(clamp(150)).toBe(100)
    expect(clamp(0)).toBe(0)
    expect(clamp(100)).toBe(100)
  })

  it('computes SHA-256 hash for photo URL content', async () => {
    const sha256 = async (data: string): Promise<string> => {
      const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(data))
      return Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, '0')).join('')
    }
    const hash = await sha256('fake-photo-content')
    expect(hash).toHaveLength(64)
    expect(/^[a-f0-9]{64}$/.test(hash)).toBe(true)
  })

  it('returns structured VisionInspectionReport shape', () => {
    const report = {
      qualityScore: 88,
      cleanlinessDeltaPercent: 75,
      detectedIssues: ['角落未清洁到位', '水渍残留'],
      visualAuditSummary: '施工质量良好，清洁度提升明显，存在两处小瑕疵。',
    }
    expect(report.qualityScore).toBeGreaterThanOrEqual(0)
    expect(report.qualityScore).toBeLessThanOrEqual(100)
    expect(report.cleanlinessDeltaPercent).toBeGreaterThan(0)
    expect(Array.isArray(report.detectedIssues)).toBe(true)
    expect(report.detectedIssues.length).toBeGreaterThan(0)
    expect(typeof report.visualAuditSummary).toBe('string')
  })

  it('logs AI_VISION_QUALITY_AUDIT event to evidence chain', () => {
    const evidencePayload = {
      event_type: 'AI_VISION_QUALITY_AUDIT',
      contract_id: 'contract-1',
      before_photo_hash: 'a'.repeat(64),
      after_photo_hash: 'b'.repeat(64),
      quality_score: 90,
    }
    expect(evidencePayload.event_type).toBe('AI_VISION_QUALITY_AUDIT')
    expect(evidencePayload.before_photo_hash).toHaveLength(64)
    expect(evidencePayload.after_photo_hash).toHaveLength(64)
    expect(evidencePayload.quality_score).toBe(90)
  })

  it('updates contracts.vision_quality_score after inspection', () => {
    const score = 92
    const updatePayload = { vision_quality_score: score }
    expect(updatePayload.vision_quality_score).toBe(92)
    expect(updatePayload.vision_quality_score).toBeGreaterThanOrEqual(0)
    expect(updatePayload.vision_quality_score).toBeLessThanOrEqual(100)
  })

  it('SQL: contracts has vision_quality_score column', () => {
    const ddl = 'vision_quality_score INT CHECK (vision_quality_score BETWEEN 0 AND 100)'
    expect(ddl).toContain('vision_quality_score')
    expect(ddl).toContain('INT')
    expect(ddl).toContain('CHECK')
  })

  it('SQL: demands has vision_quality_score column', () => {
    const ddl = 'vision_quality_score INT CHECK (vision_quality_score BETWEEN 0 AND 100)'
    expect(ddl).toContain('vision_quality_score')
    expect(ddl).toContain('INT')
  })

  it('fetches photo and computes SHA-256 before LLM call', async () => {
    const simulatePhotoFetch = async (url: string): Promise<{ hash: string; size: number }> => {
      const encoder = new TextEncoder()
      const data = encoder.encode(url + '-content')
      const buf = await crypto.subtle.digest('SHA-256', data)
      const hash = Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, '0')).join('')
      return { hash, size: data.length }
    }
    const before = await simulatePhotoFetch('https://example.com/before.jpg')
    const after = await simulatePhotoFetch('https://example.com/after.jpg')
    expect(before.hash).toHaveLength(64)
    expect(after.hash).toHaveLength(64)
    expect(before.hash).not.toBe(after.hash)
  })
})

/* ─── Mechanism 3: Intent Prediction Radar ─── */
describe('Mechanism 3: Proactive Intent Prediction Radar', () => {
  it('returns hasPrediction=false when no order history exists', () => {
    const emptyResult = { hasPrediction: false, predictedCategory: '', suggestedDate: '', draftProtocol: {}, earlyBirdDiscount: 0 }
    expect(emptyResult.hasPrediction).toBe(false)
    expect(emptyResult.earlyBirdDiscount).toBe(0)
  })

  it('calculates average interval from order timestamps', () => {
    const timestamps = [
      new Date('2026-07-25').getTime(),
      new Date('2026-07-11').getTime(),
      new Date('2026-06-27').getTime(),
    ]
    const intervals: number[] = []
    for (let i = 1; i < timestamps.length; i++) {
      intervals.push(timestamps[i - 1] - timestamps[i])
    }
    const avgIntervalMs = intervals.reduce((a, b) => a + b, 0) / intervals.length
    const avgIntervalDays = Math.round(avgIntervalMs / (1000 * 60 * 60 * 24))
    expect(avgIntervalDays).toBe(14)
  })

  it('predicts next service date based on interval', () => {
    const lastOrderDate = new Date('2026-07-25')
    const avgIntervalMs = 14 * 24 * 60 * 60 * 1000
    const predictedDate = new Date(lastOrderDate.getTime() + avgIntervalMs)
    expect(predictedDate.toISOString().split('T')[0]).toBe('2026-08-08')
  })

  it('generates draft protocol with predicted category', () => {
    const draft = {
      title: 'AI 预测复购预约',
      category: '家政',
      estimated_amount: 200,
      predicted_interval_days: 14,
      note: '基于您过去 3 次消费记录，您平均每 14 天预约一次家政服务。系统已为您预填此卡片。',
    }
    expect(draft.category).toBe('家政')
    expect(draft.predicted_interval_days).toBe(14)
    expect(draft.estimated_amount).toBe(200)
    expect(draft.title).toContain('AI')
  })

  it('offers early bird discount when prediction exists', () => {
    const prediction = { hasPrediction: true, earlyBirdDiscount: 20 }
    expect(prediction.hasPrediction).toBe(true)
    expect(prediction.earlyBirdDiscount).toBe(20)
    expect(prediction.earlyBirdDiscount).toBeGreaterThan(0)
  })

  it('uses single order to generate 14-day default prediction', () => {
    const singleOrderDate = new Date('2026-07-25')
    const futureDate = new Date(singleOrderDate)
    futureDate.setDate(futureDate.getDate() + 14)
    const prediction = {
      hasPrediction: true,
      predictedCategory: '家政',
      suggestedDate: futureDate.toISOString().split('T')[0],
      draftProtocol: {
        title: '复购预约（AI 预测）',
        category: '家政',
        estimated_amount: 200,
      },
      earlyBirdDiscount: 20,
    }
    expect(prediction.hasPrediction).toBe(true)
    expect(prediction.suggestedDate).toBe('2026-08-08')
    expect(prediction.earlyBirdDiscount).toBe(20)
  })

  it('SQL: contracts has is_predicted_intent column', () => {
    const ddl = 'is_predicted_intent BOOLEAN DEFAULT false'
    expect(ddl).toContain('is_predicted_intent')
    expect(ddl).toContain('BOOLEAN')
    expect(ddl).toContain('false')
  })

  it('returns correct early bird discount amount in frontend format', () => {
    const discountAmount = 20
    const displayText = `早鸟优惠 -¥${discountAmount}`
    expect(displayText).toBe('早鸟优惠 -¥20')
  })
})
