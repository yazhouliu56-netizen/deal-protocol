-- P0-04: 保险池 — 每单 1% 计提，用于质保、客户险、师傅险、SOS
-- 实现《设计方案.md》§12.9

CREATE TABLE IF NOT EXISTS public.insurance_pool (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  contract_id UUID REFERENCES public.contracts(id) ON DELETE CASCADE,
  protocol_id UUID REFERENCES public.protocols(id) ON DELETE SET NULL,
  amount NUMERIC(12, 2) NOT NULL,
  type TEXT NOT NULL DEFAULT 'provision',  -- 'provision' (计提), 'claim' (理赔), 'payout' (垫付)
  sub_type TEXT,                            -- 'warranty' / 'customer_insurance' / 'provider_insurance' / 'sos'
  description TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.insurance_pool ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admin full access insurance_pool" ON public.insurance_pool;
CREATE POLICY "Admin full access insurance_pool"
  ON public.insurance_pool
  FOR ALL
  TO authenticated
  USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
  );
