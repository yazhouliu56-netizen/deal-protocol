import { getBrowserSupabase } from '@/lib/supabase-browser'
import { appendEvidence } from '@/modules/m11-evidence-log/evidence-chain'
import crypto from 'crypto'

export interface WebRTCCallMeta {
  contractId: string
  callerId: string
  receiverId: string
  durationSeconds: number
  snapshotHash: string
}

/**
 * Create a Supabase Realtime channel for WebRTC signaling.
 * Messages are exchanged via `signaling:offer`, `signaling:answer`,
 * and `signaling:ice-candidate` event types.
 */
export function createSignalingChannel(
  contractId: string,
  pc: RTCPeerConnection,
  localUserId: string,
) {
  const channel = getBrowserSupabase().channel(`webrtc:${contractId}`, {
    config: { broadcast: { ack: false, self: false } },
  })

  channel.on(
    'broadcast',
    { event: 'signaling:offer' },
    async ({ payload }) => {
      if (payload.target === localUserId && payload.offer) {
        await pc.setRemoteDescription(new RTCSessionDescription(payload.offer))
        const answer = await pc.createAnswer()
        await pc.setLocalDescription(answer)
        await channel.send({
          type: 'broadcast',
          event: 'signaling:answer',
          payload: { answer, target: payload.from },
        })
      }
    },
  )

  channel.on(
    'broadcast',
    { event: 'signaling:answer' },
    async ({ payload }) => {
      if (payload.target === localUserId && payload.answer) {
        await pc.setRemoteDescription(new RTCSessionDescription(payload.answer))
      }
    },
  )

  channel.on(
    'broadcast',
    { event: 'signaling:ice-candidate' },
    async ({ payload }) => {
      if (payload.target === localUserId && payload.candidate) {
        await pc.addIceCandidate(new RTCIceCandidate(payload.candidate))
      }
    },
  )

  channel.subscribe()

  return channel
}

/**
 * Send an offer to the peer via the signaling channel.
 */
export async function sendOffer(
  channel: ReturnType<typeof createSignalingChannel>,
  pc: RTCPeerConnection,
  localUserId: string,
  peerUserId: string,
) {
  const offer = await pc.createOffer()
  await pc.setLocalDescription(offer)
  await channel.send({
    type: 'broadcast',
    event: 'signaling:offer',
    payload: { offer, from: localUserId, target: peerUserId },
  })
}

/**
 * Send an ICE candidate to the peer.
 */
export async function sendIceCandidate(
  channel: ReturnType<typeof createSignalingChannel>,
  candidate: RTCIceCandidate,
  localUserId: string,
  peerUserId: string,
) {
  await channel.send({
    type: 'broadcast',
    event: 'signaling:ice-candidate',
    payload: { candidate, from: localUserId, target: peerUserId },
  })
}

/**
 * Compute SHA-256 hash of a video frame snapshot (blob URL or base64).
 */
export async function hashSnapshot(data: Blob | string): Promise<string> {
  let buffer: ArrayBuffer
  if (typeof data === 'string') {
    const encoder = new TextEncoder()
    buffer = encoder.encode(data).buffer
  } else {
    buffer = await data.arrayBuffer()
  }
  const hashBuf = await crypto.subtle.digest('SHA-256', buffer)
  return Array.from(new Uint8Array(hashBuf))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')
}

/**
 * Log a WebRTC inspection call as evidence in the chain.
 * Stores: contractId, both party IDs, call duration, and SHA-256 hash
 * of a video snapshot frame.
 */
export async function logWebRTCCallEvidence(
  contractId: string,
  callerId: string,
  receiverId: string,
  durationSeconds: number,
  snapshotHash?: string,
) {
  const payload = {
    contract_id: contractId,
    caller_id: callerId,
    receiver_id: receiverId,
    duration_seconds: durationSeconds,
    snapshot_hash: snapshotHash ?? null,
    call_type: 'WEBRTC_INSPECTION',
    timestamp: new Date().toISOString(),
  }

  const rawPayload = JSON.stringify(payload)
  const hash = crypto.createHash('sha256').update(rawPayload).digest('hex')

  const supabase = getBrowserSupabase()

  const { data: lastEvidence } = await supabase
    .from('evidence_log')
    .select('hash')
    .eq('order_id', contractId)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  const prevHash = (lastEvidence as { hash: string } | null)?.hash ?? 'GENESIS'

  await supabase.from('evidence_log').insert({
    order_id: contractId,
    event_type: 'WEBRTC_INSPECTION_CALL',
    payload,
    hash,
    prev_hash: prevHash,
    captured_by: callerId,
  })

  return { success: true, hash, durationSeconds }
}
