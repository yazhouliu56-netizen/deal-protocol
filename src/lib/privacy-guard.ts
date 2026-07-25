import { randomBytes } from "crypto"
import { getSupabase } from "@/lib/supabase-client"

export function maskPhone(phone: string | null | undefined): string | null {
  if (!phone) return null
  const s = String(phone)
  if (s.length < 7) return s
  return s.slice(0, 3) + "****" + s.slice(-4)
}

export function maskPhoneWithLen(phone: string | null | undefined, prefixLen = 3, suffixLen = 4): string | null {
  if (!phone) return null
  const s = String(phone)
  if (s.length < prefixLen + suffixLen + 1) return maskPhone(s)
  return s.slice(0, prefixLen) + "*".repeat(s.length - prefixLen - suffixLen) + s.slice(-suffixLen)
}

interface VirtualNumber {
  id: string
  contractId: string
  proxyNumber: string
  targetNumber: string
  role: "provider" | "customer"
  expiresAt: Date
  createdAt: Date
}

const VIRTUAL_PREFIX = "1709"

export function generateProxyNumber(contractId: string, role: "provider" | "customer"): string {
  const hash = randomBytes(4).readUInt32BE(0) % 10000000
  return `${VIRTUAL_PREFIX}${String(hash).padStart(7, "0")}`
}

export async function allocateVirtualNumber(
  contractId: string,
  targetNumber: string,
  role: "provider" | "customer",
  ttlHours = 48,
): Promise<{ proxyNumber: string; expiresAt: Date }> {
  const supabase = getSupabase()
  const now = new Date()
  const expiresAt = new Date(now.getTime() + ttlHours * 3600000)

  const proxyNumber = generateProxyNumber(contractId, role)

  const { error } = await supabase
    .from("evidence_log")
    .insert({
      protocol_id: contractId,
      event_type: "virtual_number_allocated",
      payload: {
        proxy_number: proxyNumber,
        target_number: targetNumber,
        role,
        expires_at: expiresAt.toISOString(),
        ttl_hours: ttlHours,
      },
    })

  if (error) {
    console.warn("[PrivacyGuard] Failed to record virtual number allocation:", error.message)
  }

  return { proxyNumber, expiresAt }
}

export async function resolveProxyNumber(
  proxyNumber: string,
): Promise<{ targetNumber: string; expiresAt: Date } | null> {
  const supabase = getSupabase()

  const { data: records } = await supabase
    .from("evidence_log")
    .select("payload")
    .eq("event_type", "virtual_number_allocated")
    .order("created_at", { ascending: false })
    .limit(10)

  if (!records) return null

  for (const r of records) {
    const p = r.payload as Record<string, unknown>
    if (p.proxy_number !== proxyNumber) continue
    const expiresAt = new Date(p.expires_at as string)
    if (expiresAt < new Date()) return null
    return { targetNumber: p.target_number as string, expiresAt }
  }

  return null
}
