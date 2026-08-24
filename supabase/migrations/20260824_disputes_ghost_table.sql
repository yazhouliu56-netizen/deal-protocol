-- =============================================================================
-- 方向 2 · disputes 幽灵表补齐迁移（2026-08-24）
--
-- 背景：disputes 表是争议主流程唯一运行时表（orders/[id] PATCH 开争议/结案、
-- export-judicial-package 司法导出、lib/dispute/resolver 自动仲裁、admin/bi·stats），
-- 但全迁移链零定义——本地沙盒系手工建表，干净云端库上开争议必 500。
--
-- 列集 = 全部生产写读路径实证（非推测）：
--   写：orders/[id] {contract_id,initiator_id,protocol_id,channel,reason,evidence}
--       + {status,resolution,loser_id,llm_verdict,llm_confidence}
--       resolver {status,resolution,tier,loser_id,llm_verdict,llm_confidence,
--                 council_results,needs_human_review}
--   读：id/channel/reason/created_at/evidence/status/dispute_status/llm_verdict
--       （updated_at 为 settle_after_dispute 排序键）
--
-- 双列历史分裂消解：admin/stats 与 admin/bi 读 dispute_status，主流程读写 status
--   → status 单列权威 + sync_dispute_mirror() 单向镜像触发器（读兼容零代码改动）。
--   contracts.dispute_status 是另一张表的独立业务列，与本表无关。
--
-- RLS 姿态：启用但零公开策略 = 仅 service role 经 API 读写
--   （对齐 push_subscriptions 加固姿态；调解抽屉/司法导出均走自家 API 不直连）。
-- 幂等性：全部语句可重复执行；无 DROP TABLE / TRUNCATE / 数据改写。
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.disputes (
    id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    contract_id      VARCHAR(64),
    initiator_id     VARCHAR(64) NOT NULL,
    protocol_id      VARCHAR(64),
    channel          VARCHAR(16) NOT NULL DEFAULT 'green',            -- green | yellow | red（协议分通道）
    reason           TEXT        NOT NULL,
    evidence         JSONB,
    status           VARCHAR(16) NOT NULL DEFAULT 'OPEN',             -- OPEN | RESOLVED | REJECTED | PENDING_REVIEW
    -- 镜像列（只读消费兼容；由触发器维护，请勿直写——写侧一律写 status）
    dispute_status   VARCHAR(16),
    resolution       TEXT,
    tier             VARCHAR(8),                                      -- EASY | MEDIUM | HARD
    loser_id         VARCHAR(64),
    llm_verdict      JSONB,
    llm_confidence   NUMERIC,
    council_results  JSONB,
    needs_human_review BOOLEAN DEFAULT FALSE,
    created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_disputes_contract ON public.disputes (contract_id);
CREATE INDEX IF NOT EXISTS idx_disputes_status ON public.disputes (status);
CREATE INDEX IF NOT EXISTS idx_disputes_created ON public.disputes (created_at);
CREATE INDEX IF NOT EXISTS idx_disputes_updated ON public.disputes (updated_at);
CREATE INDEX IF NOT EXISTS idx_disputes_mirror ON public.disputes (dispute_status);

-- status → dispute_status 单向镜像 + updated_at 触碰
CREATE OR REPLACE FUNCTION public.sync_dispute_mirror()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
    NEW.dispute_status := NEW.status;
    NEW.updated_at := now();
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_disputes_mirror ON public.disputes;
CREATE TRIGGER trg_disputes_mirror
    BEFORE INSERT OR UPDATE OF status ON public.disputes
    FOR EACH ROW
    EXECUTE FUNCTION public.sync_dispute_mirror();

ALTER TABLE public.disputes ENABLE ROW LEVEL SECURITY;
-- 零策略：anon/authenticated 全拒，service role 绕行（Bypass RLS）
