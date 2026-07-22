// 行为图谱: IP/GPS 物理聚集检测
// 设计方案§5.11: 多个服务者/客户长期共用同一 IP 或 GPS 聚集

import { getServiceClient } from '@/lib/supabase-client'
import { appendEvidence } from '@/modules/m11-evidence-log/evidence-chain'

export interface ClusterResult {
  suspicious: boolean
  clusterType: 'ip' | 'gps' | 'hybrid'
  participants: string[]
  sharedValue: string
  hitCount: number
}

const CLUSTER_THRESHOLD = 3 // 同一 IP/GPS 出现 N 次以上标记为可疑

/**
 * 检测 IP 聚集：多个不同 user 共享同一 IP
 * 通过检测协议创建时的 IP 聚合
 */
export async function detectIPClusters(days = 7): Promise<ClusterResult[]> {
  const supabase = getServiceClient()

  // 查询近期协议，按 demander_id 分组统计 IP 聚集
  // 实际 IP 存储在 evidence_log 的 payload 中
  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString()

  try {
    const { data: logs } = await supabase
      .from('evidence_log')
      .select('payload, captured_by')
      .eq('event_type', 'protocol_created')
      .gte('created_at', since)

    if (!logs || logs.length === 0) return []

    // 从 payload 中提取 IP
    const ipMap = new Map<string, Set<string>>()
    for (const log of logs) {
      const payload = log.payload as Record<string, unknown> | null
      const ip = payload?.client_ip as string | undefined
      if (ip && log.captured_by) {
        if (!ipMap.has(ip)) ipMap.set(ip, new Set())
        ipMap.get(ip)!.add(log.captured_by)
      }
    }

    const results: ClusterResult[] = []
    for (const [ip, users] of ipMap.entries()) {
      if (users.size >= CLUSTER_THRESHOLD) {
        const result: ClusterResult = {
          suspicious: true,
          clusterType: 'ip',
          participants: Array.from(users),
          sharedValue: ip,
          hitCount: users.size,
        }
        results.push(result)

        await appendEvidence({
          eventType: 'fraud_ip_cluster',
          payload: result as unknown as Record<string, unknown>,
        })
      }
    }

    return results
  } catch {
    return []
  }
}

/**
 * 检测 GPS 聚集：多个 provider 长期共用同一 GPS 坐标
 */
export async function detectGPSClusters(days = 7): Promise<ClusterResult[]> {
  const supabase = getServiceClient()

  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString()

  try {
    // 从 evidence_log 中提取位置 ping
    const { data: logs } = await supabase
      .from('evidence_log')
      .select('payload, captured_by')
      .eq('event_type', 'location_ping')
      .gte('created_at', since)

    if (!logs || logs.length === 0) return []

    // 粗粒度 GPS 聚类（取整到 0.01°，约 1km 精度）
    const gpsMap = new Map<string, Set<string>>()
    for (const log of logs) {
      const payload = log.payload as Record<string, unknown> | null
      const lat = payload?.lat as number | undefined
      const lng = payload?.lng as number | undefined
      if (lat !== undefined && lng !== undefined && log.captured_by) {
        const roundedKey = `${Math.round(lat * 100) / 100},${Math.round(lng * 100) / 100}`
        if (!gpsMap.has(roundedKey)) gpsMap.set(roundedKey, new Set())
        gpsMap.get(roundedKey)!.add(log.captured_by)
      }
    }

    const results: ClusterResult[] = []
    for (const [gpsKey, users] of gpsMap.entries()) {
      if (users.size >= CLUSTER_THRESHOLD) {
        const result: ClusterResult = {
          suspicious: true,
          clusterType: 'gps',
          participants: Array.from(users),
          sharedValue: gpsKey,
          hitCount: users.size,
        }
        results.push(result)

        await appendEvidence({
          eventType: 'fraud_gps_cluster',
          payload: result as unknown as Record<string, unknown>,
        })
      }
    }

    return results
  } catch {
    return []
  }
}

/**
 * 全量反欺诈扫描
 * 设计方案§5.11: 综合 IP + GPS 检测
 */
export async function scanFraudClusters(): Promise<{
  ipClusters: ClusterResult[]
  gpsClusters: ClusterResult[]
}> {
  const [ipClusters, gpsClusters] = await Promise.all([
    detectIPClusters(),
    detectGPSClusters(),
  ])

  return { ipClusters, gpsClusters }
}
