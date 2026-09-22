-- 20260923: milestone_schedules 行级流转补列（C 全功能 M1）
--
-- P7 物化只写 PENDING 行且无释放路径；M1 起行级提交/放款 API。
-- 纯 ADD COLUMN（F2 只增不改）；status 口径收敛为全大写五态
-- （PENDING/HELD/SUBMITTED/RELEASED/REFUNDED，纯核 milestone-escrow 唯一真相源；
-- 旧小写 submitted/completed/skipped 无生产读写，types 侧同步出清）。
-- 幂等；可重放。
ALTER TABLE public.milestone_schedules
  ADD COLUMN IF NOT EXISTS submitted_at TIMESTAMPTZ;
COMMENT ON COLUMN public.milestone_schedules.submitted_at IS
  '阶段交验时刻（SUBMITTED 写入；超时窗 auto_confirm_at=submitted_at+sla_hours）';
COMMENT ON COLUMN public.milestone_schedules.status IS
  '行级五态：PENDING 预留/HELD 托管中/SUBMITTED 待验收/RELEASED 已放款/REFUNDED 已退款';
