-- ============================================================
-- 20260723_fix_missing_ddl_and_rls.sql
-- Part 1: CREATE TABLE IF NOT EXISTS for demands & contracts
-- Part 2: Enable RLS for 6 missing tables
-- Part 3: RLS policies for demands & contracts
-- Part 4: Normalize profiles.role to lowercase 'admin'
-- ============================================================

-- ============================================================
-- Part 1: DDL — demands & contracts
-- ============================================================

CREATE TABLE IF NOT EXISTS public.demands (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  demander_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  budget NUMERIC(12, 2),
  status TEXT NOT NULL DEFAULT 'PENDING',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.contracts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  demand_id UUID REFERENCES public.demands(id) ON DELETE CASCADE,
  customer_id UUID REFERENCES auth.users(id),
  provider_id UUID REFERENCES auth.users(id),
  fund_status TEXT NOT NULL DEFAULT 'PENDING_HELD',
  amount NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.demands ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.contracts ENABLE ROW LEVEL SECURITY;

-- ============================================================
-- Part 2: Enable RLS for 6 tables that lack it
-- ============================================================

DO $$
DECLARE
  tbl TEXT;
BEGIN
  FOR tbl IN SELECT unnest(ARRAY[
    'category_configs', 'provider_qualifications', 'credit_events',
    'guarantee_links', 'precedents', 'bandit_stats'
  ]) LOOP
    EXECUTE format('ALTER TABLE IF EXISTS public.%I ENABLE ROW LEVEL SECURITY;', tbl);

    EXECUTE format('DROP POLICY IF EXISTS "Authenticated users can read %I" ON public.%I;', tbl, tbl);
    EXECUTE format('DROP POLICY IF EXISTS "Admin full access on %I" ON public.%I;', tbl, tbl);

    -- Policy 1: Authenticated read-only
    EXECUTE format(
      'CREATE POLICY "Authenticated users can read %I" ON public.%I FOR SELECT TO authenticated USING (true);',
      tbl, tbl
    );

    -- Policy 2: RBAC Admin full access (NOT email-based)
    EXECUTE format(
      'CREATE POLICY "Admin full access on %I" ON public.%I FOR ALL TO authenticated USING (
        EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = ''admin'')
      );',
      tbl, tbl
    );
  END LOOP;
END $$;

-- ============================================================
-- Part 3: RLS policies for demands & contracts
-- ============================================================

-- Demands RLS
DROP POLICY IF EXISTS "Users can view demands" ON public.demands;
CREATE POLICY "Users can view demands" ON public.demands
  FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "Demander can insert demand" ON public.demands;
CREATE POLICY "Demander can insert demand" ON public.demands
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = demander_id);

DROP POLICY IF EXISTS "Demander or Admin can update demand" ON public.demands;
CREATE POLICY "Demander or Admin can update demand" ON public.demands
  FOR UPDATE TO authenticated USING (
    auth.uid() = demander_id
    OR EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
  );

-- Contracts RLS
DROP POLICY IF EXISTS "Parties or Admin can view contract" ON public.contracts;
CREATE POLICY "Parties or Admin can view contract" ON public.contracts
  FOR SELECT TO authenticated USING (
    auth.uid() = customer_id
    OR auth.uid() = provider_id
    OR EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
  );

-- ============================================================
-- Part 4: Normalize profiles.role to lowercase 'admin'
-- ============================================================

UPDATE public.profiles SET role = 'admin' WHERE role = 'ADMIN';

ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS profiles_role_check;
ALTER TABLE public.profiles ADD CONSTRAINT profiles_role_check
  CHECK (role IN ('user', 'demander', 'provider', 'admin'));
