-- 20260918 P5a 定制需求模型：标签底价表 + 单行项 + 师傅总开关。
--
-- 用户裁决 2026-09-18：事实型固定价 / 情绪型按订单百分比；
-- 师傅总开关先行（说明：接受定制增收但须满足额外需求）；
-- 匹配：有定制项的单只派给开关打开的师傅。
-- 幂等，可重复执行。

-- 定制维度底价表（运营可调；LLM 出初值→运营审核→入库，P7）。
CREATE TABLE IF NOT EXISTS public.custom_dim_floors (
  dim_key TEXT PRIMARY KEY,
  label TEXT NOT NULL,
  mode TEXT NOT NULL CHECK (mode IN ('fixed', 'percent')),
  fixed_amount NUMERIC(12, 2) NOT NULL DEFAULT 0,
  percent_rate NUMERIC(8, 5) NOT NULL DEFAULT 0,
  active BOOLEAN NOT NULL DEFAULT true
);
ALTER TABLE public.custom_dim_floors ENABLE ROW LEVEL SECURITY;

-- 种子：事实型固定价 2 条，情绪型百分比 5 条（percent 相对订单基础价）。
INSERT INTO public.custom_dim_floors (dim_key, label, mode, fixed_amount, percent_rate) VALUES
  ('imported_paint', '进口漆', 'fixed', 50, 0),
  ('deep_clean_addon', '深度保洁加项', 'fixed', 30, 0),
  ('age_limit', '年龄要求', 'percent', 0, 0.03),
  ('dress_code', '着装要求', 'percent', 0, 0.03),
  ('language_req', '语言要求', 'percent', 0, 0.02),
  ('self_tools', '自带工具', 'percent', 0, 0.02),
  ('time_window', '指定时间窗', 'percent', 0, 0.02)
ON CONFLICT (dim_key) DO NOTHING;

-- 单行项：本质一张单子多行项（基础价在 demands.price，溢价在此）。
CREATE TABLE IF NOT EXISTS public.demand_customizations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  demand_id UUID NOT NULL,
  dim_key TEXT NOT NULL REFERENCES public.custom_dim_floors (dim_key),
  amount NUMERIC(12, 2) NOT NULL CHECK (amount >= 0),
  floor NUMERIC(12, 2) NOT NULL CHECK (floor >= 0),
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'refunded', 'consumed')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_demand_custom_demand
  ON public.demand_customizations (demand_id, status);
ALTER TABLE public.demand_customizations ENABLE ROW LEVEL SECURITY;

-- 师傅总开关（默认开：先熟悉玩法；关闭只接基础单）。
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS accepts_custom BOOLEAN NOT NULL DEFAULT true;
