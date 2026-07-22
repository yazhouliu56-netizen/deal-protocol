CREATE TABLE evidence_chain (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  contract_id UUID REFERENCES contracts(id) ON DELETE CASCADE,
  subject_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  reviewer_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  protocol_id TEXT,
  event_type TEXT,
  rating INTEGER,
  dimension_scores JSONB,
  comment TEXT,
  labels JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_evidence_chain_subject ON evidence_chain(subject_id);
CREATE INDEX idx_evidence_chain_contract ON evidence_chain(contract_id);

ALTER TABLE evidence_chain ENABLE ROW LEVEL SECURITY;

CREATE POLICY "evidence_chain_select" ON evidence_chain FOR SELECT USING (true);
CREATE POLICY "evidence_chain_insert" ON evidence_chain FOR INSERT WITH CHECK (true);

NOTIFY pgrst, 'reload schema';
