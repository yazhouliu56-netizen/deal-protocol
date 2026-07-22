'use client'

import { useEffect, useRef, useState, useCallback } from 'react'
import { getBrowserSupabase } from '@/lib/supabase-browser'

interface FinanceData {
  balance: number
  pendingWithdrawal: number
}

export function useFinanceRealtime(
  userId: string | undefined,
  initialData: FinanceData,
) {
  const [balance, setBalance] = useState(initialData.balance)
  const [pendingWithdrawal, setPendingWithdrawal] = useState(initialData.pendingWithdrawal)
  const [isBalanceAnimating, setIsBalanceAnimating] = useState(false)
  const animTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const triggerAnimation = useCallback(() => {
    setIsBalanceAnimating(true)
    if (animTimerRef.current) clearTimeout(animTimerRef.current)
    animTimerRef.current = setTimeout(() => setIsBalanceAnimating(false), 1500)
  }, [])

  useEffect(() => {
    if (!userId) return

    const supabase = getBrowserSupabase()

    const profileChannel = supabase
      .channel(`finance:profile:${userId}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'profiles',
          filter: `id=eq.${userId}`,
        },
        (payload) => {
          const newBalance = (payload.new as Record<string, unknown>).balance
          if (typeof newBalance === 'number') {
            setBalance(newBalance)
            triggerAnimation()
          }
        },
      )
      .subscribe()

    const withdrawalChannel = supabase
      .channel(`finance:withdrawals:${userId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'withdrawal_requests',
          filter: `provider_id=eq.${userId}`,
        },
        () => {
          triggerAnimation()
        },
      )
      .subscribe()

    return () => {
      supabase.removeChannel(profileChannel)
      supabase.removeChannel(withdrawalChannel)
      if (animTimerRef.current) clearTimeout(animTimerRef.current)
    }
  }, [userId, triggerAnimation])

  return { balance, pendingWithdrawal, isBalanceAnimating, setBalance, setPendingWithdrawal }
}
