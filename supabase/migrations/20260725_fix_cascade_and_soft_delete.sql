-- ============================================================
-- 20260725_fix_cascade_and_soft_delete.sql
-- P0-6: Add deleted_at for soft-delete on profiles & users
-- P0-7: Change CASCADE→RESTRICT on financial & evidence tables
-- ============================================================

-- ============================================================
-- Part 1: Add deleted_at to profiles & users
-- ============================================================
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_profiles_deleted_at ON public.profiles(deleted_at);
CREATE INDEX IF NOT EXISTS idx_users_deleted_at ON public.users(deleted_at);

-- ============================================================
-- Part 2: Add fund_status to orders for state machine tracking
-- ============================================================
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS fund_status TEXT
  DEFAULT 'PENDING_HELD'
  CHECK (fund_status IN ('PENDING_HELD','HELD','COMPLETED','SATISFACTION_HELD','SETTLED','DISPUTED','CANCELLED','REFUNDED'));

-- ============================================================
-- Part 3: Change financial/evidence CASCADE→RESTRICT
-- ============================================================

-- 3a. provider_wallets: CASCADE→RESTRICT
ALTER TABLE public.provider_wallets
  DROP CONSTRAINT IF EXISTS provider_wallets_provider_id_fkey,
  ADD CONSTRAINT provider_wallets_provider_id_fkey
    FOREIGN KEY (provider_id) REFERENCES public.profiles(id) ON DELETE RESTRICT;

-- 3b. wallet_logs: CASCADE→RESTRICT
ALTER TABLE public.wallet_logs
  DROP CONSTRAINT IF EXISTS wallet_logs_provider_id_fkey,
  ADD CONSTRAINT wallet_logs_provider_id_fkey
    FOREIGN KEY (provider_id) REFERENCES public.profiles(id) ON DELETE RESTRICT;

-- 3c. withdrawal_requests: CASCADE→RESTRICT
ALTER TABLE public.withdrawal_requests
  DROP CONSTRAINT IF EXISTS fk_withdrawals_provider,
  ADD CONSTRAINT fk_withdrawals_provider
    FOREIGN KEY (provider_id) REFERENCES public.profiles(id) ON DELETE RESTRICT;

-- 3d. notifications: CASCADE→RESTRICT
ALTER TABLE public.notifications
  DROP CONSTRAINT IF EXISTS fk_notifications_user,
  ADD CONSTRAINT fk_notifications_user
    FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE RESTRICT;

-- 3e. order_reviews (reviewer_id): CASCADE→RESTRICT
ALTER TABLE public.order_reviews
  DROP CONSTRAINT IF EXISTS fk_reviews_reviewer,
  ADD CONSTRAINT fk_reviews_reviewer
    FOREIGN KEY (reviewer_id) REFERENCES public.profiles(id) ON DELETE RESTRICT;

-- 3f. order_reviews (reviewee_id): CASCADE→RESTRICT
ALTER TABLE public.order_reviews
  DROP CONSTRAINT IF EXISTS fk_reviews_reviewee,
  ADD CONSTRAINT fk_reviews_reviewee
    FOREIGN KEY (reviewee_id) REFERENCES public.profiles(id) ON DELETE RESTRICT;

-- 3g. developer_profiles: CASCADE→RESTRICT
ALTER TABLE public.developer_profiles
  DROP CONSTRAINT IF EXISTS developer_profiles_id_fkey,
  ADD CONSTRAINT developer_profiles_id_fkey
    FOREIGN KEY (id) REFERENCES public.profiles(id) ON DELETE RESTRICT;

-- 3h. demands → auth.users: CASCADE→RESTRICT
ALTER TABLE public.demands
  DROP CONSTRAINT IF EXISTS demands_demander_id_fkey,
  ADD CONSTRAINT demands_demander_id_fkey
    FOREIGN KEY (demander_id) REFERENCES auth.users(id) ON DELETE RESTRICT;

-- 3i. contracts → demands: CASCADE→RESTRICT
ALTER TABLE public.contracts
  DROP CONSTRAINT IF EXISTS contracts_demand_id_fkey,
  ADD CONSTRAINT contracts_demand_id_fkey
    FOREIGN KEY (demand_id) REFERENCES public.demands(id) ON DELETE RESTRICT;

-- 3j. insurance_pool → contracts: CASCADE→RESTRICT
ALTER TABLE public.insurance_pool
  DROP CONSTRAINT IF EXISTS insurance_pool_contract_id_fkey,
  ADD CONSTRAINT insurance_pool_contract_id_fkey
    FOREIGN KEY (contract_id) REFERENCES public.contracts(id) ON DELETE RESTRICT;

-- ============================================================
-- Part 4: RLS policy for soft-delete — hide deleted profiles
-- ============================================================
DROP POLICY IF EXISTS "profiles_select_active" ON public.profiles;
CREATE POLICY "profiles_select_active" ON public.profiles
  FOR SELECT TO authenticated
  USING (deleted_at IS NULL OR id = auth.uid());
