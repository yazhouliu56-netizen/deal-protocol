-- 0002 demands/contracts 基线（2026-09-07 补记）：与 0001 同因——
-- 012 的 wallet_logs FK 指向 demands，但 demands 创表躺在 20260723（排序晚于 012）。
-- 本文件 = 20260723 原句 + 后续各迁移的 ADD COLUMN 并集（step2 deroot 的三别名/
-- matched/version、step3b 的 protocol_id/released_at/分账列、0907 结算列、017 向量列）
-- + 20260718_init_rls_policies 策略引用的遗留 provider_id 列（与 matched_provider_id 并存），
-- 全 IF NOT EXISTS，云端重放为无操作收敛。有意省略两处：protocol_id 的 FK
--（protocols 诞生于 001，晚于本文件，沙盒内以外键缺失为代价换启动；生产以云端为准）、
-- 000c… 续补约定不变，不动历史文件名。
CREATE EXTENSION IF NOT EXISTS vector;
CREATE TABLE IF NOT EXISTS public.demands (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  protocol_id UUID,
  demander_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  client_id UUID,
  customer_id UUID,
  matched_provider_id UUID,
  provider_id UUID,
  title TEXT NOT NULL,
  description TEXT,
  budget NUMERIC(12, 2),
  price NUMERIC(12, 2),
  status TEXT NOT NULL DEFAULT 'PENDING',
  released_at TIMESTAMPTZ,
  platform_fee NUMERIC(12, 2),
  provider_net NUMERIC(12, 2),
  certificate_images JSONB,
  version INTEGER NOT NULL DEFAULT 0,
  embedding VECTOR(1536),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.contracts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  demand_id UUID REFERENCES public.demands(id) ON DELETE CASCADE,
  customer_id UUID REFERENCES auth.users(id),
  provider_id UUID REFERENCES auth.users(id),
  fund_status TEXT NOT NULL DEFAULT 'PENDING_HELD',
  amount NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
