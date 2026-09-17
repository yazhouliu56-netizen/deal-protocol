-- 20260918 P4 双钟表：base 即释 + 15% 批量池。
--
-- 用户裁决 2026-09-18：评价窗（72h）只管评价有效；base 85% 确认即释；
-- 15% 进待释池，按 N=10 单 / T=7 天（先到为准）批量结算，评价随批量同步解密。
-- R5 整单释放逻辑删除，由 releaseSatisfactionBase + settleSatisfactionBatch 接管。
-- 两表均为 service 专用（RLS 启用、零策略，沿 contract_events 先例）。
-- 幂等，可重复执行。

CREATE TABLE IF NOT EXISTS public.satisfaction_holds (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  contract_id TEXT NOT NULL UNIQUE,
  provider_id TEXT NOT NULL,
  hold_cents INTEGER NOT NULL CHECK (hold_cents >= 0),
  base_cents INTEGER NOT NULL CHECK (base_cents >= 0),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  released BOOLEAN NOT NULL DEFAULT false,
  batch_id UUID NULL,
  released_at TIMESTAMPTZ NULL
);
CREATE INDEX IF NOT EXISTS idx_satisfaction_holds_provider
  ON public.satisfaction_holds (provider_id, released, created_at);
CREATE INDEX IF NOT EXISTS idx_satisfaction_holds_unreleased
  ON public.satisfaction_holds (released, created_at) WHERE released = false;
ALTER TABLE public.satisfaction_holds ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS public.satisfaction_batches (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  provider_id TEXT NOT NULL,
  settled_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  contract_count INTEGER NOT NULL,
  hooks_total INTEGER NOT NULL,
  hooks_passed INTEGER NOT NULL,
  amount_cents INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_satisfaction_batches_provider
  ON public.satisfaction_batches (provider_id, settled_at DESC);
ALTER TABLE public.satisfaction_batches ENABLE ROW LEVEL SECURITY;

-- 批量触发配置并入 platform_config（N=10 / T=7d，用户裁决）。
UPDATE public.platform_config
SET config = jsonb_set(config, '{fees,batchRelease}', '{"minCount":10,"maxAgeDays":7}')
WHERE id = 'singleton' AND NOT (config #> '{fees,batchRelease}' IS NOT NULL);
