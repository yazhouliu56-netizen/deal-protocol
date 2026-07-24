import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { createHash } from 'crypto'
import { generateAIArbitrationReport, exportJudicialPackage } from '../src/lib/ai-arbitrator'
import { __setSupabaseClient, __resetSupabaseClient } from '../src/lib/supabase-client'
import { CIVIL_CODE_ARTICLES, COURT_PRECEDENTS } from '../src/lib/legal-knowledge-base'

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
    return Promise.resolve(result).then(onfulfilled as any)
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
    __setSupabaseClient({ from: chain.from } as any)
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
      expect((pkg.caseInfo as any).disputeId).toBe('dispute-001')

      expect(pkg.litigationSubjects).toBeDefined()
      expect(Array.isArray(pkg.litigationSubjects)).toBe(true)
      expect((pkg.litigationSubjects as any[]).length).toBe(2)
      for (const subject of pkg.litigationSubjects as any[]) {
        expect(subject).toHaveProperty('userId')
        expect(subject).toHaveProperty('phone')
        expect(subject).toHaveProperty('realName')
      }

      expect(pkg.originalAgreement).toBeDefined()
      expect((pkg.originalAgreement as any).category).toBe('装修')

      expect(pkg.hashChain).toBeDefined()
      expect((pkg.hashChain as any).chainValid).toBe(true)
      expect(Array.isArray((pkg.hashChain as any).entries)).toBe(true)
      expect((pkg.hashChain as any).entries.length).toBe(3)

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
