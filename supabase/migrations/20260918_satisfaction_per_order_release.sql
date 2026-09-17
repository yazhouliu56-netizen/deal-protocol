-- ============================================================
-- R5 批经济退役（用户裁决 2026-09-17 · 宪法 §6.2 Clean Slate）：
-- 15 单成团 → 72h 单单释放。状态机零改名（SATISFACTION_HELD→SETTLED 不动），
-- 只换释放触发器 + 加暂扣时刻列。无真实订单，批表物理删除，不留适配器。
-- 可重跑（IF NOT EXISTS / IF EXISTS 全幂等）。
-- ============================================================

-- 1. 暂扣时刻（72h 窗起点 = 客观确认时刻，type1ReviewDeadline 同源）
ALTER TABLE public.contracts ADD COLUMN IF NOT EXISTS satisfaction_held_at TIMESTAMPTZ;

-- 2. 批经济出清（先断引用列，再从子表向父表删；皆为建表 migration 之外的野表；
-- 实证：satisfaction_contracts.batch_id 经 FK 引用 batches，须先删子表）
ALTER TABLE public.contracts DROP COLUMN IF EXISTS satisfaction_batch_id;
DROP TABLE IF EXISTS public.satisfaction_contracts;
DROP TABLE IF EXISTS public.satisfaction_batches;

-- 3. 单单扫表索引（cron 72h 到期捞 HELD 单）
CREATE INDEX IF NOT EXISTS idx_contracts_satisfaction_sweep
  ON public.contracts(fund_status, satisfaction_held_at)
  WHERE fund_status = 'SATISFACTION_HELD';
