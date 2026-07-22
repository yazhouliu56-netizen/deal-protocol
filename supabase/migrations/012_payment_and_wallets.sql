-- ============================================================
-- M12: 钱包 & 账期流水 — 钱流闭环核心
-- ============================================================

-- 1. provider_wallets 表
CREATE TABLE IF NOT EXISTS provider_wallets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  provider_id UUID UNIQUE NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  balance NUMERIC(12,2) NOT NULL DEFAULT 0.00 CHECK (balance >= 0),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- 2. wallet_logs 表
CREATE TABLE IF NOT EXISTS wallet_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  provider_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  amount NUMERIC(12,2) NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('payout','platform_fee','withdrawal')),
  order_id UUID REFERENCES demands(id),
  description TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_wallet_logs_provider ON wallet_logs(provider_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_wallet_logs_order ON wallet_logs(order_id);

-- 3. RLS
ALTER TABLE provider_wallets ENABLE ROW LEVEL SECURITY;
ALTER TABLE wallet_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Provider read own wallet" ON provider_wallets;
DROP POLICY IF EXISTS "Provider read own wallet" ON provider_wallets;
CREATE POLICY "Provider read own wallet" ON provider_wallets
  FOR SELECT USING (auth.uid() = provider_id);

DROP POLICY IF EXISTS "Admin full access wallets" ON provider_wallets;
DROP POLICY IF EXISTS "Admin full access wallets" ON provider_wallets;
CREATE POLICY "Admin full access wallets" ON provider_wallets
  FOR ALL USING (
    auth.jwt() ->> 'email' LIKE '%@admin.com'
  );

DROP POLICY IF EXISTS "Provider read own wallet logs" ON wallet_logs;
DROP POLICY IF EXISTS "Provider read own wallet logs" ON wallet_logs;
CREATE POLICY "Provider read own wallet logs" ON wallet_logs
  FOR SELECT USING (auth.uid() = provider_id);

DROP POLICY IF EXISTS "Admin full access wallet logs" ON wallet_logs;
DROP POLICY IF EXISTS "Admin full access wallet logs" ON wallet_logs;
CREATE POLICY "Admin full access wallet logs" ON wallet_logs
  FOR ALL USING (
    auth.jwt() ->> 'email' LIKE '%@admin.com'
  );

-- 4. 自动初始化钱包触发器
CREATE OR REPLACE FUNCTION init_provider_wallet()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.verification_status = 'approved' THEN
    INSERT INTO provider_wallets (provider_id, balance)
    VALUES (NEW.id, 0.00)
    ON CONFLICT (provider_id) DO NOTHING;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_init_provider_wallet ON profiles;
CREATE TRIGGER trg_init_provider_wallet
  AFTER INSERT OR UPDATE OF verification_status ON profiles
  FOR EACH ROW EXECUTE FUNCTION init_provider_wallet();
