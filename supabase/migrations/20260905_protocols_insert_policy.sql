-- 20260905: 补齐 protocols 表 INSERT 策略（发单 RLS 自愈）。
--
-- 背景：001_schema.sql 只给了 protocols_select，INSERT 无策略，
-- withAuth 用户 token 直插必 42501。路由层已切 service_role 止血，
-- 本补丁让底座具备自愈能力（幂等，可重复执行）。
-- 序列位置：P4 收编前置 · 投流转化链路打通。

ALTER TABLE public.protocols ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "protocols_insert_authenticated" ON public.protocols;

CREATE POLICY "protocols_insert_authenticated"
ON public.protocols
FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = demander_id);
