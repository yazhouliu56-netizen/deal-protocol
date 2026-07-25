-- ============================================================
-- 20260725_world_class_mechanisms.sql
-- Adds DDL for priority tip, subtask milestone payout, and
-- notification-ladder schema support.
-- ============================================================

-- 1. Sub-task columns for team_requests
ALTER TABLE IF EXISTS public.team_requests
  ADD COLUMN IF NOT EXISTS sub_task_status TEXT
    DEFAULT 'PENDING'
    CHECK (sub_task_status IN ('PENDING','SETTLED','CANCELLED'));

ALTER TABLE IF EXISTS public.team_requests
  ADD COLUMN IF NOT EXISTS settled_amount NUMERIC(12,2);

-- 2. has_tip flag on protocols for 1.5x matcher priority
-- (stored in core_fields JSONB — no DDL change needed)

-- 3. Tip amount accumulator on contracts
ALTER TABLE IF EXISTS public.contracts
  ADD COLUMN IF NOT EXISTS tip_amount NUMERIC(12,2) DEFAULT 0.00;
