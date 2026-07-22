import { getServiceClient } from './supabase-client'

const CHANNEL_NAME = 'order-events'

export async function emitEvent(event: {
  type: string
  id: string
  action: string
  userId?: string
  metadata?: Record<string, unknown>
}) {
  const svc = getServiceClient()
  await svc.channel(CHANNEL_NAME).send({
    type: 'broadcast',
    event: 'order-update',
    payload: event,
  })
}

export function subscribeToEvents(
  filter: (event: {
    type: string
    id: string
    action: string
    userId?: string
    metadata?: Record<string, unknown>
  }) => boolean,
  callback: (event: {
    type: string
    id: string
    action: string
    userId?: string
    metadata?: Record<string, unknown>
  }) => void,
): () => void {
  const svc = getServiceClient()
  const channel = svc.channel(CHANNEL_NAME)

  channel.on('broadcast', { event: 'order-update' }, (payload) => {
    if (filter(payload.payload)) {
      callback(payload.payload)
    }
  })

  channel.subscribe()

  return () => {
    channel.unsubscribe()
  }
}
