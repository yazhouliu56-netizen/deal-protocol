import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { createHash } from 'crypto'
import { generateAIArbitrationReport, exportJudicialPackage, arbitrateDispute } from '../src/lib/ai-arbitrator'
import { __setSupabaseClient, __resetSupabaseClient, __setServiceClient, __resetServiceClient } from '../src/lib/supabase-client'
import { CIVIL_CODE_ARTICLES, COURT_PRECEDENTS } from '../src/lib/legal-knowledge-base'
import { generateText } from 'ai'

type QueryResult = { data: unknown; error: unknown }

function computeHash(orderId: string, eventType: string, payload: unknown, prevHash: string): string {
  return createHash('sha256')
    .update(JSON.stringify({ orderId, eventType, payload, prevHash }))
    .digest('hex')
}

type EvRow = {
  id: string
  event_type: string
  hash: string
  prev_hash: string
  payload: Record<string, unknown>
  created_at: string
}

function buildEvidenceChain(rows: Pick<EvRow, 'id' | 'event_type' | 'payload' | 'created_at'>[], orderId: string): EvRow[] {
  let prevHash = 'GENESIS'
  return rows.map((r) => {
    const hash = computeHash(orderId, r.event_type, r.payload, prevHash)
    const row: EvRow = { ...r, hash, prev_hash: prevHash }
    prevHash = hash
    return row
  })
}

class MockChain {
  readonly from = vi.fn((_table: string) => this)
  readonly select = vi.fn(() => this)
  readonly eq = vi.fn(() => this)
  readonly single = vi.fn<(...args: unknown[]) => Promise<QueryResult>>()
  readonly order = vi.fn(() => this)
  readonly maybeSingle = vi.fn<(...args: unknown[]) => Promise<QueryResult>>()
  readonly limit = vi.fn(() => this)

  private _nextResult: QueryResult = { data: null, error: null }
  private _fromResults: Map<string, QueryResult> = new Map()

  setResult(data: unknown, error: unknown = null) {
    this._nextResult = { data, error }
  }

  setTableResult(table: string, data: unknown, error: unknown = null) {
    this._fromResults.set(table, { data, error })
  }

  then<TResult1 = QueryResult, TResult2 = never>(
    onfulfilled?: ((value: QueryResult) => TResult1 | PromiseLike<TResult1>) | null,
  ): Promise<TResult1 | TResult2> {
    const lastFromCall = this.from.mock.lastCall?.[0] as string | undefined
    const result = lastFromCall && this._fromResults.has(lastFromCall)
      ? this._fromResults.get(lastFromCall)!
      : this._nextResult
    return Promise.resolve(result).then(onfulfilled)
  }
}

vi.mock('ai', () => ({
  generateText: vi.fn().mockRejectedValue(new Error('LLM unreachable')),
}))

vi.mock('../src/lib/ai-provider', () => ({
  getAIModel: vi.fn(() => ({ modelId: 'mock-model' })),
}))

describe('AI Arbitrator — Legal Knowledge & Civil Code', () => {
  let chain: MockChain

  beforeEach(() => {
    vi.clearAllMocks()
    chain = new MockChain()
    __setSupabaseClient({ from: chain.from })
  })

  afterEach(() => {
    __resetSupabaseClient()
  })

  describe('generateAIArbitrationReport', () => {
    it('should return report with correct structure and civil code references', async () => {
      chain.single.mockResolvedValue({
        data: {
          id: 'dispute-001', order_id: 'order-001', status: 'pending',
          created_at: '2026-07-24T00:00:00Z', demands: { amount: 500 },
        },
        error: null,
      })
      chain.setResult([
        { id: 'ev-1', event_type: 'created', hash: 'abc123', prev_hash: 'GENESIS', created_at: '2026-07-23T10:00:00Z', payload: { action: 'order_placed' } },
        { id: 'ev-2', event_type: 'checkin', hash: 'def456', prev_hash: 'abc123', created_at: '2026-07-23T12:00:00Z', payload: { action: 'provider_checkin' } },
      ])

      const report = await generateAIArbitrationReport('dispute-001')

      expect(report.disputeId).toBe('dispute-001')
      expect(report.responsibilityRatio.demander + report.responsibilityRatio.provider).toBe(100)
      expect(report.recommendedRefundAmount).toBeGreaterThan(0)
      expect(report.recommendedPayoutAmount).toBeGreaterThan(0)
      expect(report.legalStatutes.length).toBeGreaterThanOrEqual(2)

      for (const statute of report.legalStatutes) {
        expect(statute).toContain('中华人民共和国民法典')
      }

      const allArticleNumbers = Object.values(CIVIL_CODE_ARTICLES).map((a) => a.articleNo)
      const citedArticles = report.legalStatutes
        .map((s) => allArticleNumbers.find((a) => s.includes(a)))
        .filter(Boolean)
      expect(citedArticles.length).toBeGreaterThanOrEqual(2)

      expect(report.courtPrecedents.length).toBeGreaterThanOrEqual(1)
      for (const precedent of report.courtPrecedents) {
        expect(precedent).toMatch(/\(\d{4}\)/)
        const hasCaseNo = COURT_PRECEDENTS.some((p) => precedent.includes(p.caseNo))
        expect(hasCaseNo).toBe(true)
      }

      expect(report.reasoningDetails.length).toBeGreaterThanOrEqual(3)
      expect(report.confidenceScore).toBeGreaterThanOrEqual(0)
      expect(report.confidenceScore).toBeLessThanOrEqual(1)
      expect(report.factSummary).toContain('SHA-256')
    })

    it('should throw on missing dispute', async () => {
      chain.single.mockResolvedValue({ data: null, error: new Error('not found') })

      await expect(generateAIArbitrationReport('nonexistent')).rejects.toThrow('Dispute not found')
    })

    it('should handle empty evidence gracefully', async () => {
      chain.single.mockResolvedValue({
        data: {
          id: 'dispute-002', order_id: 'order-002', status: 'pending',
          created_at: '2026-07-24T00:00:00Z', demands: { amount: 300 },
        },
        error: null,
      })
      chain.setResult([])

      const report = await generateAIArbitrationReport('dispute-002')
      expect(report.factSummary).toContain('0 条证据记录')
      expect(report.recommendedRefundAmount).toBe(240)
    })

    it('should use default 200 when amount is missing', async () => {
      chain.single.mockResolvedValue({
        data: {
          id: 'dispute-003', order_id: 'order-003', status: 'pending',
          created_at: '2026-07-24T00:00:00Z', demands: null,
        },
        error: null,
      })
      chain.setResult([])

      const report = await generateAIArbitrationReport('dispute-003')
      expect(report.recommendedRefundAmount).toBe(160)
      expect(report.recommendedPayoutAmount).toBe(40)
    })
  })

  describe('exportJudicialPackage', () => {
    it('should export complete judicial package with hash chain and identity info', async () => {
      chain.single.mockResolvedValue({
        data: {
          id: 'dispute-001', order_id: 'order-001', status: 'pending',
          created_at: '2026-07-24T00:00:00Z', demands: { amount: 500 },
        },
        error: null,
      })
      chain.maybeSingle.mockResolvedValue({
        data: {
          id: 'proto-001', category: '装修', core_fields: { task: '厨房翻新' },
          status: 'signed', final_price: 500, created_at: '2026-07-20T00:00:00Z',
        },
        error: null,
      })
      chain.setTableResult('evidence_log', buildEvidenceChain([
        { id: 'ev-1', event_type: 'created', payload: {}, created_at: '2026-07-23T10:00:00Z' },
        { id: 'ev-2', event_type: 'checkin', payload: { location: { lat: 31.23, lng: 121.47 }, photo_hash: 'sha256:photo1' }, created_at: '2026-07-23T12:00:00Z' },
        { id: 'ev-3', event_type: 'complete', payload: {}, created_at: '2026-07-23T14:00:00Z' },
      ], 'order-001'))
      chain.setTableResult('users', [
        { id: 'u1', phone: '13800138000', nickname: '买家甲', verification_real_name: '张三', verification_id_number: '110101199001011234', created_at: '2026-01-01T00:00:00Z' },
        { id: 'u2', phone: '13900139000', nickname: '服务商乙', verification_real_name: '李四', verification_id_number: '110101198505052345', created_at: '2026-01-02T00:00:00Z' },
      ])

      const pkg = await exportJudicialPackage('dispute-001')

      expect(pkg.caseInfo).toBeDefined()
      expect((pkg.caseInfo).disputeId).toBe('dispute-001')

      expect(pkg.litigationSubjects).toBeDefined()
      expect(Array.isArray(pkg.litigationSubjects)).toBe(true)
      expect((pkg.litigationSubjects).length).toBe(2)
      for (const subject of pkg.litigationSubjects) {
        expect(subject).toHaveProperty('userId')
        expect(subject).toHaveProperty('phone')
        expect(subject).toHaveProperty('realName')
      }

      expect(pkg.originalAgreement).toBeDefined()
      expect((pkg.originalAgreement).category).toBe('装修')

      expect(pkg.hashChain).toBeDefined()
      expect((pkg.hashChain).chainValid).toBe(true)
      expect(Array.isArray((pkg.hashChain).entries)).toBe(true)
      expect((pkg.hashChain).entries.length).toBe(3)

      expect(pkg.performanceTrail).toBeDefined()
      expect(Array.isArray(pkg.performanceTrail)).toBe(true)

      expect(pkg.compiledAt).toBeDefined()
      expect(pkg.compiler).toBe('Deal Protocol AI Arbitration System')
    })

    it('should throw on missing dispute', async () => {
      chain.single.mockResolvedValue({ data: null, error: new Error('not found') })

      await expect(exportJudicialPackage('nonexistent')).rejects.toThrow('Dispute not found')
    })
  })
})

describe('arbitrateDispute — RAG + Three-Perspective', () => {
  let serviceChain: MockChain

  function mockServiceClient(precedents: Array<{ summary: string; ruling_principle: string }> = []) {
    const selectChain = {
      select: vi.fn(() => ({
        limit: vi.fn(() => Promise.resolve({ data: precedents, error: null })),
      })),
    }
    serviceChain = { from: vi.fn(() => selectChain) } as unknown as MockChain
    __setServiceClient({ from: serviceChain.from })
  }

  beforeEach(() => {
    vi.clearAllMocks()
    mockServiceClient()
  })

  afterEach(() => {
    __resetServiceClient()
  })

  describe('happy path', () => {
    it('should return ArbitrationResult with correct structure and valid JSON parse', async () => {
      mockServiceClient([
        { summary: '网络服务合同部分履行退款案', ruling_principle: '按比例分配托管预付款' },
      ])

      vi.mocked(generateText).mockResolvedValueOnce({
        text: JSON.stringify({
          winner: 'provider',
          reasoning: '[硬核契约派]服务商未按时交付；[行业常理派]履约延迟超出合理区间；[权益保护派]需保障买家基本权益。综合裁定服务商为主要过错方。',
          confidence: 0.92,
          fund_split_ratio: { demander_refund: 0.7, provider_payout: 0.3 },
          credit_impact: { demander_delta: 5, provider_delta: -10 },
        }),
      })

      const result = await arbitrateDispute({
        disputeId: 'dispute-rag-001',
        orderId: 'order-001',
        reason: '服务商未按约定时间完成服务，且交付质量不达标',
        evidenceLogs: [
          { event_type: 'created', payload: { action: 'order_placed' } },
          { event_type: 'checkin', payload: { location: { lat: 31.23, lng: 121.47 } } },
        ],
      })

      expect(result.winner).toBe('provider')
      expect(result.reasoning).toContain('契约派')
      expect(result.reasoning).toContain('常理派')
      expect(result.reasoning).toContain('权益保护派')
      expect(result.confidence).toBe(0.92)
      expect(result.fund_split_ratio.demander_refund + result.fund_split_ratio.provider_payout).toBeCloseTo(1.0)
      expect(result.credit_impact.demander_delta).toBe(5)
      expect(result.credit_impact.provider_delta).toBe(-10)
      expect(result.requires_human_review).toBe(false)
      expect(result.precedents_referenced).toContain('网络服务合同部分履行退款案')
    })

    it('should handle split winner and equal fund split', async () => {
      mockServiceClient()

      vi.mocked(generateText).mockResolvedValueOnce({
        text: JSON.stringify({
          winner: 'split',
          reasoning: '[硬核契约派]……[行业常理派]……[权益保护派]……双方均有过失',
          confidence: 0.88,
          fund_split_ratio: { demander_refund: 0.5, provider_payout: 0.5 },
          credit_impact: { demander_delta: 0, provider_delta: 0 },
        }),
      })

      const result = await arbitrateDispute({
        disputeId: 'dispute-rag-002',
        orderId: 'order-002',
        reason: '双方沟通不畅导致交付延迟',
      })

      expect(result.winner).toBe('split')
      expect(result.fund_split_ratio.demander_refund).toBe(0.5)
      expect(result.fund_split_ratio.provider_payout).toBe(0.5)
      expect(result.requires_human_review).toBe(false)
    })
  })

  describe('edge cases', () => {
    it('should flag requires_human_review when confidence < 0.85', async () => {
      vi.mocked(generateText).mockResolvedValueOnce({
        text: JSON.stringify({
          winner: 'demander',
          reasoning: '裁决说明……',
          confidence: 0.72,
          fund_split_ratio: { demander_refund: 1.0, provider_payout: 0.0 },
          credit_impact: { demander_delta: 10, provider_delta: -20 },
        }),
      })

      const result = await arbitrateDispute({
        disputeId: 'dispute-low-conf',
        orderId: 'order-low',
        reason: '质量争议',
      })

      expect(result.confidence).toBe(0.72)
      expect(result.requires_human_review).toBe(true)
    })

    it('should return default split with human_review when LLM unreachable', async () => {
      vi.mocked(generateText).mockRejectedValueOnce(new Error('LLM timeout'))

      const result = await arbitrateDispute({
        disputeId: 'dispute-fail',
        orderId: 'order-fail',
        reason: '服务争议',
      })

      expect(result.winner).toBe('split')
      expect(result.fund_split_ratio.demander_refund).toBe(0.5)
      expect(result.fund_split_ratio.provider_payout).toBe(0.5)
      expect(result.requires_human_review).toBe(true)
      expect(result.reasoning).toContain('不可用')
    })

    it('should return default split with human_review when JSON parse fails', async () => {
      vi.mocked(generateText).mockResolvedValueOnce({
        text: 'invalid json response without proper format',
      })

      const result = await arbitrateDispute({
        disputeId: 'dispute-parse-fail',
        orderId: 'order-parse',
        reason: '服务未完成',
      })

      expect(result.winner).toBe('split')
      expect(result.requires_human_review).toBe(true)
      expect(result.reasoning).toContain('解析异常')
    })

    it('should handle empty evidenceLogs gracefully', async () => {
      vi.mocked(generateText).mockResolvedValueOnce({
        text: JSON.stringify({
          winner: 'split',
          reasoning: '基于有限信息的初步裁决',
          confidence: 0.80,
          fund_split_ratio: { demander_refund: 0.5, provider_payout: 0.5 },
          credit_impact: { demander_delta: 0, provider_delta: 0 },
        }),
      })

      const result = await arbitrateDispute({
        disputeId: 'dispute-empty-ev',
        orderId: 'order-empty',
        reason: '沟通记录不全',
        evidenceLogs: [],
      })

      expect(result.winner).toBe('split')
      expect(result.precedents_referenced).toEqual([])
      expect(result.requires_human_review).toBe(true)
    })

    it('should include RAG precedent context when service client returns data', async () => {
      const precedents = [
        { summary: '技术服务延期交付判例', ruling_principle: '按履约比例分配' },
        { summary: '承揽质量瑕疵退款案', ruling_principle: '按修复成本折价退款' },
        { summary: '平台托管资金分割案', ruling_principle: '双方协商不成则强制分割' },
      ]
      mockServiceClient(precedents)

      vi.mocked(generateText).mockResolvedValueOnce({
        text: JSON.stringify({
          winner: 'split',
          reasoning: '援引三条历史判例进行综合分析',
          confidence: 0.95,
          fund_split_ratio: { demander_refund: 0.6, provider_payout: 0.4 },
          credit_impact: { demander_delta: 2, provider_delta: -3 },
        }),
      })

      const result = await arbitrateDispute({
        disputeId: 'dispute-rag-multi',
        orderId: 'order-rag',
        reason: '服务交付争议',
      })

      expect(result.precedents_referenced.length).toBe(3)
      expect(result.precedents_referenced).toContain('技术服务延期交付判例')
      expect(result.precedents_referenced).toContain('承揽质量瑕疵退款案')
      expect(result.precedents_referenced).toContain('平台托管资金分割案')
      expect(result.confidence).toBe(0.95)
      expect(result.requires_human_review).toBe(false)
    })

    it('should treat missing confidence as 0.7 and require human review', async () => {
      vi.mocked(generateText).mockResolvedValueOnce({
        text: JSON.stringify({
          winner: 'provider',
          reasoning: '仅含裁决结果，无置信度',
          fund_split_ratio: { demander_refund: 0.0, provider_payout: 1.0 },
          credit_impact: { demander_delta: 0, provider_delta: 0 },
        }),
      })

      const result = await arbitrateDispute({
        disputeId: 'dispute-no-conf',
        orderId: 'order-no',
        reason: '无置信度测试',
      })

      expect(result.confidence).toBe(0.7)
      expect(result.requires_human_review).toBe(true)
    })
  })
})
