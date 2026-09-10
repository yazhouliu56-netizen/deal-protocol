import { NextResponse } from "next/server"
import { getServiceClient } from "@/lib/supabase-client"
import { checkRateLimit, rateLimitResponse, RULE_DEFAULT } from "@/lib/rate-limit"
import { METRIC_NAMES } from "@/lib/track-metric"

/**
 * 漏斗/性能遥测入库（P15 · L6 可观测）。
 * 匿名投流访客可直调，故不用 withAuth；滥用面由 IP 限流 + 允许名单 + 批次上限兜底。
 * 条文 #10：遥测恒不阻断主流程——任何失败都回 200 {stored:0}，客户端照常 fallback console。
 */
const ALLOW = new Set<string>(METRIC_NAMES as readonly string[])
const MAX_BATCH = 50
const MAX_TAG_KEYS = 10
const MAX_TAG_LEN = 128

export interface MetricIngestRow {
  name: string
  value: number
  tags: Record<string, string>
}

export function parseMetricsBatch(body: unknown): { ok: boolean; rows: MetricIngestRow[] } {
  const empty = { ok: false, rows: [] as MetricIngestRow[] }
  if (!body || typeof body !== "object") return empty
  const list = (body as { metrics?: unknown }).metrics
  if (!Array.isArray(list) || list.length === 0 || list.length > MAX_BATCH) return empty
  const rows: MetricIngestRow[] = []
  for (const m of list) {
    if (!m || typeof m !== "object") return empty
    const { name, value, tags } = m as { name?: unknown; value?: unknown; tags?: unknown }
    if (typeof name !== "string" || !ALLOW.has(name)) return empty
    if (typeof value !== "number" || !Number.isFinite(value)) return empty
    const clean: Record<string, string> = {}
    if (tags !== undefined) {
      if (!tags || typeof tags !== "object" || Array.isArray(tags)) return empty
      const entries = Object.entries(tags as Record<string, unknown>)
      if (entries.length > MAX_TAG_KEYS) return empty
      for (const [k, v] of entries) {
        if (typeof v !== "string") return empty
        if (k.length === 0 || k.length > MAX_TAG_LEN || v.length > MAX_TAG_LEN) return empty
        clean[k] = v
      }
    }
    rows.push({ name, value, tags: clean })
  }
  return { ok: true, rows }
}

function clientIp(req: Request): string {
  const h = req.headers.get("x-forwarded-for")
  if (h) return h.split(",")[0].trim().slice(0, 64) || "unknown"
  return "unknown"
}

export async function POST(req: Request) {
  const lim = checkRateLimit(`metrics:ingest:${clientIp(req)}`, RULE_DEFAULT)
  if (!lim.allowed) return rateLimitResponse(lim.resetAt)
  let body: unknown = null
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ stored: 0 })
  }
  const parsed = parseMetricsBatch(body)
  if (!parsed.ok) return NextResponse.json({ stored: 0 })
  try {
    const svc = getServiceClient()
    const { error } = await svc.from("metric_events").insert(parsed.rows)
    if (error) {
      console.warn("[metrics] insert failed", error.message)
      return NextResponse.json({ stored: 0 })
    }
    return NextResponse.json({ stored: parsed.rows.length })
  } catch (e) {
    console.warn("[metrics] insert threw", e instanceof Error ? e.message : e)
    return NextResponse.json({ stored: 0 })
  }
}
