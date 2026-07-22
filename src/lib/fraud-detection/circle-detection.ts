// 行为图谱: 资金闭环检测
// 设计方案§5.11: PostgreSQL 递归 CTE 查找 3 度以内的资金闭环
// 使用 Supabase REST API 执行原始 SQL

import { getServiceClient } from '@/lib/supabase-client'
import { appendEvidence } from '@/modules/m11-evidence-log/evidence-chain'

export interface CircleResult {
  hasCircle: boolean
  circleDepth: number
  participants: string[]
  circleEdges: { from: string; to: string; protocolId: string }[]
}

/**
 * 检测资金闭环（A雇佣B，B雇佣C，C雇佣A）
 * 使用 PostgreSQL 递归 CTE 查找 3 度以内的闭环
 * 设计方案§5.11: 行为图谱反欺诈
 */
export async function detectFundCircles(depth = 3): Promise<CircleResult[]> {
  const supabase = getServiceClient()

  const { data, error } = await supabase.rpc('detect_fund_circles', {
    max_depth: depth,
  })

  if (error) {
    // RPC 不存在时使用 fallback: 查询最近协议关系
    console.warn('detect_fund_circles RPC not available, using fallback')
    return fallbackCircleDetection(depth)
  }

  if (!data || !Array.isArray(data)) return []

  const circles = data as CircleResult[]
  for (const circle of circles) {
    if (circle.hasCircle) {
      await appendEvidence({
        eventType: 'fraud_circle_detected',
        payload: {
          depth: circle.circleDepth,
          participants: circle.participants,
          edges: circle.circleEdges,
        },
      })
    }
  }

  return circles
}

/**
 * 降级方案: 通过 API 查询协议关系，在内存中检测闭环
 */
async function fallbackCircleDetection(maxDepth: number): Promise<CircleResult[]> {
  const supabase = getServiceClient()

  const { data: protocols } = await supabase
    .from('protocols')
    .select('id, demander_id, provider_id')
    .not('provider_id', 'is', null)
    .order('created_at', { ascending: false })
    .limit(500)

  if (!protocols || protocols.length < 3) return []

  const edges = protocols.map(p => ({
    from: p.demander_id,
    to: p.provider_id!,
    protocolId: p.id,
  }))

  const results: CircleResult[] = []

  // 简化版闭环检测: BFS 找回路
  for (const edge of edges) {
    const visited = new Set<string>()
    const path: string[] = []
    const pathEdges: typeof edges = []

    function dfs(node: string, depth: number, startNode: string): boolean {
      if (depth > maxDepth) return false
      if (depth > 0 && node === startNode && path.length >= 3) {
        results.push({
          hasCircle: true,
          circleDepth: depth,
          participants: [...path],
          circleEdges: [...pathEdges],
        })
        return true
      }
      if (visited.has(node)) return false

      visited.add(node)
      path.push(node)

      const outgoing = edges.filter(e => e.from === node)
      for (const e of outgoing) {
        pathEdges.push(e)
        if (dfs(e.to, depth + 1, startNode)) return true
        pathEdges.pop()
      }

      path.pop()
      visited.delete(node)
      return false
    }

    dfs(edge.from, 0, edge.from)
  }

  return results
}

// ── SQL 函数定义（需在 Supabase 中执行一次） ──
// 设计方案§5.11: 递归 CTE 检测
export const CREATE_CIRCLE_DETECTION_FN = `
CREATE OR REPLACE FUNCTION detect_fund_circles(max_depth INT DEFAULT 3)
RETURNS TABLE(
  has_circle BOOLEAN,
  circle_depth INT,
  participants TEXT[],
  circle_edges JSONB
) LANGUAGE plpgsql AS $$
BEGIN
  RETURN QUERY
  WITH RECURSIVE fund_flow AS (
    -- 基础边: 需求方 → 服务方
    SELECT
      demander_id::TEXT AS from_node,
      provider_id::TEXT AS to_node,
      id::TEXT AS protocol_id,
      1 AS depth,
      ARRAY[demander_id::TEXT, provider_id::TEXT] AS path,
      ARRAY[JSONB_BUILD_OBJECT('from', demander_id, 'to', provider_id, 'protocolId', id)] AS edges
    FROM protocols
    WHERE provider_id IS NOT NULL

    UNION ALL

    -- 递归步: 从当前节点的 provider 出发，找下一跳
    SELECT
      p.demander_id::TEXT,
      p.provider_id::TEXT,
      p.id::TEXT,
      f.depth + 1,
      f.path || p.provider_id::TEXT,
      f.edges || JSONB_BUILD_OBJECT('from', p.demander_id, 'to', p.provider_id, 'protocolId', p.id)
    FROM fund_flow f
    JOIN protocols p ON p.demander_id = f.to_node::UUID AND p.provider_id IS NOT NULL
    WHERE f.depth < max_depth
      AND NOT (p.provider_id::TEXT = ANY(f.path[1:array_length(f.path, 1)-1]))
  )
  SELECT
    TRUE AS has_circle,
    f.depth AS circle_depth,
    f.path AS participants,
    f.edges AS circle_edges
  FROM fund_flow f
  WHERE f.depth >= 3
    AND f.to_node = f.path[1]
  ORDER BY f.depth
  LIMIT 10;
END;
$$;
`

export const DROP_CIRCLE_DETECTION_FN = `DROP FUNCTION IF EXISTS detect_fund_circles;`
