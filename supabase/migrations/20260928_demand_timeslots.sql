-- R-0928-12 预约单三增量之时段 DDL（add-only）。
-- demands 加预约时段列（即时单保持 NULL）；供给方同一起始时段唯一（第二道防线，
-- 第一道为接单 API 撞单 409 门）。云 DDL 手工执行（SQL Editor）；CI 不跑 DDL。
ALTER TABLE demands ADD COLUMN IF NOT EXISTS timeslot_start TIMESTAMPTZ NULL;
ALTER TABLE demands ADD COLUMN IF NOT EXISTS timeslot_end TIMESTAMPTZ NULL;

CREATE UNIQUE INDEX IF NOT EXISTS uq_demands_provider_timeslot
  ON demands (matched_provider_id, timeslot_start)
  WHERE matched_provider_id IS NOT NULL AND timeslot_start IS NOT NULL;
