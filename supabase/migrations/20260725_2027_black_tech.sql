-- ============================================================
-- 20260725: 2027 AI-native Black Tech — agent gateway, vision
-- inspector, intent radar
-- ============================================================

-- 1. profiles: AI Agent flags
ALTER TABLE IF EXISTS public.profiles
  ADD COLUMN IF NOT EXISTS is_agent BOOLEAN DEFAULT false;

ALTER TABLE IF EXISTS public.profiles
  ADD COLUMN IF NOT EXISTS agent_webhook_url TEXT;

-- 2. contracts: AI vision quality score & predicted intent flag
ALTER TABLE IF EXISTS public.contracts
  ADD COLUMN IF NOT EXISTS vision_quality_score INT
    CHECK (vision_quality_score BETWEEN 0 AND 100);

ALTER TABLE IF EXISTS public.contracts
  ADD COLUMN IF NOT EXISTS is_predicted_intent BOOLEAN DEFAULT false;

-- 3. demands: AI vision quality score for photo-inspection
ALTER TABLE IF EXISTS public.demands
  ADD COLUMN IF NOT EXISTS vision_quality_score INT
    CHECK (vision_quality_score BETWEEN 0 AND 100);
