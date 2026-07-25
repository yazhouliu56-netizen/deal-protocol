-- ============================================================
-- 20260725: Provider deposit staking + withdrawal instant status
-- ============================================================

ALTER TABLE public.provider_wallets
  ADD COLUMN IF NOT EXISTS deposit_amount NUMERIC(12, 2) DEFAULT 0.00,
  ADD COLUMN IF NOT EXISTS is_staked BOOLEAN DEFAULT false;

ALTER TABLE public.withdrawal_requests DROP CONSTRAINT IF EXISTS chk_withdrawal_status;

ALTER TABLE public.withdrawal_requests ADD CONSTRAINT chk_withdrawal_status
  CHECK (status IN ('pending', 'approved', 'rejected', 'instant'));
