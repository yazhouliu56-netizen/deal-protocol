-- ============================================================
-- 20260724_admin_tasks.sql
-- P1-03: 空候选池人工指派降级机制 (§4.3)
-- ============================================================

CREATE TABLE IF NOT EXISTS public.admin_tasks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  protocol_id UUID REFERENCES public.protocols(id),
  type TEXT NOT NULL,  -- 'manual_assignment', 'dispute_review', etc.
  status TEXT NOT NULL DEFAULT 'PENDING',
  payload JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.admin_tasks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin full access tasks" ON public.admin_tasks
  FOR ALL TO authenticated
  USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
  );
