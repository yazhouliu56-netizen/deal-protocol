CREATE TABLE satisfaction_batches (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  provider_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'PENDING',
  count INTEGER NOT NULL DEFAULT 0,
  total_amount NUMERIC NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  released_at TIMESTAMPTZ
);

CREATE TABLE satisfaction_contracts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  batch_id UUID NOT NULL REFERENCES satisfaction_batches(id) ON DELETE CASCADE,
  contract_id UUID NOT NULL REFERENCES contracts(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX idx_satisfaction_contracts_unique ON satisfaction_contracts(batch_id, contract_id);
CREATE INDEX idx_satisfaction_batches_provider ON satisfaction_batches(provider_id, status);

ALTER TABLE satisfaction_batches ENABLE ROW LEVEL SECURITY;
ALTER TABLE satisfaction_contracts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "sb_select" ON satisfaction_batches FOR SELECT USING (true);
CREATE POLICY "sb_insert" ON satisfaction_batches FOR INSERT WITH CHECK (true);
CREATE POLICY "sb_update" ON satisfaction_batches FOR UPDATE USING (true);
CREATE POLICY "sc_select" ON satisfaction_contracts FOR SELECT USING (true);
CREATE POLICY "sc_insert" ON satisfaction_contracts FOR INSERT WITH CHECK (true);


ALTER TABLE contracts ADD COLUMN IF NOT EXISTS satisfaction_batch_id UUID REFERENCES satisfaction_batches(id) ON DELETE SET NULL;

NOTIFY pgrst, 'reload schema';
