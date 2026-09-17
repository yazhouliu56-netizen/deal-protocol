-- ============================================================
-- R9 缺表收编（用户裁决 2026-09-18）：transactions / emergency_contacts /
-- finance_transactions 建表；withdrawals 不建（码随表并入 M14 withdrawal_requests，
-- 见 finance/withdraw 路由重写）；view_admin_stats 不建视图（改服务端路由）。
-- 全幂等；只增不删（§6.2 方案 A 天然满足，无破坏性变更）。
-- RLS：本人＋管理员可读；写端仅 service（ refund/SOS/财务均为服务端调用）。
-- ============================================================

-- 1. 资金台账（refund.ts writer 契约：user_id/type/amount/balance_before/balance_after/description）
CREATE TABLE IF NOT EXISTS public.transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NULL,
  contract_id UUID NULL,
  type TEXT NOT NULL DEFAULT 'REFUND',
  amount NUMERIC(12, 2) NOT NULL DEFAULT 0,
  balance_before NUMERIC(12, 2) NOT NULL DEFAULT 0,
  balance_after NUMERIC(12, 2) NOT NULL DEFAULT 0,
  description TEXT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.transactions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS transactions_self_select ON public.transactions;
CREATE POLICY transactions_self_select ON public.transactions
  FOR SELECT TO authenticated USING (
    user_id = auth.uid()
    OR EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
  );

-- 2. 应急联系人（sos-service reader 契约：name/phone by user_id，profiles 回落保留）
-- #8：手机号仅本人＋管理员可见，写端仅 service（暂无写方，空表等写方）。
CREATE TABLE IF NOT EXISTS public.emergency_contacts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  name TEXT NOT NULL DEFAULT '',
  phone TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.emergency_contacts ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS emergency_contacts_self_select ON public.emergency_contacts;
CREATE POLICY emergency_contacts_self_select ON public.emergency_contacts
  FOR SELECT TO authenticated USING (
    user_id = auth.uid()
    OR EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
  );

-- 3. 财务流水（finance/transactions fallback 形状：id/type/amount/title/status/created_at＋user_id；
-- 暂无写方，建表待写方，主路 orders 回落保留 #10）
CREATE TABLE IF NOT EXISTS public.finance_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NULL,
  type TEXT NOT NULL DEFAULT 'ESCROW_LOCK',
  amount NUMERIC(12, 2) NOT NULL DEFAULT 0,
  title TEXT NULL,
  status TEXT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.finance_transactions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS finance_transactions_self_select ON public.finance_transactions;
CREATE POLICY finance_transactions_self_select ON public.finance_transactions
  FOR SELECT TO authenticated USING (
    user_id = auth.uid()
    OR EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
  );
