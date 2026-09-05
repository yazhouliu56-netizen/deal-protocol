-- 20260906: P0-03 商业化底座 — platform_config 建表 + wallet_logs 类型补齐。
--
-- 背景：getConfig()/updateConfig（src/lib/platform/config.ts）读写
-- public.platform_config 单行，但该表从未建过 → /api/admin/config
-- 读写 100% 500，checkCancelPenalty 上线即抛。wallet_logs CHECK
-- 遗漏 split_instruction，与 payment/release 留痕冲突。
-- 幂等，可重复执行。

CREATE TABLE IF NOT EXISTS public.platform_config (
  id TEXT PRIMARY KEY,
  config JSONB NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- 默认种子：与 getDefaultConfig() 同构（阶梯 15%/12%/10%/8%）。
INSERT INTO public.platform_config (id, config)
VALUES (
  'singleton',
  '{
    "fees": {
      "commissionTiers": [
        { "maxAmount": 500, "rate": 0.15 },
        { "maxAmount": 5000, "rate": 0.12 },
        { "maxAmount": 50000, "rate": 0.10 },
        { "maxAmount": 9007199254740991, "rate": 0.08 }
      ],
      "satisfactionHold": 0.1
    },
    "credit": {
      "levels": [
        { "minScore": 900, "label": "TIER_900", "benefits": [] },
        { "minScore": 750, "label": "TIER_750", "benefits": [] },
        { "minScore": 600, "label": "TIER_600", "benefits": [] },
        { "minScore": 300, "label": "TIER_300", "benefits": [] },
        { "minScore": 0, "label": "TIER_0", "benefits": [] }
      ]
    },
    "rules": {
      "cancelThreshold": 3,
      "cancelPenaltyCount": 5,
      "cancelPenaltyCredit": 100,
      "cancelPenaltyDays": 7
    },
    "insurance": {
      "ratePerOrder": 0.01,
      "poolAllocation": { "warranty": 0.4, "customer": 0.3, "provider": 0.2, "sos": 0.1 }
    }
  }'::jsonb
)
ON CONFLICT (id) DO NOTHING;

ALTER TABLE public.platform_config ENABLE ROW LEVEL SECURITY;

-- wallet_logs：补齐 split_instruction（payment/release 合规分账留痕所需）。
ALTER TABLE public.wallet_logs DROP CONSTRAINT IF EXISTS wallet_logs_type_check;
ALTER TABLE public.wallet_logs ADD CONSTRAINT wallet_logs_type_check
  CHECK (type IN (
    'payout', 'platform_fee', 'withdrawal', 'withdrawal_freeze',
    'split_instruction',
    'MILESTONE_PAYOUT', 'SLA_RELEASE', 'CHECKPOINT_RELEASE',
    'milestone_payout', 'sla_release', 'checkpoint_release'
  ));
