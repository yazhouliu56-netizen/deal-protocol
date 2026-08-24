import { getSupabase } from '@/lib/supabase-client'
import { computeEvidenceHash, verifyEvidenceChain, type IEvidenceRow } from '@/base/safe/evidence-chain'

interface EvidenceInput {
  protocolId?: string
  orderId?: string
  eventType: string
  payload: Record<string, unknown>
  payloadRef?: string
  capturedBy?: string
  teamMemberId?: string
}

interface EvidenceRecord {
  id: string
  protocol_id: string | null
  order_id: string | null
  event_type: string
  payload: Record<string, unknown>
  payload_ref: string | null
  captured_by: string | null
  hash: string
  prev_hash: string | null
  created_at: string
}

export async function appendEvidence(input: EvidenceInput): Promise<EvidenceRecord | null> {
  const orderId = input.orderId ?? input.protocolId
  const filterField = input.orderId ? 'order_id' : 'protocol_id'
  const { data: lastEvidence } = await getSupabase()
    .from('evidence_log')
    .select('hash')
    .eq(filterField, orderId)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  const prevHash = (lastEvidence as { hash: string } | null)?.hash ?? 'GENESIS'

  const enrichedPayload = input.teamMemberId
    ? { ...input.payload, team_member_id: input.teamMemberId }
    : input.payload

  const timestamp = new Date().toISOString()
  // 哈希计算委托 Base 权威 SSOT（批次 3b：字节兼容历史公式，A 写 B 验）。
  const currHash = computeEvidenceHash(orderId, input.eventType, enrichedPayload, prevHash, timestamp)

  const { data, error } = await getSupabase()
    .from('evidence_log')
    .insert({
      protocol_id: input.protocolId ?? null,
      order_id: input.orderId ?? null,
      event_type: input.eventType,
      payload: enrichedPayload,
      payload_ref: input.payloadRef ?? null,
      captured_by: input.capturedBy ?? null,
      hash: currHash,
      prev_hash: prevHash,
      // 显式落盘哈希所用同一时间戳：修复 DB 默认值与 JS 时钟毫秒漂移导致的自校验假断裂。
      created_at: timestamp,
    })
    .select()
    .single()

  if (error) {
    console.error('[M11] Append error:', error)
    return null
  }

  return data as unknown as EvidenceRecord
}

export async function getEvidenceByProtocol(protocolId: string): Promise<EvidenceRecord[]> {
  const [protocolRes, orderRes] = await Promise.all([
    getSupabase()
      .from('evidence_log')
      .select('*')
      .eq('protocol_id', protocolId)
      .order('created_at', { ascending: true }),
    getSupabase()
      .from('evidence_log')
      .select('*')
      .eq('order_id', protocolId)
      .order('created_at', { ascending: true }),
  ])

  const seen = new Map<string, EvidenceRecord>()
  for (const item of protocolRes.data ?? []) {
    seen.set(item.id, item as EvidenceRecord)
  }
  for (const item of orderRes.data ?? []) {
    if (!seen.has(item.id)) {
      seen.set(item.id, item as EvidenceRecord)
    }
  }
  const merged = Array.from(seen.values())
  merged.sort(
    (a, b) =>
      new Date(a.created_at).getTime() - new Date(b.created_at).getTime(),
  )
  return merged
}

export async function verifyChain(orderId: string): Promise<{ valid: boolean; brokenAt?: string }> {
  const records = await getEvidenceByProtocol(orderId)
  if (records.length === 0) return { valid: true }

  // 链校验委托 Base 权威 SSOT（哈希重算 + prev_hash 链接 + 时间戳非严格单调）。
  const result = verifyEvidenceChain(orderId, records as readonly IEvidenceRow[])
  if (!result.valid) {
    const broken = records[result.brokenAtIndex]
    return { valid: false, brokenAt: broken?.id }
  }
  return { valid: true }
}
