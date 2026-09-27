'use client'

import { createBrowserClient } from '@supabase/ssr'
import type { SupabaseClient } from '@supabase/supabase-js'

let client: SupabaseClient | null = null

// Browser-only client (for client components and hooks).
// 沙盒降级（2026-09-27 CI 血训）：env 缺席（CI/离线构建无 key）
// 返回 null 而不是抛错——抛错会在 SessionProvider 等启动路径上
// 白屏全站。调用方一律判空（tsc 强制枚举），缺席即访客/本地语义。
export function getBrowserSupabase(): SupabaseClient | null {
  if (client) return client

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

  if (!supabaseUrl || !supabaseAnonKey) {
    return null
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
