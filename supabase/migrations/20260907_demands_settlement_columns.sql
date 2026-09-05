-- 20260907: demands 放款/履约列补齐（Step 1 并入项）。
--
-- 背景：活体 demands 仅有 id/title/description/status/created_at/category，
-- 放款（payment/release）、仲裁（admin/arbitrate）、指派（assign）、
-- 状态机（status）所需的 price/client_id/customer_id/
-- matched_provider_id/certificate_images/demander_id/budget/updated_at
-- 全缺失。全部可空新增，无回填、无约束变更，幂等。

ALTER TABLE public.demands ADD COLUMN IF NOT EXISTS price NUMERIC(12, 2);
ALTER TABLE public.demands ADD COLUMN IF NOT EXISTS client_id UUID;
ALTER TABLE public.demands ADD COLUMN IF NOT EXISTS customer_id UUID;
ALTER TABLE public.demands ADD COLUMN IF NOT EXISTS matched_provider_id UUID;
ALTER TABLE public.demands ADD COLUMN IF NOT EXISTS certificate_images JSONB;
ALTER TABLE public.demands ADD COLUMN IF NOT EXISTS demander_id UUID;
ALTER TABLE public.demands ADD COLUMN IF NOT EXISTS budget NUMERIC(12, 2);
ALTER TABLE public.demands ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT now();
