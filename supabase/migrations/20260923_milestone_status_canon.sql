-- 20260923: milestone_schedules 状态 CHECK 收敛为纯核五态（C 全功能 M4 实证）
--
-- 背景：CHECK 仍是旧双轨（PENDING/HELD/SETTLED/DISPUTED＋小写
-- submitted/completed/skipped），与纯核 milestone-escrow 唯一真相源
-- （PENDING/HELD/SUBMITTED/RELEASED/REFUNDED，批次 3a 裁决）冲突——
-- 行级 SUBMITTED/RELEASED/REFUNDED 写入被 23514 拦截，M1 API 全灭。
-- 本项目现存 0 行（e2e 种子均已清场），无需回填，直接换约束。
-- 旧 release_checkpoint_rpc 函数（无调用方，P8 已退役）若被误调会触新约束，
-- 属预期拦截（死路径不得复活）。
-- 纯约束替换（F2 只增不改精神：无数据改写、无列删除），幂等可重放。
ALTER TABLE public.milestone_schedules
  DROP CONSTRAINT IF EXISTS milestone_schedules_status_check;
ALTER TABLE public.milestone_schedules
  ADD CONSTRAINT milestone_schedules_status_check
  CHECK (status IN ('PENDING', 'HELD', 'SUBMITTED', 'RELEASED', 'REFUNDED'));
