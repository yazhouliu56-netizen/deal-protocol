-- ============================================================================
-- 20260906_step3b_bridge_and_idempotency.sql
-- Step 3b：protocols↔demands 物理桥接 + 放款幂等列。
--
-- 前置实证（Step 3a 活体探针）：
--   demands.price 存在（放款金额链不断）；platform_config singleton 存在；
--   demands.protocol_id / protocols.demand_id 均 42703 不存在 → 双轨分裂实锤。
-- 执行：Supabase 控制台 SQL Editor 粘贴全文执行 1 次。幂等，可重复执行。
-- RLS：新列按行策略自动覆盖（demands_select/update 的 owner 别名 + admin），
--   无需新增策略；protocol_id 查询加速索引一并建立。
-- ============================================================================

ALTER TABLE public.demands ADD COLUMN IF NOT EXISTS protocol_id UUID REFERENCES public.protocols(id);
ALTER TABLE public.demands ADD COLUMN IF NOT EXISTS released_at TIMESTAMPTZ;
ALTER TABLE public.demands ADD COLUMN IF NOT EXISTS platform_fee NUMERIC(12, 2);
ALTER TABLE public.demands ADD COLUMN IF NOT EXISTS provider_net NUMERIC(12, 2);

CREATE INDEX IF NOT EXISTS idx_demands_protocol ON public.demands(protocol_id);
