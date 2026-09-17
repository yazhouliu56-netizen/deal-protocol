-- 20260918 P0 费率配置中心扩展：佣金清零 + 新费率键合并 + 口径对齐。
--
-- 用户裁决 2026-09-18：上线政策"无平台费，只有通道费"。
-- commissionTiers 费率全改 0（可逆；引擎本身 P2 随 demands 放款路退役）。
-- satisfactionHold 0.1 → 0.15（与 Type1 方程对齐）。
-- 新增：commissionRate / channelRates / publishFee / cancelBenchmark /
--   qualityGuardrails / settlementShares / sunset。
-- 幂等，可重复执行（jsonb_set 逐键合并，不动既有 credit/rules/insurance）。

UPDATE public.platform_config
SET config = jsonb_set(config, '{fees,commissionTiers}',
  '[{"maxAmount":500,"rate":0},{"maxAmount":5000,"rate":0},{"maxAmount":50000,"rate":0},{"maxAmount":9007199254740991,"rate":0}]'::jsonb
)
WHERE id = 'singleton';

UPDATE public.platform_config
SET config = jsonb_set(config, '{fees,satisfactionHold}', '0.15')
WHERE id = 'singleton';

UPDATE public.platform_config
SET config = config
  || '{"fees": {}}'::jsonb
WHERE id = 'singleton' AND NOT (config ? 'fees');

UPDATE public.platform_config
SET config = jsonb_set(config, '{fees,commissionRate}', '0')
WHERE id = 'singleton' AND NOT (config #> '{fees,commissionRate}' IS NOT NULL);

UPDATE public.platform_config
SET config = jsonb_set(config, '{fees,channelRates}', '{"wechat":0.006,"alipay":0.006,"stripe":0.029}')
WHERE id = 'singleton' AND NOT (config #> '{fees,channelRates}' IS NOT NULL);

UPDATE public.platform_config
SET config = jsonb_set(config, '{fees,publishFee}', '{"freePerDay":3,"unitPrice":1}')
WHERE id = 'singleton' AND NOT (config #> '{fees,publishFee}' IS NOT NULL);

UPDATE public.platform_config
SET config = jsonb_set(config, '{fees,cancelBenchmark}',
  '{"tier1":{"twoWheel":35,"fourWheel":80},"tier2":{"twoWheel":30,"fourWheel":70},"tier3":{"twoWheel":25,"fourWheel":60}}')
WHERE id = 'singleton' AND NOT (config #> '{fees,cancelBenchmark}' IS NOT NULL);

UPDATE public.platform_config
SET config = jsonb_set(config, '{fees,qualityGuardrails}',
  '{"emotionMinPct":0.03,"emotionMaxPct":0.15,"singleItemMaxPct":0.5,"newDimFallback":5}')
WHERE id = 'singleton' AND NOT (config #> '{fees,qualityGuardrails}' IS NOT NULL);

UPDATE public.platform_config
SET config = jsonb_set(config, '{fees,settlementShares}',
  '[{"key":"base","pct":85},{"key":"attitude","pct":5},{"key":"appearance","pct":5},{"key":"restoration","pct":5}]')
WHERE id = 'singleton' AND NOT (config #> '{fees,settlementShares}' IS NOT NULL);

UPDATE public.platform_config
SET config = jsonb_set(config, '{fees,sunset}',
  '{"netCompletedTrigger":10000,"targetCommissionRate":0.05,"announcedAt":null,"status":"pending"}')
WHERE id = 'singleton' AND NOT (config #> '{fees,sunset}' IS NOT NULL);
