-- Allow leader to see team requests they created
ALTER TABLE team_requests ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "team_requests_select_leader" ON team_requests;
CREATE POLICY "team_requests_select_leader" ON team_requests
  FOR SELECT USING (leader_id = auth.uid());

DROP POLICY IF EXISTS "team_requests_select_member" ON team_requests;
CREATE POLICY "team_requests_select_member" ON team_requests
  FOR SELECT USING (
    member_id = auth.uid() OR
    parent_protocol_id IN (
      SELECT id FROM protocols WHERE demander_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "team_requests_insert" ON team_requests;
CREATE POLICY "team_requests_insert" ON team_requests
  FOR INSERT WITH CHECK (leader_id = auth.uid());

-- Update protocols RLS to include contractor_self_funded visibility
DROP POLICY IF EXISTS "protocols_select" ON protocols;
DROP POLICY IF EXISTS "protocols_select" ON protocols;
CREATE POLICY "protocols_select" ON protocols
  FOR SELECT USING (
    demander_id = auth.uid() OR
    provider_id = auth.uid() OR
    (status = 'matching') OR
    (origin_type = 'contractor_self_funded' AND provider_id = auth.uid())
  );
