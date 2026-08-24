-- =============================================================================
-- 方向 2 终极落地 SQL · 1:1 权威拼接 + 同名归档（2026-08-24）
-- 探活实证：远端仅存旧原型 orders(12列 grabbed/NOT_ACCEPTED) 与 pricing_configs(8列 category)
-- 策略：旧表归档 → 4 文件净室重建（零手写漂移，仅 1 行幂等补丁已标注）
-- 执行：Supabase SQL Editor 粘贴一次性执行，1-2秒，BEGIN/COMMIT 原子
-- =============================================================================
BEGIN;

-- 0) 归档旧原型（零丢失，可重放）
DO $$ BEGIN
  IF to_regclass('public.orders') IS NOT NULL AND to_regclass('public.orders_legacy') IS NULL THEN
    ALTER TABLE public.orders RENAME TO orders_legacy;
  END IF;
END $$;
DO $$ BEGIN
  IF to_regclass('public.pricing_configs') IS NOT NULL AND to_regclass('public.pricing_configs_legacy') IS NULL THEN
    ALTER TABLE public.pricing_configs RENAME TO pricing_configs_legacy;
  END IF;
END $$;

-- 1) 20260814_push_subscriptions.sql 原文
CREATE TABLE IF NOT EXISTS push_subscriptions (
  id BIGSERIAL PRIMARY KEY,
  endpoint TEXT NOT NULL UNIQUE,
  p256dh TEXT NOT NULL,
  auth TEXT NOT NULL,
  user_id TEXT NOT NULL DEFAULT '',
  user_agent TEXT DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_seen_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_push_subscriptions_user ON push_subscriptions (user_id);
CREATE INDEX IF NOT EXISTS idx_push_subscriptions_created ON push_subscriptions (created_at);
ALTER TABLE push_subscriptions ENABLE ROW LEVEL SECURITY;
CREATE OR REPLACE FUNCTION delete_my_push_subscription(p_endpoint TEXT)
RETURNS void LANGUAGE sql SECURITY DEFINER SET search_path = public AS $$ DELETE FROM push_subscriptions WHERE endpoint = p_endpoint; $$;
REVOKE ALL ON push_subscriptions FROM anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON push_subscriptions TO service_role;

-- 2) 20260815_mvp_core_tables.sql 原文（仅 pricing_configs 补 IF NOT EXISTS 幂等，已标注）
CREATE TABLE orders (
  id BIGSERIAL PRIMARY KEY,
  order_no VARCHAR(32) NOT NULL CONSTRAINT uniq_orders_order_no UNIQUE,
  user_id BIGINT NOT NULL,
  provider_id BIGINT,
  category_code VARCHAR(32) NOT NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'CREATED',
  version INT NOT NULL DEFAULT 0,
  total_amount INT NOT NULL,
  discount_amount INT NOT NULL DEFAULT 0,
  payable_amount INT NOT NULL,
  target_lng NUMERIC(10,6) NOT NULL,
  target_lat NUMERIC(10,6) NOT NULL,
  address_detail VARCHAR(255) NOT NULL,
  biz_params JSONB NOT NULL,
  split_plan_json JSONB NOT NULL,
  transaction_id VARCHAR(64),
  paid_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT chk_order_status CHECK (status IN ('CREATED','MATCHED','IN_PROGRESS','DELIVERED','SETTLED','CANCELLED')),
  CONSTRAINT chk_amounts CHECK (payable_amount = total_amount - discount_amount AND payable_amount >= 0)
);
CREATE INDEX idx_orders_user_status ON orders (user_id, status);
CREATE INDEX idx_orders_provider_status ON orders (provider_id, status);
CREATE INDEX idx_orders_created_at ON orders (created_at);
CREATE TABLE order_state_logs (
  id BIGSERIAL PRIMARY KEY,
  order_no VARCHAR(32) NOT NULL REFERENCES orders(order_no),
  from_state VARCHAR(20) NOT NULL,
  to_state VARCHAR(20) NOT NULL,
  version_at_trans INT NOT NULL,
  operator_type VARCHAR(16) NOT NULL,
  operator_id VARCHAR(64) NOT NULL,
  hook_name VARCHAR(64),
  hook_payload JSONB,
  hook_signature VARCHAR(128),
  transition_reason VARCHAR(255),
  created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX idx_state_logs_order_no ON order_state_logs (order_no);
CREATE INDEX idx_state_logs_created_at ON order_state_logs (created_at);
-- 补丁：原文件为 CREATE TABLE pricing_configs，现加 IF NOT EXISTS 幂等（仅此一处差异）
CREATE TABLE IF NOT EXISTS pricing_configs (
  id BIGSERIAL PRIMARY KEY,
  category_code VARCHAR(32) NOT NULL,
  version_code VARCHAR(16) NOT NULL,
  status VARCHAR(16) NOT NULL DEFAULT 'INACTIVE',
  base_price INT NOT NULL,
  base_duration_min INT NOT NULL,
  unit_price_per_min INT NOT NULL,
  pricing_dsl JSONB NOT NULL,
  split_rules JSONB NOT NULL,
  effective_start TIMESTAMPTZ NOT NULL,
  effective_end TIMESTAMPTZ NOT NULL,
  created_by VARCHAR(64) NOT NULL,
  created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT chk_pricing_status CHECK (status IN ('ACTIVE','INACTIVE','ARCHIVED')),
  CONSTRAINT chk_pricing_window CHECK (effective_start < effective_end)
);
CREATE UNIQUE INDEX IF NOT EXISTS uniq_cat_active_version ON pricing_configs (category_code, version_code) WHERE status = 'ACTIVE';
CREATE INDEX IF NOT EXISTS idx_pricing_lookup ON pricing_configs (category_code, status, effective_start);
CREATE TABLE split_records (
  id BIGSERIAL PRIMARY KEY,
  split_no VARCHAR(32) NOT NULL UNIQUE,
  order_no VARCHAR(32) NOT NULL REFERENCES orders(order_no),
  out_order_no VARCHAR(64) NOT NULL,
  receiver_mchid VARCHAR(32) NOT NULL,
  receiver_type VARCHAR(16) NOT NULL,
  split_amount INT NOT NULL,
  status VARCHAR(16) NOT NULL DEFAULT 'PENDING',
  channel_response JSONB,
  error_code VARCHAR(64),
  error_msg VARCHAR(255),
  retry_count INT NOT NULL DEFAULT 0,
  settled_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT chk_split_status CHECK (status IN ('PENDING','PROCESSING','SUCCESS','FAILED'))
);
CREATE UNIQUE INDEX uniq_split_out_order ON split_records (out_order_no, receiver_mchid);
CREATE INDEX idx_split_order_no ON split_records (order_no);
CREATE INDEX idx_split_status ON split_records (status);

-- 3) 20260823_step2_authoritative_orders.sql 原文
UPDATE orders SET status = 'PUBLISHED' WHERE status = 'CREATED';
UPDATE orders SET status = 'IN_SERVICE' WHERE status = 'IN_PROGRESS';
UPDATE orders SET status = 'INSPECTED' WHERE status = 'DELIVERED';
ALTER TABLE orders DROP CONSTRAINT IF EXISTS chk_order_status;
ALTER TABLE orders ADD CONSTRAINT chk_order_status CHECK (status IN ('PUBLISHED','MATCHED','IN_SERVICE','INSPECTED','SETTLED','CANCELLED'));
ALTER TABLE orders ADD COLUMN IF NOT EXISTS kind VARCHAR(8) NOT NULL DEFAULT 'solo';
ALTER TABLE orders ADD CONSTRAINT chk_orders_kind CHECK (kind IN ('solo','open'));
ALTER TABLE orders ADD COLUMN IF NOT EXISTS ammo_id VARCHAR(64);
CREATE INDEX IF NOT EXISTS idx_orders_kind_status ON orders (kind, status);
ALTER TABLE order_state_logs ADD COLUMN IF NOT EXISTS idempotency_key VARCHAR(96);
CREATE UNIQUE INDEX IF NOT EXISTS uniq_state_logs_idempotency ON order_state_logs (idempotency_key) WHERE idempotency_key IS NOT NULL;
CREATE TABLE IF NOT EXISTS order_seats (
  seat_id BIGSERIAL PRIMARY KEY,
  order_no VARCHAR(32) NOT NULL REFERENCES orders(order_no),
  user_id BIGINT NOT NULL,
  seat_index INT NOT NULL,
  paid_amount INT NOT NULL DEFAULT 0,
  deposit_held INT NOT NULL DEFAULT 0,
  status VARCHAR(16) NOT NULL DEFAULT 'JOINED',
  joined_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT chk_seat_status CHECK (status IN ('JOINED','SHOWN','NO_SHOW','REFUNDED')),
  CONSTRAINT uniq_seats_order_user UNIQUE (order_no, user_id),
  CONSTRAINT uniq_seats_order_index UNIQUE (order_no, seat_index)
);
CREATE INDEX IF NOT EXISTS idx_seats_order_no ON order_seats (order_no);
CREATE INDEX IF NOT EXISTS idx_seats_user ON order_seats (user_id);
ALTER TABLE orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE order_state_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE order_seats ENABLE ROW LEVEL SECURITY;
ALTER TABLE split_records ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS orders_anon_read ON orders;
CREATE POLICY orders_anon_read ON orders FOR SELECT TO anon, authenticated USING (true);
DROP POLICY IF EXISTS state_logs_anon_read ON order_state_logs;
CREATE POLICY state_logs_anon_read ON order_state_logs FOR SELECT TO anon, authenticated USING (true);
DROP POLICY IF EXISTS seats_anon_read ON order_seats;
CREATE POLICY seats_anon_read ON order_seats FOR SELECT TO anon, authenticated USING (true);
DROP POLICY IF EXISTS split_records_anon_read ON split_records;
CREATE POLICY split_records_anon_read ON split_records FOR SELECT TO anon, authenticated USING (true);

-- 4) 20260824_disputes_ghost_table.sql 原文
CREATE TABLE IF NOT EXISTS public.disputes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    contract_id VARCHAR(64),
    initiator_id VARCHAR(64) NOT NULL,
    protocol_id VARCHAR(64),
    channel VARCHAR(16) NOT NULL DEFAULT 'green',
    reason TEXT NOT NULL,
    evidence JSONB,
    status VARCHAR(16) NOT NULL DEFAULT 'OPEN',
    dispute_status VARCHAR(16),
    resolution TEXT,
    tier VARCHAR(8),
    loser_id VARCHAR(64),
    llm_verdict JSONB,
    llm_confidence NUMERIC,
    council_results JSONB,
    needs_human_review BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_disputes_contract ON public.disputes (contract_id);
CREATE INDEX IF NOT EXISTS idx_disputes_status ON public.disputes (status);
CREATE INDEX IF NOT EXISTS idx_disputes_created ON public.disputes (created_at);
CREATE INDEX IF NOT EXISTS idx_disputes_updated ON public.disputes (updated_at);
CREATE INDEX IF NOT EXISTS idx_disputes_mirror ON public.disputes (dispute_status);
CREATE OR REPLACE FUNCTION public.sync_dispute_mirror() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN NEW.dispute_status := NEW.status; NEW.updated_at := now(); RETURN NEW; END; $$;
DROP TRIGGER IF EXISTS trg_disputes_mirror ON public.disputes;
CREATE TRIGGER trg_disputes_mirror BEFORE INSERT OR UPDATE OF status ON public.disputes FOR EACH ROW EXECUTE FUNCTION public.sync_dispute_mirror();
ALTER TABLE public.disputes ENABLE ROW LEVEL SECURITY;

COMMIT;
-- 验证（执行后选跑）：
-- SELECT tablename FROM pg_tables WHERE schemaname='public' AND tablename IN ('orders','orders_legacy','pricing_configs','pricing_configs_legacy','order_seats','order_state_logs','split_records','push_subscriptions','disputes') ORDER BY tablename;
