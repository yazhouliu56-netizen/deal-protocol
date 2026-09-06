-- ============================================================================
-- 20260906_users_phone_nullable.sql
-- 邮箱号发单 FK 根治：protocols.demander_id → users(id)，但邮箱注册（无手机）
--   从不写 users 行 → 发单撞外键 500。放开 users.phone 可空，注册链路必写
--   users 行（phone 缺席记 NULL），与 sms/verify 回填语义对齐。
-- 执行：Supabase 控制台 SQL Editor 执行 1 次。幂等（DROP NOT NULL 在已可空
--   时为无操作成功），可重复执行。
-- 兼容：Postgres UNIQUE 允许多 NULL；调用方 users.phone 均已 null 安全
--   （export-judicial-package ?? null；team-formation 只读 nickname）。
-- ============================================================================

ALTER TABLE public.users ALTER COLUMN phone DROP NOT NULL;
