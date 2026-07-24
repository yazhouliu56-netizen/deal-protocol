import { NextResponse, after } from "next/server"
import { withAuth } from "@/lib/api-auth"
import { getRouteClient } from "@/lib/supabase-route-client"
import type { PostgrestSingleResponse } from "@supabase/supabase-js"

// P0-01: 统一代码路径 — demands 路由转写至 protocols/contracts 核心数据源
// 保持旧 API 接口不变，但主力读写走 protocols 表

function toProtocolCoreFields(body: Record<string, unknown>, info?: Record<string, unknown>): Record<string, unknown> {
  const title = info?.title ?? body.title
  const desc = info?.description ?? body.description
  const address = info?.address ?? body.address
  return {
    title: title ?? '',
    description: [desc, address && `📍 ${address}`].filter(Boolean).join('\n'),
  }
}

function toProtocolCategoryFields(body: Record<string, unknown>, info?: Record<string, unknown>): Record<string, unknown> {
  const fields: Record<string, unknown> = {}
  if (info?.budgetMin != null) fields.budget_min = info.budgetMin
  if (info?.budgetMax != null) fields.budget_max = info.budgetMax
  if (body.budgetMin != null) fields.budget_min = body.budgetMin
  if (body.budgetMax != null) fields.budget_max = body.budgetMax
  if (body.budget != null) fields.budget = body.budget
  if (info?.urgency) fields.urgency = info.urgency
  if (body.urgency) fields.urgency = body.urgency
  return fields
}

function makeProtocolPayload(userId: string, body: Record<string, unknown>, info?: Record<string, unknown>) {
  const category = (info?.category ?? body.category) as string
  const riskTier = 'low'
  const responseMode = 'grab_first'

  const payload: Record<string, unknown> = {
    demander_id: userId,
    category,
    core_fields: toProtocolCoreFields(body, info),
    category_fields: toProtocolCategoryFields(body, info),
    status: 'pending_confirm',
    risk_tier: riskTier,
    response_mode: responseMode,
  }
  if (body.longitude != null && body.latitude != null) {
    payload.location = `POINT(${body.longitude} ${body.latitude})`
  }
  return payload
}

async function autoMatchProtocol(supabase: ReturnType<typeof import('@/lib/supabase-route-client')['getRouteClient'] extends (...args: never[]) => infer R ? R : never>, protocolId: string, category: string): Promise<void> {
  try {
    const { routeProtocol } = await import("@/modules/m06-matching-routing/matcher")
    const { data: protocol } = await supabase
      .from('protocols')
      .select('category_fields, location')
      .eq('id', protocolId)
      .single()
    if (!protocol) return
    const catFields = protocol.category_fields as Record<string, unknown> ?? {}
    const loc = protocol.location as { x?: number; y?: number; coordinates?: number[] } | null
    const lat = catFields.latitude as number ?? loc?.coordinates?.[1] ?? 0
    const lng = catFields.longitude as number ?? loc?.coordinates?.[0] ?? 0
    await routeProtocol({ protocolId, latitude: lat, longitude: lng, category })
  } catch (err) {
    console.warn("Auto-match (unified) skipped:", err)
  }
}

export const POST = withAuth(async (req, user) => {
  const supabase = await getRouteClient()

  try {
    const body = await req.json()

    if (body.text && !body.title) {
      const { classifyDemand } = await import("@/lib/demand/classifier")
      const info = await classifyDemand(body.text)

      const payload = makeProtocolPayload(user.id, body, info)
      const { data: protocol, error } = await supabase.from('protocols').insert(payload).select().single()
      if (error) throw error

      after(async () => {
        const category = info.category as string
        if (category) await autoMatchProtocol(supabase, protocol!.id, category)
      })

      return NextResponse.json({ demand: { id: protocol.id, ...payload }, classified: info }, { status: 201 })
    }

    const payload = makeProtocolPayload(user.id, body)
    const { data: protocol, error } = await supabase.from('protocols').insert(payload).select().single()
    if (error) throw new Error(`Protocol insert error: ${error.message} (${JSON.stringify(error)})`)

    after(async () => {
      const category = body.category as string
      if (category) await autoMatchProtocol(supabase, protocol!.id, category)
    })

    return NextResponse.json({ id: protocol.id }, { status: 201 })
  } catch (err) {
    console.error("Create demand error:", err)
    const msg = err instanceof Error ? err.message : String(err)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
})

export const GET = withAuth(async (req, user) => {
  const supabase = await getRouteClient()
  const { searchParams } = new URL(req.url)
  const status = searchParams.get("status")

  let query = supabase.from('protocols').select('*').eq('demander_id', user.id)
  if (status) query = query.eq('status', status)
  query = query.order('created_at', { ascending: false }).limit(20)

  const { data: protocols, error } = await query
  if (error) throw error

  return NextResponse.json({ demands: protocols })
})
