'use client'

import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'
import { getBrowserSupabase } from '@/lib/supabase-browser'
import type { User } from '@supabase/supabase-js'

export interface SessionUser {
  id: string
  email: string
  name: string
  role: string
  roles: string
}

interface SessionContextValue {
  user: SessionUser | null
  loading: boolean
  refresh: () => Promise<void>
}

const SessionContext = createContext<SessionContextValue>({
  user: null,
  loading: true,
  refresh: async () => {},
})

export const useSession = () => useContext(SessionContext)

function mapUser(u: User): SessionUser {
  const meta = u.user_metadata ?? {}
  return {
    id: u.id,
    email: u.email ?? '',
    name: (meta.name as string) ?? u.email?.split('@')[0] ?? '',
    role: meta.role as string ?? 'CUSTOMER',
    roles: meta.roles as string ?? '["CUSTOMER"]',
  }
}

async function resolveRole(u: SessionUser): Promise<SessionUser> {
  try {
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), 3000)
    const res = await fetch('/api/profile', { signal: controller.signal })
    clearTimeout(timer)
    if (res.ok) {
      const data = await res.json()
      const profile = data.user
      if (profile?.role) u.role = profile.role
      if (profile?.roles) u.roles = profile.roles
    }
  } catch {}
  return u
}

export default function SessionProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<SessionUser | null>(null)
  const [loading, setLoading] = useState(true)

  const refresh = async () => {
    const supabase = getBrowserSupabase()
    const { data: { session } } = await supabase.auth.getSession()
    setUser(session?.user ? mapUser(session.user) : null)
    setLoading(false)
  }

  useEffect(() => {
    const supabase = getBrowserSupabase()

    supabase.auth.getSession().then(async ({ data: { session } }) => {
      const u = session?.user ? mapUser(session.user) : null
      const resolved = u ? await resolveRole(u) : null
      setUser(resolved)
      setLoading(false)
    })

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (_event, session) => {
      const u = session?.user ? mapUser(session.user) : null
      const resolved = u ? await resolveRole(u) : null
      setUser(resolved)
      setLoading(false)
    })

    return () => subscription.unsubscribe()
  }, [])

  return (
    <SessionContext.Provider value={{ user, loading, refresh }}>
      {children}
    </SessionContext.Provider>
  )
}
