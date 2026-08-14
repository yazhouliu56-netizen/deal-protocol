-- ============================================================
-- 20260814_push_subscriptions.sql
-- LAUNCH-GAP E 组：PWA 真推（VAPID）订阅存储
-- ============================================================

CREATE TABLE IF NOT EXISTS push_subscriptions (
  id BIGSERIAL PRIMARY KEY,
  endpoint TEXT NOT NULL UNIQUE,
  p256dh TEXT NOT NULL,
  auth TEXT NOT NULL,
  user_id TEXT NOT NULL DEFAULT '',
  user_agent TEXT DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_seen_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_push_subscriptions_user ON push_subscriptions (user_id);
CREATE INDEX IF NOT EXISTS idx_push_subscriptions_created ON push_subscriptions (created_at);

-- 服务端发送 API 使用 service role（已跳过 RLS），客户端仅经 API 写入：
-- 表默认公开读关闭、写入关闭 —— 订阅由 /api/push/subscribe 经 service role upsert。
ALTER TABLE push_subscriptions ENABLE ROW LEVEL SECURITY;

-- 若未来开放用户自助管理（本人 endpoint 删除），提供按 endpoint 哈希匹配的 RPC：
CREATE OR REPLACE FUNCTION delete_my_push_subscription(p_endpoint TEXT)
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  DELETE FROM push_subscriptions WHERE endpoint = p_endpoint;
$$;

REVOKE ALL ON push_subscriptions FROM anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON push_subscriptions TO service_role;
