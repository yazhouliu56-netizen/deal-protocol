import { getSupabase } from '@/lib/supabase-client'
import { appendEvidence } from '@/modules/m11-evidence-log/evidence-chain'

export async function storeSOSAudioEvidence(
  contractId: string,
  userId: string,
  audioBuffer: ArrayBuffer,
  mimeType: string = 'audio/webm',
): Promise<{ success: boolean; hash?: string; evidenceId?: string }> {
  const hash = await sha256Buffer(audioBuffer)

  const { data: existing } = await getSupabase()
    .from('evidence_log')
    .select('id')
    .eq('hash', hash)
    .maybeSingle()

  if (existing) {
    return { success: true, hash, evidenceId: existing.id }
  }

  const record = await appendEvidence({
    protocolId: contractId,
    eventType: 'SOS_AUDIO_RECORDING',
    payload: {
      audio_hash: hash,
      user_id: userId,
      mime_type: mimeType,
      duration_seconds: 15,
    },
  })

  if (!record) {
    return { success: false }
  }

  await getSupabase()
    .from('notifications')
    .insert({
      user_id: userId,
      title: 'SOS Alert — Audio Evidence Recorded',
      body: `15s audio hash ${hash.slice(0, 12)}... stored in evidence chain.`,
      priority: 'P0',
      type: 'sos_audio',
      metadata: { contract_id: contractId, audio_hash: hash },
    })

  return { success: true, hash, evidenceId: record.id }
}

async function sha256Buffer(buffer: ArrayBuffer): Promise<string> {
  const hashBuf = await crypto.subtle.digest('SHA-256', buffer)
  return Array.from(new Uint8Array(hashBuf))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')
}
