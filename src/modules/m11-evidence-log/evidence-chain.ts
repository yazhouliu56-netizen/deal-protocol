import { getSupabase } from '@/lib/supabase-client'

async function sha256Hex(data: string): Promise<string> {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(data))
  return Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, '0')).join('')
}

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
  const content = JSON.stringify({
    orderId,
    eventType: input.eventType,
    payload: enrichedPayload,
    prevHash,
    timestamp,
  })
  const currHash = await sha256Hex(content)

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

  for (let i = 0; i < records.length; i++) {
    const record = records[i]
    const prevHash = i === 0 ? 'GENESIS' : records[i - 1]!.hash

    const content = JSON.stringify({
      orderId,
      eventType: record.event_type,
      payload: record.payload,
      prevHash,
      timestamp: record.created_at,
    })
    const expectedHash = await sha256Hex(content)

    if (record.hash !== expectedHash) {
      return { valid: false, brokenAt: record.id }
    }

    if (record.prev_hash !== prevHash) {
      return { valid: false, brokenAt: record.id }
    }
  }

  return { valid: true }
}
