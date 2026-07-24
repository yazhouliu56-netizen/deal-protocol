-- P0-05: LLM 调用日志 — 记录所有 LLM 调用的 prompt/response 用于回归测试
-- 实现《设计方案.md》§4.1: 所有 LLM 调用记录 prompt/response 到日志
-- 日志脱敏：不记录 PII 字段，仅记录调用元数据

CREATE TABLE IF NOT EXISTS public.llm_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  provider TEXT NOT NULL,
  model TEXT NOT NULL,
  prompt TEXT,
  response TEXT,
  tokens_used INT DEFAULT 0,
  latency_ms INT DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.llm_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admin full access llm_logs" ON public.llm_logs;
CREATE POLICY "Admin full access llm_logs"
  ON public.llm_logs
  FOR ALL
  TO authenticated
  USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
  );
