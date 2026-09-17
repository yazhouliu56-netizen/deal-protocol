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

    // R11 双账本统一：余额真相源为 provider_wallets（018 已入 realtime publication；
    // profiles.balance 停写，旧订阅移除）。
    const walletChannel = supabase
      .channel(`finance:wallet:${userId}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'provider_wallets',
          filter: `provider_id=eq.${userId}`,
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
      supabase.removeChannel(walletChannel)
      supabase.removeChannel(withdrawalChannel)
      if (animTimerRef.current) clearTimeout(animTimerRef.current)
    }
  }, [userId, triggerAnimation])

  return { balance, pendingWithdrawal, isBalanceAnimating, setBalance, setPendingWithdrawal }
}
