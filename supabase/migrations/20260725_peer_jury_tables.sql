-- ============================================================
-- 20260725: Peer jury voting, onboarding flags, trust tier
-- ============================================================

-- 1. Add onboarding & trust_tier columns to profiles
ALTER TABLE IF EXISTS public.profiles
  ADD COLUMN IF NOT EXISTS onboarding_completed BOOLEAN DEFAULT false;

ALTER TABLE IF EXISTS public.profiles
  ADD COLUMN IF NOT EXISTS trust_tier INT DEFAULT 1
    CHECK (trust_tier BETWEEN 1 AND 5);

ALTER TABLE IF EXISTS public.profiles
  ADD COLUMN IF NOT EXISTS provider_stake_status TEXT DEFAULT 'none'
    CHECK (provider_stake_status IN ('none', 'staked', 'unstaking'));

-- 2. Community jury votes table
CREATE TABLE IF NOT EXISTS public.jury_votes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  dispute_id UUID REFERENCES public.order_disputes(id) ON DELETE CASCADE,
  juror_id UUID REFERENCES public.profiles(id),
  vote TEXT NOT NULL CHECK (vote IN ('demander', 'provider')),
  reason TEXT,
  reward_points INT DEFAULT 5,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(dispute_id, juror_id)
);

ALTER TABLE public.jury_votes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Authenticated users can read jury votes" ON public.jury_votes;
CREATE POLICY "Authenticated users can read jury votes" ON public.jury_votes
  FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "Authenticated users can insert jury votes" ON public.jury_votes;
CREATE POLICY "Authenticated users can insert jury votes" ON public.jury_votes
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = juror_id);

-- 3. Function: auto-update trust_tier based on credit base_score
CREATE OR REPLACE FUNCTION public.update_trust_tier()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  UPDATE public.profiles
  SET trust_tier =
    CASE
      WHEN NEW.base_score >= 900 THEN 5
      WHEN NEW.base_score >= 800 THEN 4
      WHEN NEW.base_score >= 700 THEN 3
      WHEN NEW.base_score >= 600 THEN 2
      ELSE 1
    END
  WHERE id = NEW.user_id;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_credit_update_trust_tier ON public.credit_records;
CREATE TRIGGER trg_credit_update_trust_tier
  AFTER INSERT OR UPDATE OF base_score ON public.credit_records
  FOR EACH ROW
  EXECUTE FUNCTION public.update_trust_tier();
