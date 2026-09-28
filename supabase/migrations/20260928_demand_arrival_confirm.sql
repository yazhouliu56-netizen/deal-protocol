-- R-0928-08 A 档双方到达确认（add-only）。云 DDL 手工执行；CI 不跑 DDL。
ALTER TABLE demands ADD COLUMN IF NOT EXISTS arrival_confirmed_at TIMESTAMPTZ NULL;
