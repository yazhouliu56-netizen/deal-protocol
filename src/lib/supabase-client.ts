import { createClient, type SupabaseClient } from '@supabase/supabase-js'

let client: SupabaseClient | null = null

// Server-side safe client (for API routes, lib files)
export function getSupabase(): SupabaseClient {
  if (client) return client

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

  if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error(
      'Missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY env vars',
    )
  }

  client = createClient(supabaseUrl, supabaseAnonKey, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  })

  return client
}

// Admin client with service_role key (for privileged operations)
let serviceClient: SupabaseClient | null = null

export function getServiceClient(): SupabaseClient {
  if (serviceClient) return serviceClient

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

  serviceClient = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  })

  return serviceClient
}

// 测试用：注入 mock service client
export function __setServiceClient(mock: SupabaseClient): void {
  serviceClient = mock
}

export function __resetServiceClient(): void {
  serviceClient = null
}

// 测试用：注入 mock client
export function __setSupabaseClient(mock: SupabaseClient): void {
  client = mock
}

export function __resetSupabaseClient(): void {
  client = null
}
