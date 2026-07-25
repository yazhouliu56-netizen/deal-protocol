import { getSupabase } from '@/lib/supabase-client'
import { callLLM } from '@/lib/llm-adapter'

interface FulfillmentSnapshot {
  summary: string
  sentiment: 'positive' | 'neutral' | 'negative'
}

export async function generateFulfillmentSnapshot(
  contractId: string,
): Promise<FulfillmentSnapshot | null> {
  const { data: contract } = await getSupabase()
    .from('contracts')
    .select('id, protocol_id, demander_id, provider_id, amount, status, created_at')
    .eq('id', contractId)
    .single()

  if (!contract) return null

  const { data: evidenceRows } = await getSupabase()
    .from('evidence_log')
    .select('event_type, payload, created_at')
    .or(`protocol_id.eq.${contract.protocol_id},order_id.eq.${contractId}`)
    .order('created_at', { ascending: false })
    .limit(20)

  const checkinRecords = (evidenceRows ?? [])
    .filter((e) => e.event_type === 'geo_checkin')
    .map((e) => e.payload)

  const photoHashes = (evidenceRows ?? [])
    .filter((e) => e.event_type === 'photo_upload')
    .map((e) => e.payload?.hash ?? '')

  const systemPrompt = `You are a fulfillment verification assistant.
Analyze the check-in records, photo hashes, and evidence for a completed service order.
Output a JSON object with:
- "summary": a single Chinese sentence describing the fulfillment status
- "sentiment": one of "positive", "neutral", or "negative"

Example: {"summary": "服务商已完成上门服务，准时打卡并上传了完工照片，客户无投诉。", "sentiment": "positive"}
Output ONLY valid JSON, no other text.`

  const userPrompt = JSON.stringify({
    contract_id: contractId,
    amount: contract.amount,
    status: contract.status,
    checkin_count: checkinRecords.length,
    photo_hash_count: photoHashes.length,
    checkin_records: checkinRecords,
    photo_hashes: photoHashes,
  })

  try {
    const result = await callLLM([
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userPrompt },
    ])

    const parsed = JSON.parse(result)
    const summary: string = parsed.summary ?? '履约完成'
    const sentiment: 'positive' | 'neutral' | 'negative' =
      ['positive', 'neutral', 'negative'].includes(parsed.sentiment)
        ? parsed.sentiment
        : 'neutral'

    return { summary, sentiment }
  } catch {
    return { summary: '履约完成（自动确认）', sentiment: 'neutral' }
  }
}
