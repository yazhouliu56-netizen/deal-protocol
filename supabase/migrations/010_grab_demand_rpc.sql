-- ============================================================================
-- grab_demand: Atomic grab-order with PostgreSQL row-level lock (FOR UPDATE)
-- ============================================================================
-- Returns JSONB — the full updated demand row on success, or NULL on failure.
-- 使用方式（在 Supabase SQL Editor 中运行）:
--   1. 粘贴本文件全部内容
--   2. 点击 Run
--   3. 执行后前端即可调用 supabase.rpc('grab_demand', {...})
-- ============================================================================

CREATE OR REPLACE FUNCTION grab_demand(
  target_demand_id UUID,
  provider_id      UUID
) RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  current_status  TEXT;
  current_version INTEGER;
BEGIN
  -- 1) 行级锁屏障 + 读取现状（阻塞其他并发事务直到当前事务提交）
  SELECT status, version
    INTO current_status, current_version
    FROM demands
   WHERE id = target_demand_id
     FOR UPDATE;

  -- 2) 不存在
  IF current_status IS NULL THEN
    RETURN NULL;
  END IF;

  -- 3) 状态校验：只允许 OPEN 或 MATCHED 的订单被抢
  IF current_status NOT IN ('OPEN', 'MATCHED') THEN
    RETURN NULL;
  END IF;

  -- 4) 原子更新
  UPDATE demands
     SET status             = 'ACCEPTED',
         matched_provider_id = provider_id,
         version            = current_version + 1
   WHERE id = target_demand_id;

  -- 5) 返回完整行（供 API 路由继续创建 contract）
  RETURN row_to_json(d.*) FROM demands d WHERE d.id = target_demand_id;
END;
$$;
