-- 000 profiles 基线（2026-09-07 补记）：profiles 表从未被版本化（云端系手工建表），
-- 导致 fresh 沙盒在 011_verification_fields 直接失败（relation does not exist）。
-- 本文件只补创表 + 核心列，全 IF NOT EXISTS、无数据、无约束（role 约束归
-- 20260723_fix_admin_rls_rbac 所有），云端重放为无操作收敛。
-- 列单取自 002_create_user_fn 建号触发器的 INSERT 列（id/name/email/phone/role/roles/balance/credit_score/created_at）。
CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID PRIMARY KEY,
  name TEXT,
  email TEXT,
  phone TEXT,
  role TEXT NOT NULL DEFAULT 'demander',
  roles TEXT,
  balance NUMERIC DEFAULT 0,
  credit_score NUMERIC DEFAULT 100,
  created_at TIMESTAMPTZ DEFAULT now()
);
