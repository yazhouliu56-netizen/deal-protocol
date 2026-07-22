'use client'

import { useEffect, useState } from 'react'
import { getBrowserSupabase } from '@/lib/supabase-browser'
import type { User } from '@supabase/supabase-js'

export interface SessionUser {
  id: string
  email: string
  name: string
  role: string
  roles: string
}

export function useSupabaseSession() {
  const [user, setUser] = useState<SessionUser | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const supabase = getBrowserSupabase()

    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ? mapUser(session.user) : null)
      setLoading(false)
    })

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ? mapUser(session.user) : null)
      setLoading(false)
    })

    return () => subscription.unsubscribe()
  }, [])

  return { user, loading, isAuthenticated: !!user }
}

function mapUser(u: User): SessionUser {
  return {
    id: u.id,
    email: u.email ?? '',
    name: (u.user_metadata?.name as string) ?? u.email?.split('@')[0] ?? '',
    role: (u.user_metadata?.role as string) ?? 'CUSTOMER',
    roles: (u.user_metadata?.roles as string) ?? '["CUSTOMER"]',
  }
}
