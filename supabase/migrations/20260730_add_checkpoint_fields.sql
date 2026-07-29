-- Add auto_confirm_at for 24h timeout auto-confirmation
ALTER TABLE public.milestone_schedules
  ADD COLUMN IF NOT EXISTS auto_confirm_at TIMESTAMPTZ;

-- Extend status CHECK constraint to include checkpoint flow statuses
ALTER TABLE public.milestone_schedules
  DROP CONSTRAINT IF EXISTS milestone_schedules_status_check;

ALTER TABLE public.milestone_schedules
  ADD CONSTRAINT milestone_schedules_status_check
  CHECK (status IN ('PENDING','HELD','SETTLED','DISPUTED','submitted','completed','skipped'));
