-- 20260918 P5b 发布费/定制费应收：demands 行记应收＋收费状态。
--
-- 用户裁决 2026-09-18：发布费 3 单/天免、超次 1 元/单并入该单支付、永不退；
-- 定制平台费 1 元/项并入支付；匹配失败（未支付）→ 应收作废，定制行 refunded。
-- 实收发生在 payment/create（escrow 支付）＋ notify 落账；publish_fee 永不退
-- （合同退款只退合同金额，天然排除）。
-- 幂等，可重复执行。

ALTER TABLE public.demands ADD COLUMN IF NOT EXISTS publish_fee_due NUMERIC(12, 2) NOT NULL DEFAULT 0;
ALTER TABLE public.demands ADD COLUMN IF NOT EXISTS custom_platform_due NUMERIC(12, 2) NOT NULL DEFAULT 0;
ALTER TABLE public.demands ADD COLUMN IF NOT EXISTS fee_status TEXT NOT NULL DEFAULT 'uncollected'
  CHECK (fee_status IN ('uncollected', 'paid', 'void'));
