-- 20260910: 漏斗遥测 metric_events（P15 · L6 可观测）
--
-- trackMetric(api 后端) 落库表；只 service_role 写（RLS 开启但无 anon 策略），
-- ADMIN 读经 service 客户端。遥测失败永不阻断主流程（路由层恒 200，见 route）。
CREATE TABLE IF NOT EXISTS public.metric_events (
  id BIGSERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  value DOUBLE PRECISION NOT NULL DEFAULT 1,
  tags JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.metric_events ENABLE ROW LEVEL SECURITY;
COMMENT ON TABLE public.metric_events IS 'P15 漏斗/性能遥测事件；service_role 写入，禁止 anon 直写';
CREATE INDEX IF NOT EXISTS idx_metric_events_name_created ON public.metric_events (name, created_at DESC);
