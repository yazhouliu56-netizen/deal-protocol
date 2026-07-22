'use client'

import { useEffect, useRef, useState } from 'react'
import { getBrowserSupabase } from '@/lib/supabase-browser'
import toast from 'react-hot-toast'

interface OrderRow {
  id: string
  status?: string
  service_phase?: string
  escrow_status?: string
  [key: string]: unknown
}

interface UseOrderRealtimeOptions {
  onChange?: (payload: OrderRow) => void
}

export function useOrderRealtime(
  initialOrder: { id: string; status?: string },
  options?: UseOrderRealtimeOptions,
) {
  const [order, setOrder] = useState(initialOrder)
  const [isLiveUpdated, setIsLiveUpdated] = useState(false)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const onChangeRef = useRef(options?.onChange)
  onChangeRef.current = options?.onChange

  useEffect(() => {
    const supabase = getBrowserSupabase()
    const channel = supabase
      .channel(`order:${initialOrder.id}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'orders',
          filter: `id=eq.${initialOrder.id}`,
        },
        (payload) => {
          const newData = payload.new as OrderRow
          const oldData = payload.old as OrderRow

          if (newData.status && newData.status !== oldData.status) {
            toast(`订单状态变更: ${oldData.status} → ${newData.status}`, { icon: '🔔' })
          }

          setOrder((prev) => ({ ...prev, ...newData }))
          setIsLiveUpdated(true)
          if (timerRef.current) clearTimeout(timerRef.current)
          timerRef.current = setTimeout(() => setIsLiveUpdated(false), 1500)

          onChangeRef.current?.(newData)
        },
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
      if (timerRef.current) clearTimeout(timerRef.current)
    }
  }, [initialOrder.id])

  return { order, isLiveUpdated }
}
