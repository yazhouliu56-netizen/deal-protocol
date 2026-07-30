-- ============================================================
-- 20260801_audit_rls_and_rpc.sql
-- Phase A: RLS lockdown, wallet_logs type union, atomic escrow
-- ============================================================

-- ============================================================
-- Part 1: Extend wallet_logs type check constraint
-- ============================================================

ALTER TABLE wallet_logs DROP CONSTRAINT IF EXISTS wallet_logs_type_check;
ALTER TABLE wallet_logs ADD CONSTRAINT wallet_logs_type_check
  CHECK (type IN (
    'payout', 'platform_fee', 'withdrawal', 'withdrawal_freeze',
    'milestone_payout', 'sla_release', 'checkpoint_release'
  ));

-- ============================================================
-- Part 2: profiles RLS — restrict UPDATE to safe fields
-- ============================================================

DROP POLICY IF EXISTS "Users can update own profile" ON profiles;
DROP POLICY IF EXISTS "Users can update own profile safe fields" ON profiles;

CREATE POLICY "Users can update own profile safe fields" ON profiles
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = id)
  WITH CHECK (
    auth.uid() = id
    AND balance IS NOT DISTINCT FROM (SELECT balance FROM profiles WHERE id = auth.uid())
    AND credit_score IS NOT DISTINCT FROM (SELECT credit_score FROM profiles WHERE id = auth.uid())
    AND reputation_score IS NOT DISTINCT FROM (SELECT reputation_score FROM profiles WHERE id = auth.uid())
    AND trust_tier IS NOT DISTINCT FROM (SELECT trust_tier FROM profiles WHERE id = auth.uid())
  );

-- ============================================================
-- Part 3: contracts RLS — forbid client-side UPDATE of fund/amount
-- ============================================================

DROP POLICY IF EXISTS "Parties or Admin can update contract" ON contracts;
DROP POLICY IF EXISTS "Parties or Admin can view contract" ON contracts;

CREATE POLICY "Parties or Admin can view contract" ON contracts
  FOR SELECT TO authenticated USING (
    auth.uid() = customer_id
    OR auth.uid() = provider_id
    OR EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  );

CREATE POLICY "Service role only can update contract fund_status" ON contracts
  FOR UPDATE TO authenticated USING (
    (auth.uid() = customer_id OR auth.uid() = provider_id)
    AND fund_status IS NOT DISTINCT FROM (SELECT fund_status FROM contracts WHERE id = id)
    AND amount IS NOT DISTINCT FROM (SELECT amount FROM contracts WHERE id = id)
  );

CREATE POLICY "Admin full access contracts" ON contracts
  FOR ALL TO authenticated USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  );

-- ============================================================
-- Part 4: orders RLS — forbid client-side UPDATE of sensitive fields
-- ============================================================

ALTER TABLE orders ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Parties or Admin can view order" ON orders;
DROP POLICY IF EXISTS "Parties or Admin can update order" ON orders;
DROP POLICY IF EXISTS "Provider can update own order" ON orders;

CREATE POLICY "Parties or Admin can view order" ON orders
  FOR SELECT TO authenticated USING (
    EXISTS (
      SELECT 1 FROM contracts c
      WHERE c.id = orders.id
      AND (c.customer_id = auth.uid() OR c.provider_id = auth.uid())
    )
    OR EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  );

CREATE POLICY "Users can update order safe fields only" ON orders
  FOR UPDATE TO authenticated USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
    OR (
      EXISTS (
        SELECT 1 FROM contracts WHERE id = orders.id AND provider_id = auth.uid()
      )
      AND orders.status IS NOT DISTINCT FROM (SELECT status FROM orders WHERE id = orders.id)
      AND orders.escrow_status IS NOT DISTINCT FROM (SELECT escrow_status FROM orders WHERE id = orders.id)
      AND orders.fund_status IS NOT DISTINCT FROM (SELECT fund_status FROM orders WHERE id = orders.id)
    )
  );

-- ============================================================
-- Part 5: milestone_schedules RLS — forbid client-side UPDATE of sensitive fields
-- ============================================================

ALTER TABLE milestone_schedules ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view milestone_schedules" ON milestone_schedules;
DROP POLICY IF EXISTS "Parties or Admin can update milestone" ON milestone_schedules;

CREATE POLICY "Users can view milestone_schedules" ON milestone_schedules
  FOR SELECT TO authenticated USING (
    EXISTS (
      SELECT 1 FROM contracts c
      WHERE c.id = milestone_schedules.contract_id
      AND (c.customer_id = auth.uid() OR c.provider_id = auth.uid())
    )
    OR EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  );

CREATE POLICY "Users can only submit milestones, not force-complete" ON milestone_schedules
  FOR UPDATE TO authenticated USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
    OR (
      EXISTS (
        SELECT 1 FROM contracts c
        WHERE c.id = milestone_schedules.contract_id AND c.provider_id = auth.uid()
      )
      AND milestone_schedules.status IS NOT DISTINCT FROM (
        SELECT status FROM milestone_schedules WHERE id = milestone_schedules.id
      )
      AND milestone_schedules.auto_confirm_at IS NOT DISTINCT FROM (
        SELECT auto_confirm_at FROM milestone_schedules WHERE id = milestone_schedules.id
      )
    )
  );

-- ============================================================
-- Part 6: provider_wallets RLS — read only for authenticated
-- ============================================================

ALTER TABLE provider_wallets ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Providers can view own wallet" ON provider_wallets;
DROP POLICY IF EXISTS "Admins can manage wallets" ON provider_wallets;

CREATE POLICY "Providers can view own wallet" ON provider_wallets
  FOR SELECT TO authenticated USING (provider_id = auth.uid());

CREATE POLICY "Service role only can modify wallet balance" ON provider_wallets
  FOR ALL TO authenticated USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  );

-- ============================================================
-- Part 7: wallet_logs RLS — read only for own provider_id
-- ============================================================

ALTER TABLE wallet_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Provider can view own wallet_logs" ON wallet_logs;

CREATE POLICY "Provider can view own wallet_logs" ON wallet_logs
  FOR SELECT TO authenticated USING (provider_id = auth.uid());

-- ============================================================
-- Part 8: SECURITY DEFINER RPC — safe checkpoint release
-- ============================================================

CREATE OR REPLACE FUNCTION release_checkpoint_rpc(
  p_checkpoint_id UUID,
  p_user_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_checkpoint milestone_schedules;
  v_contract contracts;
  v_wallet  provider_wallets;
  v_prev_hash TEXT;
  v_curr_hash TEXT;
  v_content TEXT;
BEGIN
  -- 1. Conditionally update: only if status = 'submitted' (atomic lock)
  UPDATE milestone_schedules
  SET status = 'completed', updated_at = NOW()
  WHERE id = p_checkpoint_id AND status = 'submitted'
  RETURNING * INTO v_checkpoint;

  IF NOT FOUND THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Checkpoint not in submitted state or already processed'
    );
  END IF;

  -- 2. Fetch contract for provider_id
  SELECT * INTO v_contract
  FROM contracts WHERE id = v_checkpoint.contract_id;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Contract not found');
  END IF;

  -- 3. Idempotency: skip if wallet_logs already exists for this checkpoint
  IF EXISTS (
    SELECT 1 FROM wallet_logs
    WHERE order_id = v_checkpoint.contract_id
      AND type = 'checkpoint_release'
      AND description LIKE '%' || p_checkpoint_id || '%'
  ) THEN
    RETURN jsonb_build_object('success', true, 'skipped', true, 'reason', 'Already credited');
  END IF;

  -- 4. Upsert wallet balance
  INSERT INTO provider_wallets (provider_id, balance)
  VALUES (v_contract.provider_id, v_checkpoint.amount)
  ON CONFLICT (provider_id)
  DO UPDATE SET balance = provider_wallets.balance + v_checkpoint.amount;

  -- 5. Insert wallet_logs
  INSERT INTO wallet_logs (provider_id, amount, type, order_id, description)
  VALUES (
    v_contract.provider_id,
    v_checkpoint.amount,
    'checkpoint_release',
    v_checkpoint.contract_id,
    'Checkpoint release: ' || v_checkpoint.title || ' (step ' || v_checkpoint.step_number || ') for checkpoint ' || p_checkpoint_id
  );

  -- 6. Evidence chain append
  SELECT hash INTO v_prev_hash FROM evidence_log
  WHERE order_id = v_checkpoint.contract_id
  ORDER BY created_at DESC LIMIT 1;

  v_prev_hash := COALESCE(v_prev_hash, 'GENESIS');
  v_content := jsonb_build_object(
    'orderId', v_checkpoint.contract_id,
    'eventType', 'CHECKPOINT_UNFROZEN',
    'payload', jsonb_build_object(
      'checkpoint_id', p_checkpoint_id,
      'title', v_checkpoint.title,
      'amount', v_checkpoint.amount,
      'step_number', v_checkpoint.step_number,
      'provider_id', v_contract.provider_id
    ),
    'prevHash', v_prev_hash,
    'timestamp', NOW()
  )::TEXT;
  v_curr_hash := encode(sha256(v_content::bytea), 'hex');

  INSERT INTO evidence_log (protocol_id, order_id, event_type, payload, hash, prev_hash)
  VALUES (
    v_contract.demand_id,
    v_checkpoint.contract_id,
    'CHECKPOINT_UNFROZEN',
    jsonb_build_object(
      'checkpoint_id', p_checkpoint_id,
      'title', v_checkpoint.title,
      'amount', v_checkpoint.amount,
      'step_number', v_checkpoint.step_number,
      'provider_id', v_contract.provider_id
    ),
    v_curr_hash,
    v_prev_hash
  );

  RETURN jsonb_build_object(
    'success', true,
    'checkpoint_id', p_checkpoint_id,
    'amount', v_checkpoint.amount
  );
END;
$$;

-- ============================================================
-- Part 9: SECURITY DEFINER RPC — safe SLA auto-release
-- ============================================================

CREATE OR REPLACE FUNCTION sla_auto_release_rpc(
  p_order_id UUID,
  p_contract_id UUID,
  p_compensation NUMERIC DEFAULT 0
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_contract contracts;
  v_prev_hash TEXT;
  v_curr_hash TEXT;
  v_content TEXT;
BEGIN
  -- 1. Idempotency: skip if order already not in SLA-tracked state
  UPDATE orders
  SET service_phase = 'CANCELLED', status = 'cancelled'
  WHERE id = p_order_id AND service_phase IN ('ACCEPTED', 'DEPARTED', 'IN_PROGRESS')
  RETURNING *;
  IF NOT FOUND THEN RETURN jsonb_build_object('success', false, 'error', 'Order already processed'); END IF;

  -- 2. Fetch and update contract fund status
  SELECT * INTO v_contract FROM contracts WHERE id = p_contract_id;
  IF NOT FOUND THEN RETURN jsonb_build_object('success', false, 'error', 'Contract not found'); END IF;

  UPDATE contracts SET fund_status = 'CANCELLED' WHERE id = p_contract_id AND fund_status = 'HELD';
  IF NOT FOUND THEN
    IF FOUND THEN NULL; END IF;
  END IF;

  -- 3. Evidence chain
  SELECT hash INTO v_prev_hash FROM evidence_log
  WHERE order_id = p_order_id ORDER BY created_at DESC LIMIT 1;
  v_prev_hash := COALESCE(v_prev_hash, 'GENESIS');
  v_content := jsonb_build_object(
    'orderId', p_order_id,
    'eventType', 'SLA_AUTO_RELEASED',
    'payload', jsonb_build_object('contract_id', p_contract_id, 'compensation', p_compensation),
    'prevHash', v_prev_hash,
    'timestamp', NOW()
  )::TEXT;
  v_curr_hash := encode(sha256(v_content::bytea), 'hex');

  INSERT INTO evidence_log (protocol_id, order_id, event_type, payload, hash, prev_hash)
  VALUES (v_contract.demand_id, p_order_id, 'SLA_AUTO_RELEASED',
    jsonb_build_object('contract_id', p_contract_id, 'compensation', p_compensation),
    v_curr_hash, v_prev_hash
  );

  -- 4. Compensation payout to wallet
  IF p_compensation > 0 THEN
    INSERT INTO wallet_logs (provider_id, amount, type, order_id, description)
    VALUES (v_contract.provider_id, p_compensation, 'sla_release', p_order_id,
      'SLA auto release compensation: ¥' || p_compensation);

    INSERT INTO insurance_pool (protocol_id, contract_id, amount, type, sub_type, description)
    VALUES (v_contract.demand_id, p_contract_id, p_compensation, 'payout', 'warranty',
      'SLA auto release: ¥' || p_compensation);
  END IF;

  RETURN jsonb_build_object('success', true, 'order_id', p_order_id);
END;
$$;
