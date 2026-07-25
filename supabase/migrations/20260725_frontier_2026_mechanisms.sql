-- profiles add referrer_id for referral chain
ALTER TABLE IF EXISTS public.profiles
  ADD COLUMN IF NOT EXISTS referrer_id UUID REFERENCES public.profiles(id);

-- milestone_schedules table for multi-installment staged escrow
CREATE TABLE IF NOT EXISTS public.milestone_schedules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  contract_id UUID REFERENCES public.contracts(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  amount NUMERIC(12,2) NOT NULL,
  step_number INT NOT NULL DEFAULT 1,
  status TEXT NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING','HELD','SETTLED','DISPUTED')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.milestone_schedules ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Parties view milestones" ON public.milestone_schedules;
CREATE POLICY "Parties view milestones" ON public.milestone_schedules FOR ALL TO authenticated USING (true);
