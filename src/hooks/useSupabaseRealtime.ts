'use client'

import { useEffect, useState, useRef, useCallback } from 'react'
import { getBrowserSupabase } from '@/lib/supabase-browser'

export interface ChatMessage {
  id: string
  orderId: string
  senderId: string
  content: string
  createdAt: string
  isRead?: boolean
}

export function findChangedField(
  oldData: Record<string, unknown>,
  newData: Record<string, unknown>,
): string | null {
  const skipKeys = new Set(['updated_at', 'id', 'order_id'])
  for (const key of Object.keys(newData)) {
    if (skipKeys.has(key)) continue
    if (oldData[key] !== newData[key]) return key
  }
  return null
}

export function useSupabaseRealtime(orderId: string, currentUserId: string) {
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [isPeerTyping, setIsPeerTyping] = useState(false)
  const [updatedField, setUpdatedField] = useState<string | null>(null)
  const highlightTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const channelRef = useRef<ReturnType<ReturnType<typeof getBrowserSupabase>['channel']> | null>(null)

  useEffect(() => {
    if (!orderId) return

    const supabase = getBrowserSupabase()
    const channelName = `realtime:order:${orderId}`

    const channel = supabase.channel(channelName, {
      config: { presence: { key: currentUserId } },
    })
    channelRef.current = channel

    channel.on(
      'postgres_changes',
      {
        event: 'INSERT',
        schema: 'public',
        table: 'messages',
        filter: `order_id=eq.${orderId}`,
      },
      (payload) => {
        const newMsg = payload.new as Record<string, unknown>
        setMessages((prev) => [
          ...prev,
          {
            id: String(newMsg.id),
            orderId: String(newMsg.order_id),
            senderId: String(newMsg.sender_id),
            content: String(newMsg.content),
            createdAt: String(newMsg.created_at),
          },
        ])
      },
    )

    channel.on('presence', { event: 'sync' }, () => {
      const state = channel.presenceState()
      const isOthersTyping = Object.keys(state).some(
        (key) => key !== currentUserId && (state[key] as unknown as Array<Record<string, unknown>>)?.[0]?.isTyping,
      )
      setIsPeerTyping(isOthersTyping)
    })

    channel.on(
      'postgres_changes',
      {
        event: 'UPDATE',
        schema: 'public',
        table: 'protocols',
        filter: `order_id=eq.${orderId}`,
      },
      (payload) => {
        const oldData = payload.old as Record<string, unknown>
        const newData = payload.new as Record<string, unknown>
        const changedField = findChangedField(oldData, newData)
        if (changedField) {
          setUpdatedField(changedField)
          if (highlightTimerRef.current) clearTimeout(highlightTimerRef.current)
          highlightTimerRef.current = setTimeout(() => setUpdatedField(null), 2500)
        }
      },
    )

    channel.subscribe()

    return () => {
      supabase.removeChannel(channel)
      channelRef.current = null
      if (highlightTimerRef.current) clearTimeout(highlightTimerRef.current)
    }
  }, [orderId, currentUserId])

  const sendTypingStatus = useCallback(
    (isTyping: boolean) => {
      channelRef.current?.track({ isTyping, user_id: currentUserId })
    },
    [currentUserId],
  )

  return { messages, isPeerTyping, updatedField, sendTypingStatus }
}
