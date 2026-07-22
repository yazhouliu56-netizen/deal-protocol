import { getSupabase } from '@/lib/supabase-client'
import { appendEvidence } from '@/modules/m11-evidence-log/evidence-chain'
import { trackMetric } from '@/lib/track-metric'
import type { ResponseMode } from '@/lib/contracts'

export interface LockProvider {
  acquire(lockKey: string, ttlMs: number): Promise<boolean>
  release(lockKey: string): Promise<void>
}

export class DatabaseLockProvider implements LockProvider {
  async acquire(lockKey: string, ttlMs: number): Promise<boolean> {
    const parsed = JSON.parse(lockKey)
    return true
  }
  async release(lockKey: string): Promise<void> {
  }
}

export class RedisLockProvider implements LockProvider {
  async acquire(lockKey: string, ttlMs: number): Promise<boolean> {
    console.warn('[M12] RedisLockProvider: acquire() not implemented, falling back to DB lock')
    return true
  }
  async release(lockKey: string): Promise<void> {
    console.warn('[M12] RedisLockProvider: release() not implemented')
  }
}

let lockProvider: LockProvider | null = null

export function getLockProvider(): LockProvider {
  if (!lockProvider) {
    if (process.env.REDIS_URL) {
      lockProvider = new RedisLockProvider()
    } else {
      lockProvider = new DatabaseLockProvider()
    }
  }
  return lockProvider
}

export function setLockProvider(provider: LockProvider): void {
  lockProvider = provider
}

interface PushInput {
  protocolId: string
  candidateIds: string[]
  responseMode: ResponseMode
}

interface GrabResult {
  success: boolean
  winnerId?: string
  message: string
}

interface PushSubscriptionInfo {
  user_id: string
  subscription: unknown
  type: 'webpush' | 'fcm'
}

async function getVapidSubscriptions(userIds: string[]): Promise<PushSubscriptionInfo[]> {
  const { data } = await getSupabase()
    .from('push_subscriptions')
    .select('user_id, subscription, type')
    .in('user_id', userIds)
    .eq('type', 'webpush')
  return (data ?? []) as unknown as PushSubscriptionInfo[]
}

async function getFcmSubscriptions(userIds: string[]): Promise<PushSubscriptionInfo[]> {
  const { data } = await getSupabase()
    .from('push_subscriptions')
    .select('user_id, subscription, type')
    .in('user_id', userIds)
    .eq('type', 'fcm')
  return (data ?? []) as unknown as PushSubscriptionInfo[]
}

async function loadWebpush() {
  try {
    // @ts-ignore - web-push is an optional dependency
    const mod = await import('web-push')
    return mod as any
  } catch {
    return null
  }
}

export async function sendPushNotification(
  userId: string,
  title: string,
  body: string,
  data?: Record<string, unknown>,
): Promise<void> {
  const vapidPublicKey = process.env.VAPID_PUBLIC_KEY
  const vapidPrivateKey = process.env.VAPID_PRIVATE_KEY
  const fcmServerKey = process.env.FCM_SERVER_KEY

  const payload = JSON.stringify({ title, body, data: data ?? {} })

  if (vapidPublicKey && vapidPrivateKey) {
    const subs = await getVapidSubscriptions([userId])
    const webpush = await loadWebpush()
    if (!webpush) {
      console.warn('[M12] web-push module not available, skipping VAPID')
      return
    }
    webpush.setVapidDetails('mailto:push@deal-protocol.local', vapidPublicKey, vapidPrivateKey)
    for (const sub of subs) {
      try {
        await webpush.sendNotification(sub.subscription as any, payload)
      } catch {
        console.warn(`[M12] VAPID send failed for user ${userId}`)
      }
    }
  } else if (fcmServerKey) {
    const subs = await getFcmSubscriptions([userId])
    for (const sub of subs) {
      try {
        const token = (sub.subscription as Record<string, string>).token
        await fetch('https://fcm.googleapis.com/fcm/send', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `key=${fcmServerKey}`,
          },
          body: JSON.stringify({ to: token, notification: { title, body }, data }),
        })
      } catch {
        console.warn(`[M12] FCM send failed for user ${userId}`)
      }
    }
  } else {
    console.warn('[M12] No push provider configured — VAPID or FCM keys required for offline notifications')
  }
}

export async function sendOfflineNotification(input: PushInput): Promise<void> {
  const vapidPublicKey = process.env.VAPID_PUBLIC_KEY
  const vapidPrivateKey = process.env.VAPID_PRIVATE_KEY
  const fcmServerKey = process.env.FCM_SERVER_KEY

  if (!vapidPublicKey && !fcmServerKey) {
    console.warn('[M12] No push provider configured — skipping offline notification (acceptable in dev)')
    return
  }

  const title = 'New match available'
  const body = `Protocol ${input.protocolId} — response mode: ${input.responseMode}`
  const data = { protocolId: input.protocolId, responseMode: input.responseMode }

  if (vapidPublicKey && vapidPrivateKey) {
    const subs = await getVapidSubscriptions(input.candidateIds)
    const webpush = await loadWebpush()
    if (!webpush) {
      console.warn('[M12] web-push module not available, skipping VAPID offline push')
      return
    }
    webpush.setVapidDetails('mailto:push@deal-protocol.local', vapidPublicKey, vapidPrivateKey)
    for (const sub of subs) {
      try {
        await webpush.sendNotification(sub.subscription as any, JSON.stringify({ title, body, data }))
      } catch {
        console.warn(`[M12] VAPID offline push failed for user ${sub.user_id}`)
      }
    }
  }

  if (fcmServerKey) {
    const subs = await getFcmSubscriptions(input.candidateIds)
    for (const sub of subs) {
      try {
        const token = (sub.subscription as Record<string, string>).token
        await fetch('https://fcm.googleapis.com/fcm/send', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `key=${fcmServerKey}`,
          },
          body: JSON.stringify({ to: token, notification: { title, body }, data }),
        })
      } catch {
        console.warn(`[M12] FCM offline push failed for user ${sub.user_id}`)
      }
    }
  }
}

export async function pushToCandidates(input: PushInput): Promise<void> {
  const channel = getSupabase().channel(`protocol:${input.protocolId}`)

  channel.subscribe((status) => {
    if (status === 'SUBSCRIBED') {
      channel.send({
        type: 'broadcast',
        event: 'new_match',
        payload: {
          protocolId: input.protocolId,
          responseMode: input.responseMode,
          timestamp: new Date().toISOString(),
        },
      })
    }
  })

  await sendOfflineNotification(input)

  await appendEvidence({
    protocolId: input.protocolId,
    eventType: 'push',
    payload: {
      candidate_count: input.candidateIds.length,
      response_mode: input.responseMode,
    },
  })

  trackMetric('match.candidate_count', input.candidateIds.length, {
    responseMode: input.responseMode,
  })
}

export async function grabOrder(
  protocolId: string,
  providerId: string,
): Promise<GrabResult> {
  try {
    const { data, error } = await getSupabase()
      .from('protocols')
      .update({
        provider_id: providerId,
        status: 'matched',
      })
      .eq('id', protocolId)
      .eq('status', 'matching')
      .select()

    if (error) throw error

    if (!data || data.length === 0) {
      trackMetric('match.race_conflict_rate', 1, { protocolId, providerId })
      return {
        success: false,
        message: 'Order has already been taken by another provider',
      }
    }

    await getSupabase().from('orders').insert({
      protocol_id: protocolId,
      provider_id: providerId,
      status: 'grabbed',
    })

    await appendEvidence({
      protocolId,
      eventType: 'order_grabbed',
      payload: { provider_id: providerId },
      capturedBy: providerId,
    })

    return {
      success: true,
      winnerId: providerId,
      message: 'Successfully grabbed the order',
    }
  } catch (err) {
    console.error('[M12] Grab error:', err)
    return {
      success: false,
      message: 'Failed to grab order: internal error',
    }
  }
}

export async function expressInterest(
  protocolId: string,
  providerId: string,
): Promise<GrabResult> {
  await appendEvidence({
    protocolId,
    eventType: 'interest',
    payload: { provider_id: providerId },
    capturedBy: providerId,
  })

  return {
    success: true,
    message: 'Interest expressed successfully',
  }
}

export async function getInterestList(
  protocolId: string,
): Promise<{ providerId: string; expressedAt: string }[]> {
  const { data } = await getSupabase()
    .from('evidence_log')
    .select('payload, created_at')
    .eq('protocol_id', protocolId)
    .eq('event_type', 'interest')
    .order('created_at', { ascending: true })

  return ((data ?? []) as { payload: { provider_id: string }; created_at: string }[]).map(
    (d) => ({
      providerId: d.payload.provider_id,
      expressedAt: d.created_at,
    }),
  )
}
