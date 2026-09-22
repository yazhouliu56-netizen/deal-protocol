-- 20260923: disputes 被发起侧举证列（ADR-0021 后续根本解决）
--
-- 背景：disputes 只有 evidence 单字段（发起侧开争议时写入），被发起侧
-- 无独立举证字段，resolver 被迫写死 providerCounterEvidence=false
--（有反驳也看不见，AI 可能 AUTO 直接划款）。
-- 修复：responder_evidence 独立列（发起侧=evidence，被发起侧=responder_evidence，
-- 哪一侧提交的就是哪一侧的）；resolver 实读后者进签发门禁。
-- 姿态：纯 ADD COLUMN（F2 只增不改）；RLS 零策略继承（service 经 API 读写）；
-- 幂等可重放；存量行 NULL=无反驳（与旧写死 false 语义一致，零回填）。
ALTER TABLE public.disputes
  ADD COLUMN IF NOT EXISTS responder_evidence JSONB;
COMMENT ON COLUMN public.disputes.responder_evidence IS
  '被发起侧反驳举证（发起侧用 evidence 列）；非空即转人工，见 evaluateIssuance counter-evidence-manual';
