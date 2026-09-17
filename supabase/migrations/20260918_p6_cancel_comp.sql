-- 20260918 P6 取消补偿：ETA 快照＋城市档＋交通工具＋补偿应收。
--
-- 用户裁决 2026-09-18：补偿 = 平台预估到达时间 × 城市小时基准（未到×1/已到×2，
-- 3 分钟冷静免费，无封顶）；ETA 接单时快照锁定；签到=状态机 ARRIVED+。
-- 补偿经应收收取（comp_due），实收在 escrow 支付时并入、notify 落账（平台零垫付）。
-- 幂等，可重复执行。

ALTER TABLE public.demands ADD COLUMN IF NOT EXISTS estimated_arrival_min INTEGER;
ALTER TABLE public.demands ADD COLUMN IF NOT EXISTS city_tier INTEGER NOT NULL DEFAULT 2
  CHECK (city_tier IN (1, 2, 3));
ALTER TABLE public.demands ADD COLUMN IF NOT EXISTS assigned_at TIMESTAMPTZ;
ALTER TABLE public.demands ADD COLUMN IF NOT EXISTS comp_due NUMERIC(12, 2) NOT NULL DEFAULT 0;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS vehicle TEXT NOT NULL DEFAULT 'twoWheel'
  CHECK (vehicle IN ('twoWheel', 'fourWheel'));

-- 批量触发配置已在 P4；此处补 ETA 默认（分档分钟，用户裁决口径：平台预估）。
UPDATE public.platform_config
SET config = jsonb_set(config, '{fees,cancelBenchmark,tier1,etaMin}', '30')
WHERE id = 'singleton' AND NOT (config #> '{fees,cancelBenchmark,tier1,etaMin}' IS NOT NULL);
UPDATE public.platform_config
SET config = jsonb_set(config, '{fees,cancelBenchmark,tier2,etaMin}', '25')
WHERE id = 'singleton' AND NOT (config #> '{fees,cancelBenchmark,tier2,etaMin}' IS NOT NULL);
UPDATE public.platform_config
SET config = jsonb_set(config, '{fees,cancelBenchmark,tier3,etaMin}', '20')
WHERE id = 'singleton' AND NOT (config #> '{fees,cancelBenchmark,tier3,etaMin}' IS NOT NULL);
