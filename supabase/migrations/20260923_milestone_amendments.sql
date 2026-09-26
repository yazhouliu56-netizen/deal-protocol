-- 20260923: milestone_amendments 改期提案表（C 全功能 M6）
--
-- 改期规则：仅未放款行（PENDING/HELD）可重切；在途验收（SUBMITTED）须先结；
-- 已放款/已退款行锁定。接受即删未放款行＋按新权重建行（金额以合同为准重算，
-- 提案 stages JSON 即审计＋灾备源）。版本号 per-contract 递增，唯一约束防并发。
-- 姿态：新表＋RLS 零策略（service 经 API 读写，disputes 同姿态）；幂等可重放。
CREATE TABLE IF NOT EXISTS public.milestone_amendments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  contract_id UUID NOT NULL REFERENCES public.contracts(id) ON DELETE CASCADE,
  version INT NOT NULL,
  stages JSONB NOT NULL,
  proposed_by VARCHAR(64) NOT NULL,
  status VARCHAR(16) NOT NULL DEFAULT 'PROPOSED',
  decided_by VARCHAR(64),
  decided_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_milestone_amend_ver
  ON public.milestone_amendments (contract_id, version);
ALTER TABLE public.milestone_amendments ENABLE ROW LEVEL SECURITY;
COMMENT ON TABLE public.milestone_amendments IS '分期改期提案：版本链＋双方确认（自批禁止），接受后重切未放款行';
