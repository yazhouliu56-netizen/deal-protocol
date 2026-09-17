-- ============================================================
-- R8 野表收编：contract_events（用户裁决 2026-09-18，方案 A 表随码）
-- 实证三断：① schema 与 writer 契约错位（表只有 id/contract_id/event_type/payload/created_at，
-- 代码写 actor_id/from_status/to_status/action/reason/metadata → 全写失败）；
-- ② RLS 开但零策略 = 全员拒绝（含匿名/登录用户）；③ 零建表迁移（dashboard 野生）。
-- 本迁移：列对齐（只加不删，event_type/payload 保留）＋ RLS 最小权限。
-- 写端：仅 service（RLS bypass），不建 INSERT/UPDATE/DELETE 策略 = 默认拒绝；
-- 代码侧 events.ts 单点换 service（同提交）。读端：当事方＋管理员（authenticated）。
-- 全幂等（IF NOT EXISTS / IF EXISTS / DROP POLICY IF EXISTS）。
-- ============================================================

CREATE TABLE IF NOT EXISTS public.contract_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  contract_id UUID NULL,
  event_type TEXT NOT NULL DEFAULT 'action',
  payload JSONB NULL,
  actor_id TEXT NULL,
  from_status TEXT NULL,
  to_status TEXT NULL,
  action TEXT NULL,
  reason TEXT NULL,
  metadata TEXT NULL,
  created_at TIMESTAMPTZ NULL DEFAULT now()
);

ALTER TABLE public.contract_events ADD COLUMN IF NOT EXISTS contract_id UUID;
ALTER TABLE public.contract_events ADD COLUMN IF NOT EXISTS event_type TEXT;
ALTER TABLE public.contract_events ADD COLUMN IF NOT EXISTS payload JSONB;
ALTER TABLE public.contract_events ADD COLUMN IF NOT EXISTS actor_id TEXT;
ALTER TABLE public.contract_events ADD COLUMN IF NOT EXISTS from_status TEXT;
ALTER TABLE public.contract_events ADD COLUMN IF NOT EXISTS to_status TEXT;
ALTER TABLE public.contract_events ADD COLUMN IF NOT EXISTS action TEXT;
ALTER TABLE public.contract_events ADD COLUMN IF NOT EXISTS reason TEXT;
ALTER TABLE public.contract_events ADD COLUMN IF NOT EXISTS metadata TEXT;
ALTER TABLE public.contract_events ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ;

ALTER TABLE public.contract_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS contract_events_parties_select ON public.contract_events;
CREATE POLICY contract_events_parties_select ON public.contract_events
  FOR SELECT TO authenticated USING (
    EXISTS (
      SELECT 1 FROM public.contracts c
      WHERE c.id = contract_events.contract_id
        AND (c.customer_id = auth.uid() OR c.provider_id = auth.uid())
    )
    OR EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
  );

-- ============================================================
-- payments 列对齐（三通道 webhook 实证：stripe/wechat/alipay 均写
-- provider＋provider_payment_id，alipay 幂等回读依赖后者；云端实表缺此二列 →
-- 回调落盘全灭。只加列，不动 channel/既有 RLS，保持 service 写）。
-- ============================================================

CREATE TABLE IF NOT EXISTS public.payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  contract_id UUID NULL,
  channel TEXT NULL,
  amount NUMERIC NULL,
  status TEXT NULL,
  provider TEXT NULL,
  provider_payment_id TEXT NULL,
  created_at TIMESTAMPTZ NULL DEFAULT now()
);

ALTER TABLE public.payments ADD COLUMN IF NOT EXISTS contract_id UUID;
ALTER TABLE public.payments ADD COLUMN IF NOT EXISTS channel TEXT;
ALTER TABLE public.payments ADD COLUMN IF NOT EXISTS amount NUMERIC;
ALTER TABLE public.payments ADD COLUMN IF NOT EXISTS status TEXT;
ALTER TABLE public.payments ADD COLUMN IF NOT EXISTS provider TEXT;
ALTER TABLE public.payments ADD COLUMN IF NOT EXISTS provider_payment_id TEXT;
ALTER TABLE public.payments ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ;
