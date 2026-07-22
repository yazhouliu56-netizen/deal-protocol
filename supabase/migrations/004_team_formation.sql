-- ============================================================
-- M14: Team Formation — Contractor Self-Funded Model
-- ============================================================
-- Prerequisites: 001_schema.sql (protocols + category_configs with
--   origin_type and team_formation_enabled fields already exist)

CREATE TABLE IF NOT EXISTS team_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  parent_protocol_id UUID REFERENCES protocols(id) NOT NULL,
  leader_id UUID REFERENCES users(id) NOT NULL,
  role_desc TEXT NOT NULL,
  required_skills TEXT[] DEFAULT '{}',
  reward NUMERIC(10,2) NOT NULL,
  status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open','filled','cancelled')),
  member_id UUID REFERENCES users(id),
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_team_requests_protocol ON team_requests(parent_protocol_id);
CREATE INDEX IF NOT EXISTS idx_team_requests_leader ON team_requests(leader_id);
CREATE INDEX IF NOT EXISTS idx_team_requests_status ON team_requests(status);

ALTER TABLE team_requests ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "team_requests_select" ON team_requests;
CREATE POLICY "team_requests_select" ON team_requests
  FOR SELECT USING (true);

DROP POLICY IF EXISTS "team_requests_insert" ON team_requests;
CREATE POLICY "team_requests_insert" ON team_requests
  FOR INSERT WITH CHECK (auth.uid() = leader_id);

DROP POLICY IF EXISTS "team_requests_update" ON team_requests;
CREATE POLICY "team_requests_update" ON team_requests
  FOR UPDATE USING (auth.uid() = leader_id);
