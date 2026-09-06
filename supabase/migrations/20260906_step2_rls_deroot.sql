-- ============================================================================
-- 20260906_step2_rls_deroot.sql
-- Step 2（选项B先行）：profiles 递归根治 + demands 策略重建 + version 补齐。
--
-- 根因（已磁盘实证）：
--   R1 profiles 无限递归：20260723_fix_admin_rls_rbac.sql:21-29 在 profiles
--      自身建了 EXISTS(SELECT FROM profiles...) 管理员策略；叠加
--      20260801_audit_rls_and_rpc.sql:42-52 的 WITH CHECK 自查
--      (SELECT balance FROM profiles...) → 任意 profiles 鉴权触发引擎熔断 500。
--   R2 demands 读空：20260718_init_rls_policies.sql:12-17 引用
--      customer_id/provider_id，与活体 demander_id/matched_provider_id
--      （20260723 DDL + Step1 20260907）分叉 → 策略永远落空。
--   R3 grab_demand(010) 依赖 demands.version，但 Step1 未建 → 抢单 RPC 必炸。
--
-- 执行：Supabase 控制台 SQL Editor 粘贴全文执行 1 次。幂等，可重复执行。
-- 约束：API 路由全走 ANON key（src/lib/supabase-route-client.ts:8），RLS 对
--   API 生效 —— demands UPDATE 必须同时放行 OPEN 抢单（assign 路由）与
--   provider 状态机（status 路由），本文件已覆盖。
-- 收口声明（相对历史 USING(true) 的收紧，有意为之）：
--   S1 demands 非当事人仅可见 OPEN（大厅）；历史 authenticated 全可见取消。
--   S2 profiles 取消 "Anyone read public profile" 全公开读（profiles 含
--      phone/email 明文 PII），收敛为本人 + admin；公开展示需求另起安全视图。
-- ============================================================================

-- ----------------------------------------------------------------------------
-- Part 0：列补齐（全部 IF NOT EXISTS；version NOT NULL+DEFAULT，老行零回填）
-- ----------------------------------------------------------------------------
ALTER TABLE public.demands ADD COLUMN IF NOT EXISTS demander_id UUID;
ALTER TABLE public.demands ADD COLUMN IF NOT EXISTS client_id UUID;
ALTER TABLE public.demands ADD COLUMN IF NOT EXISTS customer_id UUID;
ALTER TABLE public.demands ADD COLUMN IF NOT EXISTS matched_provider_id UUID;
ALTER TABLE public.demands ADD COLUMN IF NOT EXISTS version INTEGER NOT NULL DEFAULT 0;

-- 触发器守卫引用的资金字段兜底（若 20260801 未上库，触发器运行时必炸，先保列存在）
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS balance NUMERIC DEFAULT 0;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS credit_score NUMERIC DEFAULT 600;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS trust_tier INT DEFAULT 1;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS reputation_score NUMERIC DEFAULT 100;

-- ----------------------------------------------------------------------------
-- Part 1：is_admin() 解耦函数 —— 管理员判断唯一出口
-- SECURITY DEFINER 使内部 SELECT bypass RLS，彻底终结“策略查自身”递归。
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin'
  );
$$;

-- ----------------------------------------------------------------------------
-- Part 2：profiles —— 清场全部历史策略，重建零自查策略组
-- ----------------------------------------------------------------------------
DO $$
DECLARE
  r RECORD;
BEGIN
  FOR r IN
    SELECT policyname FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'profiles'
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.profiles;', r.policyname);
  END LOOP;
END $$;

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- 本人读写 + admin（直接比对 auth.uid() = id，全程零 SELECT FROM profiles）
CREATE POLICY "profiles_self_select" ON public.profiles
  FOR SELECT TO authenticated
  USING (auth.uid() = id OR public.is_admin());

CREATE POLICY "profiles_self_update" ON public.profiles
  FOR UPDATE TO authenticated
  USING (auth.uid() = id OR public.is_admin())
  WITH CHECK (auth.uid() = id OR public.is_admin());

CREATE POLICY "profiles_admin_all" ON public.profiles
  FOR ALL TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

-- ----------------------------------------------------------------------------
-- Part 3：profiles 资金字段防自改触发器
-- 替代 20260801 自查式 WITH CHECK（递归源之一）。RLS 放行行级写，列级红线
-- 由触发器强制：非 admin 触碰 balance/credit_score/reputation_score/trust_tier
-- 直接抛错；admin 放行。触发器函数 SECURITY DEFINER，不触发 RLS。
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.enforce_profiles_safe_fields()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF public.is_admin() THEN
    RETURN NEW;
  END IF;
  IF NEW.balance IS DISTINCT FROM OLD.balance
    OR NEW.credit_score IS DISTINCT FROM OLD.credit_score
    OR NEW.reputation_score IS DISTINCT FROM OLD.reputation_score
    OR NEW.trust_tier IS DISTINCT FROM OLD.trust_tier THEN
    RAISE EXCEPTION 'profiles: 资金/信用字段仅管理员可变更';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_profiles_safe_fields ON public.profiles;
CREATE TRIGGER trg_profiles_safe_fields
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.enforce_profiles_safe_fields();

-- ----------------------------------------------------------------------------
-- Part 4：demands —— 清场全部历史策略（含引用幽灵列的失效策略），重建
-- owner 别名三列 OR（demander_id/client_id/customer_id，兼容活体分叉，
--   不做数据迁移）+ matched_provider_id + OPEN 大厅 + admin。
-- ----------------------------------------------------------------------------
DO $$
DECLARE
  r RECORD;
BEGIN
  FOR r IN
    SELECT policyname FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'demands'
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.demands;', r.policyname);
  END LOOP;
END $$;

ALTER TABLE public.demands ENABLE ROW LEVEL SECURITY;

-- 读：OPEN 大厅公开（含 anon，landing/ДВ incoming 依赖）+ 当事人 + admin
CREATE POLICY "demands_select" ON public.demands
  FOR SELECT TO public
  USING (
    status = 'OPEN'
    OR auth.uid() = demander_id
    OR auth.uid() = client_id
    OR auth.uid() = customer_id
    OR auth.uid() = matched_provider_id
    OR public.is_admin()
  );

-- 写（发单）：owner 别名其一等于自己 + admin
CREATE POLICY "demands_insert" ON public.demands
  FOR INSERT TO authenticated
  WITH CHECK (
    auth.uid() = demander_id
    OR auth.uid() = client_id
    OR auth.uid() = customer_id
    OR public.is_admin()
  );

-- 改：owner（放款 COMPLETED→settled 走此）+ 已接单 provider（状态机走此）
--   + OPEN 行抢单（assign 路由先 USING(status='OPEN')，WITH CHECK 要求新行
--   matched_provider_id 落到自己）+ admin
CREATE POLICY "demands_update" ON public.demands
  FOR UPDATE TO authenticated
  USING (
    auth.uid() = demander_id
    OR auth.uid() = client_id
    OR auth.uid() = customer_id
    OR auth.uid() = matched_provider_id
    OR status = 'OPEN'
    OR public.is_admin()
  )
  WITH CHECK (
    auth.uid() = demander_id
    OR auth.uid() = client_id
    OR auth.uid() = customer_id
    OR auth.uid() = matched_provider_id
    OR public.is_admin()
  );

CREATE POLICY "demands_admin_all" ON public.demands
  FOR ALL TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());
