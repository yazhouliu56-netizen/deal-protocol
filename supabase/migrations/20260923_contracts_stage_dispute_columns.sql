-- 20260923: contracts 阶段/争议/完工列收编（R9 缺表收编先例）
--
-- 背景：订单状态机（service_stage）、争议双机（dispute_status）、完工定时
-- （completed_at/auto_complete_at）、协议条款快照（terms）早被 orders PATCH /
-- cron / resolver 读写，但 DDL 从未建档——干净库上开争议/自动仲裁/cron
-- 自完成 500（e2e-milestone 实证）。纯 ADD COLUMN（F2 只增不改），幂等可重放。
ALTER TABLE public.contracts
  ADD COLUMN IF NOT EXISTS service_stage INT NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS dispute_status VARCHAR(16),
  ADD COLUMN IF NOT EXISTS completed_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS auto_complete_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS terms TEXT;
COMMENT ON COLUMN public.contracts.service_stage IS '履约阶段序号（状态机 serviceStage 锚点）';
COMMENT ON COLUMN public.contracts.dispute_status IS '争议独立机（OPEN/PENDING_REVIEW/RESOLVED，与资金 fund_status 双轨）';
COMMENT ON COLUMN public.contracts.completed_at IS '完工确认时刻';
COMMENT ON COLUMN public.contracts.auto_complete_at IS '超时自动完工死线（cron 扫描）';
COMMENT ON COLUMN public.contracts.terms IS '协议条款快照（JSON 文本；仲裁 agreementSigned 读取）';
