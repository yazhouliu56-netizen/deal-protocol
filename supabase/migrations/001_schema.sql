-- ============================================================
-- M01: 数据库核心 Schema — 所有模块的数据契约
-- ============================================================
-- 执行方式：在 Supabase SQL Editor 中运行
-- 注意：必须先启用 pgvector 和 PostGIS 扩展

-- 启用扩展
CREATE EXTENSION IF NOT EXISTS vector;
CREATE EXTENSION IF NOT EXISTS postgis;

-- ==================== 用户表 ====================
CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  phone TEXT UNIQUE NOT NULL,
  nickname TEXT,
  avatar_url TEXT,
  role TEXT NOT NULL CHECK (role IN ('demander','provider','both')),
  identity_verified BOOLEAN DEFAULT FALSE,
  current_location GEOGRAPHY(POINT),
  created_at TIMESTAMPTZ DEFAULT now()
);

-- ==================== 品类配置表 ====================
CREATE TABLE IF NOT EXISTS category_configs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  category TEXT UNIQUE NOT NULL,
  risk_tier TEXT NOT NULL CHECK (risk_tier IN ('low','medium','high')),
  schema_json JSONB NOT NULL,
  entry_requirements JSONB,
  response_mode TEXT NOT NULL CHECK (response_mode IN ('grab_first','interest_list','agency_dispatch')),
  safety_requirements JSONB,
  team_formation_enabled BOOLEAN DEFAULT FALSE,
  enabled BOOLEAN DEFAULT FALSE,
  version INT DEFAULT 1,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- ==================== 协议表 ====================
CREATE TABLE IF NOT EXISTS protocols (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  demander_id UUID REFERENCES users(id),
  provider_id UUID REFERENCES users(id),
  category TEXT NOT NULL,
  core_fields JSONB NOT NULL,
  category_fields JSONB NOT NULL,
  embedding VECTOR(1024),
  location GEOGRAPHY(POINT),
  response_mode TEXT NOT NULL,
  risk_tier TEXT NOT NULL,
  funding_mode TEXT DEFAULT 'full_prepay',
  origin_type TEXT DEFAULT 'platform_client' CHECK (origin_type IN ('platform_client','contractor_self_funded')),
  status TEXT DEFAULT 'draft' CHECK (status IN (
    'draft','pending_confirm','pending_held','matching','matched',
    'completed','disputed','cancelled','satisfaction_held','settled'
  )),
  final_price NUMERIC(10,2),
  created_at TIMESTAMPTZ DEFAULT now()
);

-- ==================== 用户资质表 ====================
CREATE TABLE IF NOT EXISTS provider_qualifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id),
  category TEXT NOT NULL,
  qualification_type TEXT NOT NULL,
  qualification_ref TEXT,
  verified BOOLEAN DEFAULT FALSE,
  expires_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(user_id, category, qualification_type)
);

-- ==================== 服务者技能/品类关联表 ====================
CREATE TABLE IF NOT EXISTS provider_categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id),
  category TEXT NOT NULL,
  skills TEXT[] DEFAULT '{}',
  is_online BOOLEAN DEFAULT FALSE,
  current_location GEOGRAPHY(POINT),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(user_id, category)
);

-- ==================== 双层信用表 ====================
CREATE TABLE IF NOT EXISTS credit_records (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) NOT NULL,
  -- 平台级基础信用（跨品类共享）
  base_score NUMERIC(5,2) DEFAULT 60,
  base_verified_status TEXT DEFAULT 'pending',
  base_fulfillment_rate NUMERIC(5,2),
  base_violation_count INT DEFAULT 0,
  base_total_deals INT DEFAULT 0,
  -- 品类内声誉（独立积累）
  category TEXT,
  category_score NUMERIC(5,2),
  category_order_count INT DEFAULT 0,
  category_repurchase_rate NUMERIC(5,2),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(user_id, category),
  -- 约束：base_score 在 0-100 之间
  CONSTRAINT valid_base_score CHECK (base_score >= 0 AND base_score <= 100)
);

-- ==================== 订单/交易表 ====================
CREATE TABLE IF NOT EXISTS orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  protocol_id UUID REFERENCES protocols(id),
  provider_id UUID REFERENCES users(id),
  status TEXT DEFAULT 'grabbed' CHECK (status IN
    ('grabbed','confirmed','in_progress','completed','disputed','cancelled')),
  service_phase TEXT DEFAULT 'NOT_ACCEPTED' CHECK (service_phase IN
    ('NOT_ACCEPTED','ACCEPTED','DEPARTED','ARRIVED','IN_PROGRESS','DONE')),
  amount NUMERIC(10,2),
  escrow_status TEXT DEFAULT 'pending' CHECK (escrow_status IN
    ('pending','held','released','refunded','disputed')),
  platform_fee NUMERIC(10,2),
  provider_income NUMERIC(10,2),
  satisfaction_hold NUMERIC(10,2),
  created_at TIMESTAMPTZ DEFAULT now()
);

-- ==================== 证据链表（append-only） ====================
CREATE TABLE IF NOT EXISTS evidence_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  protocol_id UUID REFERENCES protocols(id),
  order_id UUID REFERENCES orders(id),
  event_type TEXT NOT NULL,
  payload JSONB NOT NULL,
  payload_ref TEXT,
  captured_by UUID REFERENCES users(id),
  -- 哈希链
  hash TEXT,
  prev_hash TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- ==================== 信用变动追溯表 ====================
CREATE TABLE IF NOT EXISTS credit_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) NOT NULL,
  dimension TEXT NOT NULL CHECK (dimension IN
    ('integrity','capability','reliability','communication','safety','contribution','category_reputation')),
  category TEXT,
  previous_score NUMERIC(5,2),
  new_score NUMERIC(5,2),
  delta NUMERIC(5,2) NOT NULL,
  reason TEXT NOT NULL,
  evidence_id UUID REFERENCES evidence_log(id),
  triggered_by TEXT NOT NULL CHECK (triggered_by IN
    ('system','arbitration','auto_settle','admin')),
  protocol_id UUID REFERENCES protocols(id),
  created_at TIMESTAMPTZ DEFAULT now()
);

-- ==================== 担保网络表 ====================
CREATE TABLE IF NOT EXISTS guarantee_links (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  guarantor_id UUID REFERENCES users(id) NOT NULL,
  guaranteed_id UUID REFERENCES users(id) NOT NULL,
  guarantee_type TEXT NOT NULL CHECK (guarantee_type IN ('identity','skill','financial')),
  stake_amount NUMERIC(10,2) DEFAULT 0,
  max_liability NUMERIC(10,2),
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN
    ('pending','active','triggered','expired','revoked')),
  expires_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- ==================== 判例库表 ====================
CREATE TABLE IF NOT EXISTS precedents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  summary TEXT NOT NULL,
  key_factors JSONB NOT NULL,
  ruling_principle TEXT NOT NULL,
  embedding VECTOR(1536),
  binding BOOLEAN DEFAULT TRUE,
  arbitration_case_id UUID,
  created_by UUID REFERENCES users(id),
  created_at TIMESTAMPTZ DEFAULT now()
);

-- ==================== Bandit 调度统计表 ====================
CREATE TABLE IF NOT EXISTS bandit_stats (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  provider_id UUID REFERENCES users(id),
  category TEXT,
  impressions INT DEFAULT 0,
  clicks INT DEFAULT 0,
  conversions INT DEFAULT 0,
  reward_sum NUMERIC(10,2) DEFAULT 0,
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(provider_id, category)
);

-- ==================== 关键索引 ====================
CREATE INDEX IF NOT EXISTS idx_providers_location ON provider_categories USING GIST(current_location);
CREATE INDEX IF NOT EXISTS idx_protocols_location ON protocols USING GIST(location);
CREATE INDEX IF NOT EXISTS idx_protocols_embedding ON protocols USING ivfflat(embedding vector_cosine_ops);
CREATE INDEX IF NOT EXISTS idx_provider_category ON provider_categories(category);
CREATE INDEX IF NOT EXISTS idx_evidence_log_protocol ON evidence_log(protocol_id);
CREATE INDEX IF NOT EXISTS idx_credit_events_user ON credit_events(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_guarantee_links_guarantor ON guarantee_links(guarantor_id, status);
CREATE INDEX IF NOT EXISTS idx_guarantee_links_guaranteed ON guarantee_links(guaranteed_id, status);
CREATE INDEX IF NOT EXISTS idx_precedents_embedding ON precedents USING ivfflat(embedding vector_cosine_ops);
CREATE INDEX IF NOT EXISTS idx_bandit_stats_provider ON bandit_stats(provider_id, category);

-- ==================== Bandit 权限隔离 ====================
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'bandit_reader') THEN
    CREATE ROLE bandit_reader;
  END IF;
END
$$;
REVOKE ALL ON credit_records FROM bandit_reader;
REVOKE ALL ON credit_events FROM bandit_reader;
GRANT SELECT ON orders, protocols, bandit_stats TO bandit_reader;

-- ==================== RLS 行级安全 ====================
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE protocols ENABLE ROW LEVEL SECURITY;
ALTER TABLE orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE credit_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE evidence_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE provider_categories ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  DROP POLICY IF EXISTS "users_view_self" ON users;
  CREATE POLICY "users_view_self" ON users
    FOR SELECT USING (id = auth.uid());
END $$;

DO $$
BEGIN
  DROP POLICY IF EXISTS "protocols_select" ON protocols;
  CREATE POLICY "protocols_select" ON protocols
    FOR SELECT USING (
      demander_id = auth.uid() OR
      provider_id = auth.uid() OR
      (status = 'matching')
    );
END $$;

DO $$
BEGIN
  DROP POLICY IF EXISTS "credit_records_select" ON credit_records;
  CREATE POLICY "credit_records_select" ON credit_records
    FOR SELECT USING (
      user_id = auth.uid() OR
      auth.uid() IN (SELECT id FROM users WHERE role = 'admin')
    );
END $$;

DO $$
BEGIN
  DROP POLICY IF EXISTS "credit_records_no_insert" ON credit_records;
  CREATE POLICY "credit_records_no_insert" ON credit_records
    FOR INSERT WITH CHECK (false);
END $$;

DO $$
BEGIN
  DROP POLICY IF EXISTS "credit_records_no_update" ON credit_records;
  CREATE POLICY "credit_records_no_update" ON credit_records
    FOR UPDATE USING (false);
END $$;

DO $$
BEGIN
  DROP POLICY IF EXISTS "evidence_log_insert" ON evidence_log;
  CREATE POLICY "evidence_log_insert" ON evidence_log
    FOR INSERT WITH CHECK (true);
END $$;

DO $$
BEGIN
  DROP POLICY IF EXISTS "evidence_log_select" ON evidence_log;
  CREATE POLICY "evidence_log_select" ON evidence_log
    FOR SELECT USING (true);
END $$;

DO $$
BEGIN
  DROP POLICY IF EXISTS "evidence_log_no_update" ON evidence_log;
  CREATE POLICY "evidence_log_no_update" ON evidence_log
    FOR UPDATE USING (false);
END $$;

DO $$
BEGIN
  DROP POLICY IF EXISTS "evidence_log_no_delete" ON evidence_log;
  CREATE POLICY "evidence_log_no_delete" ON evidence_log
    FOR DELETE USING (false);
END $$;
