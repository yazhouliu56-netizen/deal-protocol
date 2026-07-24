-- ============================================================
-- 20260724_anti_fraud.sql
-- P1-05: 反欺诈闭环交易检测 (§5.11)
-- ============================================================

CREATE OR REPLACE FUNCTION public.detect_circular_transactions(target_user_id UUID)
RETURNS TABLE(partner_id UUID, depth INT) AS $$
BEGIN
  RETURN QUERY
  WITH RECURSIVE trade_graph AS (
    SELECT customer_id AS u1, provider_id AS u2, 1 AS d
    FROM public.contracts
    WHERE customer_id = target_user_id OR provider_id = target_user_id
    UNION ALL
    SELECT c.customer_id, c.provider_id, tg.d + 1
    FROM public.contracts c
    INNER JOIN trade_graph tg ON c.customer_id = tg.u2
    WHERE tg.d < 5
  )
  SELECT DISTINCT u2 AS partner_id, d FROM trade_graph WHERE u2 = target_user_id AND d > 1;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
