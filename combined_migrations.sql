-- ==========================================
-- DEAL PROTOCOL COMBINED MIGRATIONS
-- ==========================================


-- ------------------------------------------
-- FILE: supabase/migrations/001_schema.sql
-- ------------------------------------------
-- ============================================================
-- M01: 数据库核心 Schema — 所有模块的数据契约
-- ============================================================
-- 执行方式：在 Supabase SQL Editor 中运行
-- 注意：必须先启用 pgvector 和 PostGIS 扩展

-- 启用扩展
CREATE EXTENSION IF NOT EXISTS vector;
CREATE EXTENSION IF NOT EXISTS postgis;

-- ==================== 用户表 ====================
CREATE TABLE users (
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
CREATE TABLE category_configs (
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
CREATE TABLE protocols (
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
CREATE TABLE provider_qualifications (
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
CREATE TABLE provider_categories (
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
CREATE TABLE credit_records (
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
CREATE TABLE orders (
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
CREATE TABLE evidence_log (
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
CREATE TABLE credit_events (
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
CREATE TABLE guarantee_links (
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
CREATE TABLE precedents (
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
CREATE TABLE bandit_stats (
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
CREATE INDEX idx_providers_location ON provider_categories USING GIST(current_location);
CREATE INDEX idx_protocols_location ON protocols USING GIST(location);
CREATE INDEX idx_protocols_embedding ON protocols USING ivfflat(embedding vector_cosine_ops);
CREATE INDEX idx_provider_category ON provider_categories(category);
CREATE INDEX idx_evidence_log_protocol ON evidence_log(protocol_id);
CREATE INDEX idx_credit_events_user ON credit_events(user_id, created_at DESC);
CREATE INDEX idx_guarantee_links_guarantor ON guarantee_links(guarantor_id, status);
CREATE INDEX idx_guarantee_links_guaranteed ON guarantee_links(guaranteed_id, status);
CREATE INDEX idx_precedents_embedding ON precedents USING ivfflat(embedding vector_cosine_ops);
CREATE INDEX idx_bandit_stats_provider ON bandit_stats(provider_id, category);

-- ==================== Bandit 权限隔离 ====================
CREATE ROLE bandit_reader;
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

-- 用户只能看自己的数据
CREATE POLICY "users_view_self" ON users
  FOR SELECT USING (id = auth.uid());

-- 用户只能查自己发起的协议，服务者只能查派给自己或 matching 的协议
CREATE POLICY "protocols_select" ON protocols
  FOR SELECT USING (
    demander_id = auth.uid() OR
    provider_id = auth.uid() OR
    (status = 'matching')
  );

-- 信用记录仅本人与平台管理员可读
CREATE POLICY "credit_records_select" ON credit_records
  FOR SELECT USING (
    user_id = auth.uid() OR
    auth.uid() IN (SELECT id FROM users WHERE role = 'admin')
  );

-- 任何人不可直接写入 credit_records（只能通过系统事件触发）
CREATE POLICY "credit_records_no_insert" ON credit_records
  FOR INSERT WITH CHECK (false);

CREATE POLICY "credit_records_no_update" ON credit_records
  FOR UPDATE USING (false);

-- evidence_log 只追加不可改删
CREATE POLICY "evidence_log_insert" ON evidence_log
  FOR INSERT WITH CHECK (true);

CREATE POLICY "evidence_log_select" ON evidence_log
  FOR SELECT USING (true);

-- 禁止 UPDATE/DELETE
CREATE POLICY "evidence_log_no_update" ON evidence_log
  FOR UPDATE USING (false);

CREATE POLICY "evidence_log_no_delete" ON evidence_log
  FOR DELETE USING (false);


-- ------------------------------------------
-- FILE: supabase/migrations/002_create_user_fn.sql
-- ------------------------------------------
-- Function to create user bypassing rate limits (SECURITY DEFINER)
-- Run this in Supabase SQL Editor once.
-- Grant execute to anon so the register API can call it.
CREATE OR REPLACE FUNCTION create_user_direct(
  p_email TEXT,
  p_password TEXT,
  p_name TEXT,
  p_phone TEXT DEFAULT NULL,
  p_roles JSONB DEFAULT '["CUSTOMER"]'
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id UUID;
  v_role TEXT;
  v_encrypted_pw TEXT;
  v_result JSON;
BEGIN
  -- Check existing
  IF EXISTS (SELECT 1 FROM auth.users WHERE email = p_email) THEN
    RETURN json_build_object('error', 'Email already registered');
  END IF;

  -- Encrypt password using Supabase's built-in cryp function
  v_encrypted_pw := crypt(p_password, gen_salt('bf', 10));

  -- Create user in auth schema
  v_user_id := gen_random_uuid();
  v_role := p_roles->>0;

  INSERT INTO auth.users (
    id, instance_id, aud, role, email,
    encrypted_password, email_confirmed_at,
    confirmation_sent_at, confirmation_token,
    recovery_token, raw_app_meta_data,
    created_at, updated_at, last_sign_in_at,
    is_sso_user, deleted_at
  ) VALUES (
    v_user_id, '00000000-0000-0000-0000-000000000000',
    'authenticated', 'authenticated', p_email,
    v_encrypted_pw, now(), now(),
    encode(gen_random_bytes(32), 'hex'),
    encode(gen_random_bytes(32), 'hex'),
    jsonb_build_object(
      'provider', 'email',
      'providers', ARRAY['email'],
      'name', p_name,
      'phone', p_phone,
      'role', v_role,
      'roles', p_roles::text,
      'email_verified', true
    ),
    now(), now(), now(),
    false, null
  );

  -- Create identity record for the user
  INSERT INTO auth.identities (
    id, user_id, identity_data, provider, provider_id,
    last_sign_in_at, created_at, updated_at
  ) VALUES (
    v_user_id, v_user_id,
    jsonb_build_object(
      'sub', v_user_id,
      'email', p_email,
      'name', p_name
    ),
    'email', p_email,
    now(), now(), now()
  );

  -- Insert profile
  INSERT INTO public.profiles (
    id, name, email, phone, role, roles, balance, credit_score, created_at
  ) VALUES (
    v_user_id, p_name, p_email, p_phone, v_role,
    p_roles::text, 0, 100, now()
  )
  ON CONFLICT (id) DO UPDATE SET
    name = EXCLUDED.name,
    email = EXCLUDED.email,
    phone = EXCLUDED.phone,
    role = EXCLUDED.role,
    roles = EXCLUDED.roles;

  v_result := json_build_object(
    'id', v_user_id,
    'name', p_name,
    'email', p_email,
    'role', v_role,
    'roles', p_roles
  );

  RETURN v_result;
END;
$$;

-- Grant execute to anon role so the register API can use it
GRANT EXECUTE ON FUNCTION create_user_direct TO anon;
GRANT EXECUTE ON FUNCTION create_user_direct TO authenticated;

-- Rate-limit bypass: register API can call this RPC when signUp() is rate-limited


-- ------------------------------------------
-- FILE: supabase/migrations/003_credit_dimensions.sql
-- ------------------------------------------
ALTER TABLE credit_records
  ADD COLUMN IF NOT EXISTS integrity_score NUMERIC(5,2) DEFAULT 60,
  ADD COLUMN IF NOT EXISTS capability_score NUMERIC(5,2) DEFAULT 60,
  ADD COLUMN IF NOT EXISTS reliability_score NUMERIC(5,2) DEFAULT 60,
  ADD COLUMN IF NOT EXISTS communication_score NUMERIC(5,2) DEFAULT 60,
  ADD COLUMN IF NOT EXISTS safety_score NUMERIC(5,2) DEFAULT 60,
  ADD COLUMN IF NOT EXISTS contribution_score NUMERIC(5,2) DEFAULT 60;


-- ------------------------------------------
-- FILE: supabase/migrations/004_team_formation.sql
-- ------------------------------------------
-- ============================================================
-- M14: Team Formation — Contractor Self-Funded Model
-- ============================================================
-- Prerequisites: 001_schema.sql (protocols + category_configs with
--   origin_type and team_formation_enabled fields already exist)

CREATE TABLE team_requests (
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

CREATE INDEX idx_team_requests_protocol ON team_requests(parent_protocol_id);
CREATE INDEX idx_team_requests_leader ON team_requests(leader_id);
CREATE INDEX idx_team_requests_status ON team_requests(status);

ALTER TABLE team_requests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "team_requests_select" ON team_requests
  FOR SELECT USING (true);

CREATE POLICY "team_requests_insert" ON team_requests
  FOR INSERT WITH CHECK (auth.uid() = leader_id);

CREATE POLICY "team_requests_update" ON team_requests
  FOR UPDATE USING (auth.uid() = leader_id);


-- ------------------------------------------
-- FILE: supabase/migrations/005_match_providers_nearby.sql
-- ------------------------------------------
CREATE OR REPLACE FUNCTION match_providers_nearby(
  ref_lng DOUBLE PRECISION,
  ref_lat DOUBLE PRECISION,
  radius_m DOUBLE PRECISION,
  target_category TEXT,
  max_results INT DEFAULT 200
)
RETURNS TABLE(
  user_id UUID,
  skills TEXT[],
  is_online BOOLEAN,
  distance_m DOUBLE PRECISION
)
LANGUAGE SQL STABLE
AS $$
  SELECT
    pc.user_id,
    pc.skills,
    pc.is_online,
    ST_Distance(pc.current_location, ST_SetSRID(ST_MakePoint(ref_lng, ref_lat), 4326)::geography) AS distance_m
  FROM provider_categories pc
  WHERE pc.category = target_category
    AND pc.is_online = true
    AND pc.current_location IS NOT NULL
    AND ST_DWithin(pc.current_location, ST_SetSRID(ST_MakePoint(ref_lng, ref_lat), 4326)::geography, radius_m)
  ORDER BY distance_m ASC
  LIMIT max_results;
$$;


-- ------------------------------------------
-- FILE: supabase/migrations/006_add_rejected_status.sql
-- ------------------------------------------
ALTER TABLE protocols DROP CONSTRAINT IF EXISTS protocols_status_check;
ALTER TABLE protocols ADD CONSTRAINT protocols_status_check
  CHECK (status IN (
    'draft','pending_confirm','pending_held','matching','matched',
    'completed','disputed','cancelled','satisfaction_held','settled','rejected'
  ));


-- ------------------------------------------
-- FILE: supabase/migrations/007_rls_team_visibility.sql
-- ------------------------------------------
-- Allow leader to see team requests they created
ALTER TABLE team_requests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "team_requests_select_leader" ON team_requests
  FOR SELECT USING (leader_id = auth.uid());

CREATE POLICY "team_requests_select_member" ON team_requests
  FOR SELECT USING (
    member_id = auth.uid() OR
    parent_protocol_id IN (
      SELECT id FROM protocols WHERE demander_id = auth.uid()
    )
  );

CREATE POLICY "team_requests_insert" ON team_requests
  FOR INSERT WITH CHECK (leader_id = auth.uid());

-- Update protocols RLS to include contractor_self_funded visibility
DROP POLICY IF EXISTS "protocols_select" ON protocols;
CREATE POLICY "protocols_select" ON protocols
  FOR SELECT USING (
    demander_id = auth.uid() OR
    provider_id = auth.uid() OR
    (status = 'matching') OR
    (origin_type = 'contractor_self_funded' AND provider_id = auth.uid())
  );


-- ------------------------------------------
-- FILE: supabase/migrations/008_protocol_meta.sql
-- ------------------------------------------
-- M03: Protocol meta-structure for category_configs
-- Exec after 001_schema.sql / seed_categories.sql
-- Adds JSONB protocol_meta to category_configs for formal meta-definition

ALTER TABLE category_configs ADD COLUMN IF NOT EXISTS protocol_meta JSONB DEFAULT '{}'::jsonb;

ALTER TABLE protocols ADD COLUMN IF NOT EXISTS funding_mode TEXT DEFAULT 'full_prepay';


-- ------------------------------------------
-- FILE: supabase/migrations/009_pricing_configs.sql
-- ------------------------------------------
-- M03: 定价配置表
CREATE TABLE IF NOT EXISTS pricing_configs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  category TEXT UNIQUE NOT NULL REFERENCES category_configs(category),
  default_work_hours NUMERIC(5,2) DEFAULT 1.0,
  min_price NUMERIC(10,2) DEFAULT 0,
  warranty_months INTEGER,
  warranty_text TEXT,
  material_markup NUMERIC(5,2) DEFAULT 0,
  fixed_quote_max_minutes INTEGER DEFAULT 30,
  enabled BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE pricing_configs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "pricing_configs_select" ON pricing_configs
  FOR SELECT USING (true);

CREATE POLICY "pricing_configs_insert" ON pricing_configs
  FOR INSERT WITH CHECK (auth.uid() IN (SELECT id FROM users WHERE role = 'admin'));

CREATE POLICY "pricing_configs_update" ON pricing_configs
  FOR UPDATE USING (auth.uid() IN (SELECT id FROM users WHERE role = 'admin'));


-- ------------------------------------------
-- FILE: supabase/migrations/seed_categories.sql
-- ------------------------------------------
-- M03: 四品类种子配置
-- 在 Supabase SQL Editor 中运行，在 001_schema.sql 之后

-- 家政
INSERT INTO category_configs (category, risk_tier, schema_json, entry_requirements, response_mode, safety_requirements, enabled, version)
VALUES (
  '家政',
  'low',
  '{
    "core_fields": {
      "location": {"type": "geo", "required": true},
      "time_window": {"type": "string", "required": true},
      "budget_range": {"type": "int_array", "required": true},
      "urgency": {"type": "enum", "required": true, "options": ["normal","urgent","scheduled"]}
    },
    "category_fields": {
      "service_type": {"type": "enum", "required": true, "options": ["下水道疏通","空调清洗","全屋清洁","水电维修","开锁换锁","搬家搬运","其他"]},
      "property_type": {"type": "enum", "required": true, "options": ["住宅","公寓","商业","其他"]},
      "estimated_duration_min": {"type": "int", "required": true}
    }
  }',
  '{"identity_verified": true, "manual_review": false}',
  'grab_first',
  '{"full_gps_trail": false, "enhanced_identity": false}',
  true,
  1
);

-- 交友
INSERT INTO category_configs (category, risk_tier, schema_json, entry_requirements, response_mode, safety_requirements, enabled, version)
VALUES (
  '交友',
  'medium',
  '{
    "core_fields": {
      "location": {"type": "geo", "required": true},
      "time_window": {"type": "string", "required": true},
      "budget_range": {"type": "int_array", "required": false},
      "urgency": {"type": "enum", "required": true, "options": ["today","scheduled"]}
    },
    "category_fields": {
      "group_size": {"type": "int", "required": true},
      "age_range": {"type": "int_array", "required": false},
      "gender_preference": {"type": "enum", "required": false, "options": ["male","female","any"]},
      "scene": {"type": "string", "required": true}
    }
  }',
  '{"identity_verified": true, "manual_review": false}',
  'interest_list',
  '{"full_gps_trail": false, "enhanced_identity": false}',
  true,
  1
);

-- 按摩（阶段二开放，enabled=false）
INSERT INTO category_configs (category, risk_tier, schema_json, entry_requirements, response_mode, safety_requirements, enabled, version)
VALUES (
  '按摩',
  'high',
  '{
    "core_fields": {
      "location": {"type": "geo", "required": true},
      "time_window": {"type": "string", "required": true},
      "budget_range": {"type": "int_array", "required": true}
    },
    "category_fields": {
      "service_item": {"type": "enum", "required": true, "options": ["推拿","足疗","精油","全身","其他"]},
      "duration_min": {"type": "int", "required": true},
      "on_site_or_shop": {"type": "enum", "required": true, "options": ["on_site","shop"]},
      "gender_preference": {"type": "enum", "required": false, "options": ["male","female","any"]}
    }
  }',
  '{"identity_verified": true, "qualification": ["职业资格证","健康证"], "manual_review": true}',
  'grab_first',
  '{"full_gps_trail": true, "enhanced_identity": true}',
  false,
  1
);

-- 医疗陪护（阶段三开放，enabled=false）
INSERT INTO category_configs (category, risk_tier, schema_json, entry_requirements, response_mode, safety_requirements, enabled, version)
VALUES (
  '医疗陪护',
  'high',
  '{
    "core_fields": {
      "location": {"type": "geo", "required": true},
      "time_window": {"type": "string", "required": true}
    },
    "category_fields": {
      "care_type": {"type": "enum", "required": true, "options": ["陪同就医","代为排队挂号","住院陪护","康复陪同","其他"]},
      "care_recipient_condition": {"type": "string", "required": true},
      "id_type": {"type": "enum", "required": true, "options": ["身份证","社保卡","其他"]}
    }
  }',
  '{"identity_verified": true, "qualification": ["陪护证","健康证"], "manual_review": true}',
  'agency_dispatch',
  '{"full_gps_trail": true, "enhanced_identity": true}',
  false,
  1
);

