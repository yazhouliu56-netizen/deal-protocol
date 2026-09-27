-- ADR-0022 强制守护 Watchdog：guard_breadcrumbs append-only 面包屑表。
-- 加法迁移（add-only）：建表 + 索引 + RLS 零 policy（service-only，与 disputes 同制；
-- 客户端经 /api/guard/* 服务端权威写，anon/authenticated 直接读写全拒）。
-- 云 DDL 手工执行（SQL Editor）；CI 不跑 DDL。
CREATE TABLE IF NOT EXISTS guard_breadcrumbs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  demand_id UUID NOT NULL REFERENCES demands(id) ON DELETE CASCADE,
  reporter_id UUID NOT NULL,
  lat NUMERIC(8, 4) NULL,
  lng NUMERIC(8, 4) NULL,
  accuracy_m NUMERIC(10, 1) NULL,
  battery_low BOOLEAN NOT NULL DEFAULT FALSE,
  gps_enabled BOOLEAN NULL,
  checkin BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_guard_breadcrumbs_demand_time
  ON guard_breadcrumbs (demand_id, created_at DESC);

ALTER TABLE guard_breadcrumbs ENABLE ROW LEVEL SECURITY;
-- 零 policy：service_role 旁路 RLS，业务读写全走服务端 API（成员校验在路由层）。
