import { describe, it, expect, vi } from 'vitest';
import {
  createDemandSchema,
  generateProtocolSchema,
  arbitrateDisputeSchema,
  validateApiInput,
} from '../src/lib/validations/api-schemas';
import { arbitrateDispute } from '../src/lib/ai-arbitrator';
import {
  submitMilestoneCheckpoint,
  confirmMilestoneCheckpoint,
  processExpiredCheckpoints,
} from '../src/lib/milestone-escrow';
import { MIRROR_MODULES_REGISTRY, getDomainModule } from '../src/modules/mM02-mM13/index';

vi.mock('../src/lib/supabase-client', () => {
  const chainable = (val: Record<string, unknown>) => {
    const p = Promise.resolve(val);
    (p as Record<string, unknown>).from = () => chain;
    (p as Record<string, unknown>).select = () => chain;
    (p as Record<string, unknown>).update = () => chain;
    (p as Record<string, unknown>).eq = () => eqResult;
    (p as Record<string, unknown>).lte = () => lteResult;
    (p as Record<string, unknown>).limit = () => limitResult;
    return p;
  };

  const eqResult = chainable({ error: null });
  const lteResult = chainable({
    data: [{ id: 'ckpt-1', contract_id: 'c-1', title: '上门检测', amount: 50 }],
    error: null,
  });
  const limitResult = chainable({
    data: [{ summary: '历史清扫纠纷判例', ruling_principle: '按完工比例退款' }],
    error: null,
  });

  const chain: Record<string, unknown> = {
    from: () => chain,
    select: () => chain,
    update: () => chain,
    insert: () => chain,
    eq: () => eqResult,
    lte: () => lteResult,
    limit: () => limitResult,
    single: () => chain,
    order: () => chain,
  };

  return {
    getServiceClient: () => chain,
    __setServiceClient: (() => undefined) as unknown,
    __resetServiceClient: (() => undefined) as unknown,
  };
});

vi.mock('../src/lib/ai-provider', () => ({
  getAIModel: () => 'mock-model',
}));

const { mockGenerateText } = vi.hoisted(() => {
  const fn = vi.fn(async () => ({
    text: JSON.stringify({
      winner: 'demander',
      reasoning: '基于硬核契约与常理派分析，未按时完成服务，判退款。',
      confidence: 0.90,
      fund_split_ratio: { demander_refund: 1.0, provider_payout: 0.0 },
      credit_impact: { demander_delta: 0, provider_delta: -5 },
    }),
  }));
  return { mockGenerateText: fn };
});

vi.mock('ai', () => ({
  generateText: mockGenerateText,
}));

describe('P2 Integration & Regression Validation', () => {
  describe('Task 2: Zod API Input Gateway', () => {
    it('passes valid demand creation input', () => {
      const result = validateApiInput(createDemandSchema, {
        title: '日常管道疏通',
        category: 'plumbing',
        budget: 150,
      });
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.title).toBe('日常管道疏通');
        expect(result.data.budget).toBe(150);
      }
    });

    it('rejects negative budget', () => {
      const result = validateApiInput(createDemandSchema, {
        title: '恶意需求',
        category: 'plumbing',
        budget: -100,
      });
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.errorResponse.status).toBe(400);
        expect(result.errorResponse.body.details.length).toBeGreaterThan(0);
      }
    });

    it('rejects invalid UUID in dispute schema', () => {
      const result = validateApiInput(arbitrateDisputeSchema, {
        dispute_id: 'not-a-uuid',
        reason: '师傅未到场',
      });
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.errorResponse.body.details[0]).toContain('dispute_id');
      }
    });

    it('strips undeclared injection fields', () => {
      const result = validateApiInput(createDemandSchema, {
        title: '合法需求',
        category: 'cleaning',
        budget: 200,
        injected_field: 'should be stripped',
        malicious: { foo: 'bar' },
      });
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data).not.toHaveProperty('injected_field');
        expect(result.data).not.toHaveProperty('malicious');
        expect(result.data.title).toBe('合法需求');
      }
    });

    it('rejects invalid enum value in generateProtocolSchema', () => {
      const result = validateApiInput(generateProtocolSchema, {
        category: 'plumbing',
        core_fields: { time_window: '09:00-12:00' },
        response_mode: 'invalid_mode',
        risk_tier: 'medium',
      });
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.errorResponse.body.details[0]).toContain('response_mode');
      }
    });

    it('rejects missing required title field', () => {
      const result = validateApiInput(createDemandSchema, {
        category: 'plumbing',
        budget: 100,
      });
      expect(result.success).toBe(false);
    });
  });

  describe('Task 4: AI Arbitrator with RAG & Multi-Perspective', () => {
    it('returns valid ArbitrationResult structure', async () => {
      const result = await arbitrateDispute({
        disputeId: '123e4567-e89b-12d3-a456-426614174000',
        orderId: '123e4567-e89b-12d3-a456-426614174001',
        reason: '师傅没有按约定时间到达且拒绝提供存证照片',
      });

      expect(result).toHaveProperty('winner');
      expect(result).toHaveProperty('reasoning');
      expect(result).toHaveProperty('confidence');
      expect(result).toHaveProperty('fund_split_ratio');
      expect(result).toHaveProperty('credit_impact');
      expect(result).toHaveProperty('requires_human_review');
      expect(result).toHaveProperty('precedents_referenced');
    });

    it('returns correct winner and high confidence', async () => {
      const result = await arbitrateDispute({
        disputeId: '123e4567-e89b-12d3-a456-426614174000',
        orderId: '123e4567-e89b-12d3-a456-426614174001',
        reason: '师傅没有按约定时间到达且拒绝提供存证照片',
      });

      expect(result.winner).toBe('demander');
      expect(result.confidence).toBeGreaterThanOrEqual(0.85);
      expect(result.requires_human_review).toBe(false);
      expect(result.fund_split_ratio.demander_refund).toBe(1.0);
    });

    it('sets requires_human_review when confidence < 0.85', async () => {
      mockGenerateText.mockResolvedValueOnce({
        text: JSON.stringify({
          winner: 'split',
          reasoning: '双方均有过失',
          confidence: 0.70,
          fund_split_ratio: { demander_refund: 0.5, provider_payout: 0.5 },
          credit_impact: { demander_delta: 0, provider_delta: 0 },
        }),
      });

      const result = await arbitrateDispute({
        disputeId: '123e4567-e89b-12d3-a456-426614174000',
        orderId: '123e4567-e89b-12d3-a456-426614174001',
        reason: '双方各有道理',
      });

      expect(result.confidence).toBe(0.70);
      expect(result.requires_human_review).toBe(true);
    });

    it('falls back to safe defaults when LLM is unreachable', async () => {
      mockGenerateText.mockRejectedValueOnce(new Error('LLM timeout'));

      const result = await arbitrateDispute({
        disputeId: '123e4567-e89b-12d3-a456-426614174000',
        orderId: '123e4567-e89b-12d3-a456-426614174001',
        reason: 'AI down test',
      });

      expect(result.winner).toBe('split');
      expect(result.confidence).toBe(0.5);
      expect(result.requires_human_review).toBe(true);
      expect(result.reasoning).toContain('不可用');
    });
  });

  describe('Task 5: Checkpoint Escrow & 24h Auto-Confirm', () => {
    it('generates auto_confirm_at 24 hours in the future', async () => {
      const before = Date.now();
      const res = await submitMilestoneCheckpoint('ckpt-100', 24);

      expect(res.success).toBe(true);
      const ts = new Date(res.autoConfirmAt).getTime();
      expect(ts).toBeGreaterThan(before);
      expect(ts - before).toBeGreaterThanOrEqual(24 * 3600 * 1000);
    });

    it('successfully confirms a checkpoint', async () => {
      const res = await confirmMilestoneCheckpoint('ckpt-100');
      expect(res.success).toBe(true);
    });

    it('processes expired checkpoints in batch', async () => {
      const res = await processExpiredCheckpoints();
      expect(res.processedCount).toBeGreaterThanOrEqual(1);
      expect(res.errors).toHaveLength(0);
    });
  });

  describe('Task 3: Mirror Modules Registry', () => {
    it('exports registry covering mM02 to mM13', () => {
      const expectedIds = Array.from({ length: 12 }, (_, i) => `mM${String(i + 2).padStart(2, '0')}`);
      for (const id of expectedIds) {
        expect(MIRROR_MODULES_REGISTRY[id]).toBeDefined();
        expect(MIRROR_MODULES_REGISTRY[id].isMirrored).toBe(true);
      }
    });

    it('getDomainModule("mM03") returns correct active path', () => {
      const meta = getDomainModule('mM03');
      expect(meta.activePath).toBe('src/modules/m03-category-config');
      expect(meta.name).toBe('Category Config & Pricing');
    });

    it('throws for unknown module ID', () => {
      expect(() => getDomainModule('mM99' as never)).toThrow('Unknown mirror module ID');
    });
  });
});
