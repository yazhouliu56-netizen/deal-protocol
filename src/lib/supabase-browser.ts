'use client'

import { createBrowserClient } from '@supabase/ssr'
import type { SupabaseClient } from '@supabase/supabase-js'

let client: SupabaseClient | null = null

// Browser-only client (for client components and hooks)
export function getBrowserSupabase(): SupabaseClient {
  if (client) return client

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

  if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error('Missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY env vars')
  }

  client = createBrowserClient(supabaseUrl, supabaseAnonKey, {
    cookies: {
      get(name: string) {
        const cookie = document.cookie
          .split('; ')
          .find((row) => row.startsWith(name + '='))
        return cookie ? cookie.split('=')[1] : undefined
      },
      set(name: string, value: string, options: Record<string, unknown>) {
        const parts = [`${name}=${value}`, 'path=/']
        if (options?.maxAge) parts.push(`max-age=${options.maxAge}`)
        if (options?.domain) parts.push(`domain=${options.domain}`)
        document.cookie = parts.join('; ')
      },
      remove(name: string, options: Record<string, unknown>) {
        const parts = [`${name}=`, 'path=/', 'max-age=0']
        if (options?.domain) parts.push(`domain=${options.domain}`)
        document.cookie = parts.join('; ')
      },
    },
  })
  return client
}
