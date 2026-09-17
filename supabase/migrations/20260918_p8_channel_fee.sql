-- 20260918 P8 通道费落地：提现银行卡固定费并入配置。
-- 幂等，可重复执行。
UPDATE public.platform_config
SET config = jsonb_set(config, '{fees,withdrawBankFlat}', '2')
WHERE id = 'singleton' AND NOT (config #> '{fees,withdrawBankFlat}' IS NOT NULL);
