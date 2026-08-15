-- =============================================================================
-- MVP 核心标准表 DDL（2026-08-15 · 人类创始人注入 · 100% 物理代码级闭环）
--
-- 目标：PostgreSQL 14+。落盘 MVP 系统设计与执行 SOP 的 4 张标准表：
--   1. orders            订单主表（CAS 乐观锁 + 金额分单位 + 状态机六态）
--   2. order_state_logs  状态机变迁审计轨迹（每笔跃迁留痕，可完整回溯）
--   3. pricing_configs   品类计价规则（版本化定价 + 计价 DSL + 分账规则）
--   4. split_records     合规分账记录（微信/银行分账通道执行台账 + 重试计数）
--
-- 金额精度守恒：一切金额字段一律以「分（Cents/INT）」为最小单位存储，
-- 杜绝浮点精度丢失（与 escrow.ts 资金引擎的两位小数分账语义对齐：
-- 元 → 分 = ×100 整数化落库）。
--
-- 说明：本文件为 MVP 全新数据库的标准表定义（幂等单建）；与旧迁移
-- （009_pricing_configs 等）同名表属继承关系，接入旧库时以本文件为
-- 标准重建并迁移数据。
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. orders —— 订单主表
--    status 六态：CREATED（已创建）→ MATCHED（已匹配）→ IN_PROGRESS（履约中）
--    → DELIVERED（已交付）→ SETTLED（已结算）｜CANCELLED（已取消）
--    version 为 CAS 乐观锁版本号：每次状态跃迁自增 1，写回必须携带
--    expected_version 比对（见 runner.ts advanceLifecycle 的
--    OPTIMISTIC_LOCK_VERSION_CONFLICT 拦截）。
-- -----------------------------------------------------------------------------
CREATE TABLE orders (
  id             BIGSERIAL PRIMARY KEY,
  order_no       VARCHAR(32)  NOT NULL CONSTRAINT uniq_orders_order_no UNIQUE,
  user_id        BIGINT       NOT NULL,
  provider_id    BIGINT,
  category_code  VARCHAR(32)  NOT NULL,
  status         VARCHAR(20)  NOT NULL DEFAULT 'CREATED',
  -- CAS 乐观锁：读取时快照、写回前比对、跃迁后自增（防并发双写覆盖）
  version        INT          NOT NULL DEFAULT 0,
  -- 金额单位：分（Cents/INT），杜绝浮点精度丢失
  total_amount   INT          NOT NULL,
  discount_amount INT         NOT NULL DEFAULT 0,
  payable_amount INT          NOT NULL,
  target_lng     NUMERIC(10, 6) NOT NULL,
  target_lat     NUMERIC(10, 6) NOT NULL,
  address_detail VARCHAR(255) NOT NULL,
  biz_params     JSONB        NOT NULL,
  split_plan_json JSONB       NOT NULL,
  transaction_id VARCHAR(64),
  paid_at        TIMESTAMP WITH TIME ZONE,
  created_at     TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at     TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT chk_order_status CHECK (
    status IN ('CREATED', 'MATCHED', 'IN_PROGRESS', 'DELIVERED', 'SETTLED', 'CANCELLED')
  ),
  -- 金额守恒：实付 = 总额 − 优惠，且实付非负（防负价/超扣）
  CONSTRAINT chk_amounts CHECK (
    payable_amount = total_amount - discount_amount AND payable_amount >= 0
  )
);

COMMENT ON TABLE orders IS '订单主表：六态状态机 + CAS 乐观锁（version）+ 金额分单位守恒约束';
COMMENT ON COLUMN orders.version IS 'CAS 乐观锁版本号：读快照 → 写前比对 expected_version → 跃迁后自增 1';
COMMENT ON COLUMN orders.total_amount IS '订单总额（分）';
COMMENT ON COLUMN orders.discount_amount IS '优惠金额（分），恒 ≥ 0';
COMMENT ON COLUMN orders.payable_amount IS '实付金额（分）= total_amount − discount_amount，恒 ≥ 0';

CREATE INDEX idx_orders_user_status ON orders (user_id, status);
CREATE INDEX idx_orders_provider_status ON orders (provider_id, status);
CREATE INDEX idx_orders_created_at ON orders (created_at);

-- -----------------------------------------------------------------------------
-- 2. order_state_logs —— 状态机变迁审计轨迹
--    每笔跃迁（含 hook 触发与签名）留一行，version_at_trans 记录跃迁发生
--    时的 CAS 版本快照，可完整回溯订单状态历史与并发冲突现场。
-- -----------------------------------------------------------------------------
CREATE TABLE order_state_logs (
  id                BIGSERIAL PRIMARY KEY,
  order_no          VARCHAR(32) NOT NULL REFERENCES orders(order_no),
  from_state        VARCHAR(20) NOT NULL,
  to_state          VARCHAR(20) NOT NULL,
  -- 跃迁发生时的 CAS 版本快照（审计可回溯并发现场）
  version_at_trans  INT         NOT NULL,
  operator_type     VARCHAR(16) NOT NULL,
  operator_id       VARCHAR(64) NOT NULL,
  hook_name         VARCHAR(64),
  hook_payload      JSONB,
  hook_signature    VARCHAR(128),
  transition_reason VARCHAR(255),
  created_at        TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

COMMENT ON TABLE order_state_logs IS '状态机变迁审计轨迹：每笔跃迁留痕，含 CAS 版本快照与 hook 签名';
COMMENT ON COLUMN order_state_logs.version_at_trans IS '跃迁时的 orders.version 快照（审计并发冲突现场）';
COMMENT ON COLUMN order_state_logs.hook_signature IS '伴生钩子执行的确定性签名（验签防篡改）';

CREATE INDEX idx_state_logs_order_no ON order_state_logs (order_no);
CREATE INDEX idx_state_logs_created_at ON order_state_logs (created_at);

-- -----------------------------------------------------------------------------
-- 3. pricing_configs —— 品类计价规则（版本化）
--    每类目每版本一条记录，status 控制生效；uniq_cat_active_version 保证
--    同一类目同一版本码只有一个 ACTIVE（新旧价格切换原子化）。
--    金额字段（base_price / unit_price_per_min）单位：分。
-- -----------------------------------------------------------------------------
CREATE TABLE pricing_configs (
  id                  BIGSERIAL PRIMARY KEY,
  category_code       VARCHAR(32) NOT NULL,
  version_code        VARCHAR(16) NOT NULL,
  status              VARCHAR(16) NOT NULL DEFAULT 'INACTIVE',
  -- 金额单位：分（Cents/INT）
  base_price          INT         NOT NULL,
  base_duration_min   INT         NOT NULL,
  unit_price_per_min  INT         NOT NULL,
  pricing_dsl         JSONB       NOT NULL,
  split_rules         JSONB       NOT NULL,
  effective_start     TIMESTAMP WITH TIME ZONE NOT NULL,
  effective_end       TIMESTAMP WITH TIME ZONE NOT NULL,
  created_by          VARCHAR(64) NOT NULL,
  created_at          TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT chk_pricing_status CHECK (
    status IN ('ACTIVE', 'INACTIVE', 'ARCHIVED')
  ),
  CONSTRAINT chk_pricing_window CHECK (effective_start < effective_end)
);

COMMENT ON TABLE pricing_configs IS '品类计价规则（版本化）：base_price + 时长单价 + 计价 DSL + 分账规则';
COMMENT ON COLUMN pricing_configs.base_price IS '基础价（分）';
COMMENT ON COLUMN pricing_configs.unit_price_per_min IS '每分钟单价（分）';
COMMENT ON COLUMN pricing_configs.pricing_dsl IS '计价 DSL（结构化 JSON，扩展公式计价）';
COMMENT ON COLUMN pricing_configs.split_rules IS '合规分账规则（JSONB：渠道/接收方/比例，驱动 split_records 生成）';

-- 同一类目同一版本码仅一个 ACTIVE 版本（部分唯一索引）
CREATE UNIQUE INDEX uniq_cat_active_version
  ON pricing_configs (category_code, version_code)
  WHERE status = 'ACTIVE';

-- 计价查询走（类目 + 状态 + 生效起始）复合索引
CREATE INDEX idx_pricing_lookup
  ON pricing_configs (category_code, status, effective_start);

-- -----------------------------------------------------------------------------
-- 4. split_records —— 合规分账记录
--    微信/银行分账通道执行台账：每次分账尝试一行，retry_count 随指数退避
--    递增（escrow.calculateSplitRetrySchedule：1/5/15/60/120 分钟阶梯，
--    超 5 次放弃 + P0 告警）；status 流转 PENDING → PROCESSING → SUCCESS
--    / FAILED。
-- -----------------------------------------------------------------------------
CREATE TABLE split_records (
  id                BIGSERIAL PRIMARY KEY,
  split_no          VARCHAR(32) NOT NULL UNIQUE,
  order_no          VARCHAR(32) NOT NULL REFERENCES orders(order_no),
  out_order_no      VARCHAR(64) NOT NULL,
  receiver_mchid    VARCHAR(32) NOT NULL,
  receiver_type     VARCHAR(16) NOT NULL,
  -- 金额单位：分（Cents/INT）
  split_amount      INT         NOT NULL,
  status            VARCHAR(16) NOT NULL DEFAULT 'PENDING',
  channel_response  JSONB,
  error_code        VARCHAR(64),
  error_msg         VARCHAR(255),
  -- 指数退避重试计数：上限 5 次，超出触发 P0 告警（escrow.ts）
  retry_count       INT         NOT NULL DEFAULT 0,
  settled_at        TIMESTAMP WITH TIME ZONE,
  created_at        TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at        TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT chk_split_status CHECK (
    status IN ('PENDING', 'PROCESSING', 'SUCCESS', 'FAILED')
  )
);

COMMENT ON TABLE split_records IS '合规分账记录：分账通道执行台账 + 指数退避重试计数（上限 5 次 + P0 告警）';
COMMENT ON COLUMN split_records.split_amount IS '分账金额（分）';
COMMENT ON COLUMN split_records.retry_count IS '重试计数：1/5/15/60/120 分钟阶梯，>5 放弃并触发 P0 告警';

-- 同一外部单号 + 接收方商户号幂等唯一（防重复分账）
CREATE UNIQUE INDEX uniq_split_out_order ON split_records (out_order_no, receiver_mchid);
CREATE INDEX idx_split_order_no ON split_records (order_no);
CREATE INDEX idx_split_status ON split_records (status);
