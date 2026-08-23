-- =============================================================================
-- Step 2 核心接电 · 服务端五态权威化增补迁移（2026-08-23）
--
-- 基于 20260815_mvp_core_tables.sql 骨架做三件事：
--   1. orders.status 枚举对齐 runner.ts 权威原子态
--      （CREATED/IN_PROGRESS/DELIVERED → PUBLISHED/IN_SERVICE/INSPECTED，
--        与 types/ammo-schema.ts AtomicFiveState 严格一致 —— 红线 2 映射守恒）
--   2. orders 增补 kind（solo|open 组局建模裁决·缺口 B 选项 1）与 ammo_id
--      （快照冻结机制的权威检索键）；order_state_logs 增补幂等键唯一约束
--      （离线队列重放防重 —— 红线 5 断网弹性）
--   3. order_seats 拼位子表（组局 AA 分摊 / 出勤档案 / 爽约赔偿的物理承载）
--      + 四表行级安全（anon 只读公开事实；写入零策略 = 仅 service role
--      经状态机 API 落库，UI 层永不直写 —— 红线 1 隔离墙）
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. orders.status 枚举对齐 runner 权威原子态
-- -----------------------------------------------------------------------------
UPDATE orders SET status = 'PUBLISHED'    WHERE status = 'CREATED';
UPDATE orders SET status = 'IN_SERVICE'   WHERE status = 'IN_PROGRESS';
UPDATE orders SET status = 'INSPECTED'    WHERE status = 'DELIVERED';

ALTER TABLE orders DROP CONSTRAINT IF EXISTS chk_order_status;
ALTER TABLE orders ADD CONSTRAINT chk_order_status CHECK (
  status IN ('PUBLISHED', 'MATCHED', 'IN_SERVICE', 'INSPECTED', 'SETTLED', 'CANCELLED')
);

COMMENT ON CONSTRAINT chk_order_status ON orders IS
  '原子五态 + CANCELLED：与 types/ammo-schema.ts AtomicFiveState / runner.ts FIVE_STATE_TRANSITIONS 严格一致';

-- -----------------------------------------------------------------------------
-- 2. orders 增补列：kind（组局建模）/ ammo_id（弹药权威检索键）
-- -----------------------------------------------------------------------------
ALTER TABLE orders ADD COLUMN IF NOT EXISTS kind VARCHAR(8) NOT NULL DEFAULT 'solo';
ALTER TABLE orders ADD CONSTRAINT chk_orders_kind CHECK (kind IN ('solo', 'open'));
COMMENT ON COLUMN orders.kind IS '订单形态：solo=1:1 服务型；open=多人拼单局（席位明细见 order_seats，locked/assembled 为 MATCHED 态客户端投影）';

ALTER TABLE orders ADD COLUMN IF NOT EXISTS ammo_id VARCHAR(64);
COMMENT ON COLUMN orders.ammo_id IS '弹药标识（快照冻结机制）：跃迁 API 按 ammoSnapshot 执行，ammo_id 为审计回查权威检索键';

CREATE INDEX IF NOT EXISTS idx_orders_kind_status ON orders (kind, status);

-- -----------------------------------------------------------------------------
-- 3. order_state_logs 增补幂等键（离线队列重放防重，红线 5）
--    PostgreSQL UNIQUE 对 NULL 不去重 → 非幂等调用（无键）不受影响
-- -----------------------------------------------------------------------------
ALTER TABLE order_state_logs ADD COLUMN IF NOT EXISTS idempotency_key VARCHAR(96);
CREATE UNIQUE INDEX IF NOT EXISTS uniq_state_logs_idempotency
  ON order_state_logs (idempotency_key)
  WHERE idempotency_key IS NOT NULL;

-- -----------------------------------------------------------------------------
-- 4. order_seats 拼位子表（缺口 B 终局裁决 · 选项 1）
--    一行 = 一个拼位者的占座事实：AA 分摊金额 / 出勤档案 / 爽约赔偿状态。
--    locked / assembled 不入原子态 —— 由本表派生投影（红线 2）。
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS order_seats (
  seat_id     BIGSERIAL PRIMARY KEY,
  order_no    VARCHAR(32) NOT NULL REFERENCES orders(order_no),
  user_id     BIGINT      NOT NULL,
  seat_index  INT         NOT NULL,
  -- 金额单位：分（Cents/INT，全库统一）
  paid_amount INT         NOT NULL DEFAULT 0,
  deposit_held INT        NOT NULL DEFAULT 0,
  status      VARCHAR(16) NOT NULL DEFAULT 'JOINED',
  joined_at   TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at  TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT chk_seat_status CHECK (
    status IN ('JOINED', 'SHOWN', 'NO_SHOW', 'REFUNDED')
  ),
  -- 同一订单同一用户不重复占座；同订单座位号不重复
  CONSTRAINT uniq_seats_order_user UNIQUE (order_no, user_id),
  CONSTRAINT uniq_seats_order_index UNIQUE (order_no, seat_index)
);

COMMENT ON TABLE order_seats IS
  '拼位子表（open 局）：AA 分摊 + 出勤档案（SHOWN/NO_SHOW）+ 爽约赔偿状态机';
COMMENT ON COLUMN order_seats.paid_amount IS '该席实付金额（分）';
COMMENT ON COLUMN order_seats.deposit_held IS '该席托管押金（分）';

CREATE INDEX IF NOT EXISTS idx_seats_order_no ON order_seats (order_no);
CREATE INDEX IF NOT EXISTS idx_seats_user ON order_seats (user_id);

-- -----------------------------------------------------------------------------
-- 5. 行级安全（RLS）：公开事实 anon 可读；写入零策略 = 仅 service role
--    （全部写操作经 /api/orders/* 状态机端点以 service role 落库，
--      UI 层永不直写 —— 参与方 auth.uid() 行级读策略留登录态接入时增补）
-- -----------------------------------------------------------------------------
ALTER TABLE orders            ENABLE ROW LEVEL SECURITY;
ALTER TABLE order_state_logs  ENABLE ROW LEVEL SECURITY;
ALTER TABLE order_seats       ENABLE ROW LEVEL SECURITY;
ALTER TABLE split_records     ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS orders_anon_read ON orders;
CREATE POLICY orders_anon_read ON orders
  FOR SELECT TO anon, authenticated USING (true);

DROP POLICY IF EXISTS state_logs_anon_read ON order_state_logs;
CREATE POLICY state_logs_anon_read ON order_state_logs
  FOR SELECT TO anon, authenticated USING (true);

DROP POLICY IF EXISTS seats_anon_read ON order_seats;
CREATE POLICY seats_anon_read ON order_seats
  FOR SELECT TO anon, authenticated USING (true);

DROP POLICY IF EXISTS split_records_anon_read ON split_records;
CREATE POLICY split_records_anon_read ON split_records
  FOR SELECT TO anon, authenticated USING (true);
