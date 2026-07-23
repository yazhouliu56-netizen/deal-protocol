-- ============================================================
-- RBAC 修复: 将所有基于邮箱后缀 (%@admin.com) 的管理员策略
-- 重构为基于 profiles.role = 'admin' 的标准 RBAC 判断
-- ============================================================
-- 高危漏洞: 任何注册 %@admin.com 的用户可自动获得管理员权限
-- 修复: 验证 profiles 表中的 role 字段
-- ============================================================

-- demands
DROP POLICY IF EXISTS "Admin full access demands" ON demands;
CREATE POLICY "Admin full access demands" ON demands
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE public.profiles.id = auth.uid()
        AND public.profiles.role = 'admin'
    )
  );

-- profiles
DROP POLICY IF EXISTS "Admin full access profiles" ON profiles;
CREATE POLICY "Admin full access profiles" ON profiles
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE public.profiles.id = auth.uid()
        AND public.profiles.role = 'admin'
    )
  );

-- notifications (覆盖 20260718_init_rls_policies.sql 中的邮箱策略；
-- 015_notifications_system.sql 已有正确 RBAC 策略，但名称不同，
-- 此策略确保邮箱策略被替换且角色值一致)
DROP POLICY IF EXISTS "Admin full access notifications" ON notifications;
CREATE POLICY "Admin full access notifications" ON notifications
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE public.profiles.id = auth.uid()
        AND public.profiles.role = 'admin'
    )
  );

-- provider_wallets
DROP POLICY IF EXISTS "Admin full access wallets" ON provider_wallets;
CREATE POLICY "Admin full access wallets" ON provider_wallets
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE public.profiles.id = auth.uid()
        AND public.profiles.role = 'admin'
    )
  );

-- wallet_logs
DROP POLICY IF EXISTS "Admin full access wallet logs" ON wallet_logs;
CREATE POLICY "Admin full access wallet logs" ON wallet_logs
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE public.profiles.id = auth.uid()
        AND public.profiles.role = 'admin'
    )
  );
