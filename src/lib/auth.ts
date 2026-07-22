import { createClient } from '@supabase/supabase-js'
import type { SupabaseClient } from '@supabase/supabase-js'

function getEnv() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  if (!supabaseUrl || !supabaseAnonKey) throw new Error('Missing env vars')
  return { supabaseUrl, supabaseAnonKey }
}

const SB_COOKIE = 'sb-eixqnwaxcnwtxiizmdfs-auth-token'

function extractAccessToken(cookieStr: string): string | null {
  const parts = cookieStr.split(';')
  for (const part of parts) {
    const [name, ...rest] = part.trim().split('=')
    if (name === SB_COOKIE) {
      try {
        const raw = decodeURIComponent(rest.join('='))
        const b64 = raw.replace(/^base64-/, '')
        const json = JSON.parse(Buffer.from(b64, 'base64').toString('utf-8'))
        return json.access_token ?? null
      } catch { return null }
    }
  }
  return null
}

function clientFromRequest(request: Request): SupabaseClient {
  const { supabaseUrl, supabaseAnonKey } = getEnv()
  const token = extractAccessToken(request.headers.get('cookie') || '')
  const headers: Record<string, string> = { apikey: supabaseAnonKey }
  if (token) headers['Authorization'] = `Bearer ${token}`
  return createClient(supabaseUrl, supabaseAnonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { headers },
  })
}

async function clientFromCookies(): Promise<SupabaseClient> {
  const { supabaseUrl, supabaseAnonKey } = getEnv()
  const { cookies } = await import('next/headers')
  const cookieStore = await cookies()
  const cookie = cookieStore.get(SB_COOKIE)
  const token = cookie ? extractAccessToken(`${SB_COOKIE}=${cookie.value}`) : null
  const headers: Record<string, string> = { apikey: supabaseAnonKey }
  if (token) headers['Authorization'] = `Bearer ${token}`
  return createClient(supabaseUrl, supabaseAnonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { headers },
  })
}

export async function auth(request?: Request) {
  const supabase = request
    ? clientFromRequest(request)
    : await clientFromCookies()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  return {
    supabase,
    user: mapUser(user),
  }
}

function mapUser(user: { id: string; email?: string | null; user_metadata?: Record<string, unknown> }) {
  const meta = user.user_metadata ?? {}
  return {
    id: user.id,
    email: user.email ?? '',
    name: (meta.name as string) ?? user.email?.split('@')[0] ?? '',
    role: (meta.role as string) ?? 'CUSTOMER',
    roles: (meta.roles as string) ?? '["CUSTOMER"]',
    phone: (meta.phone as string) ?? null,
  }
}

export const handlers = { GET: null, POST: null }
