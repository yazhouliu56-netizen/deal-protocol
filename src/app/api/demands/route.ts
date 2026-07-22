import { NextResponse, after } from "next/server"
import { withAuth } from "@/lib/api-auth"
import { getRouteClient } from "@/lib/supabase-route-client"

export const POST = withAuth(async (req, user) => {
  const supabase = await getRouteClient()

  try {
    const body = await req.json()

    if (body.text && !body.title) {
      const { classifyDemand } = await import("@/lib/demand/classifier")
      const { protocolRegistry } = await import("@/lib/protocol/registry")
      const info = await classifyDemand(body.text)
      const protocols = protocolRegistry.getAll()
      const matched = protocols.find(
        (p) => p.classificationKeywords?.some((kw: string) => kw === info.category),
      )
      const protocolId = matched?.id ?? "protocol_housekeeping"

      const payload: Record<string, unknown> = {
        customer_id: user.id,
        title: info.title,
        description: [info.description, info.address && `📍 ${info.address}`].filter(Boolean).join('\n'),
        category: info.category,
        protocol_id: protocolId,
        budget_min: info.budgetMin,
        budget_max: info.budgetMax,
        urgency: info.urgency,
      }
      if (body.longitude != null && body.latitude != null) {
        payload.location = `POINT(${body.longitude} ${body.latitude})`
      }

      const { data: demand, error } = await supabase.from('demands').insert(payload).select().single()
      if (error) throw error

      after(async () => {
        try {
          const { findMatches } = await import("@/lib/matching/engine")
          const matches = await findMatches(info.category)
          if (matches.length > 0) {
            await supabase
              .from('demands')
              .update({ matched_provider_id: matches[0].providerId })
              .eq('id', demand.id)
          }
        } catch (err) {
          console.warn("Auto-match (text mode) skipped:", err)
        }
      })

      return NextResponse.json({ demand, classified: info }, { status: 201 })
    }

    const { protocolRegistry } = await import("@/lib/protocol/registry")
    const protocols = protocolRegistry.getAll()
    const matched = protocols.find(
      (p) => p.classificationKeywords?.some((kw: string) => kw === body.category),
    )
    const protocolId = matched?.id ?? "protocol_housekeeping"

    const payload: Record<string, unknown> = {
      customer_id: user.id,
      title: body.title,
      description: [body.description, body.address && `📍 ${body.address}`].filter(Boolean).join('\n'),
      category: body.category,
      protocol_id: protocolId,
      urgency: body.urgency,
    }
    if (body.budgetMin != null) payload.budget_min = body.budgetMin
    if (body.budgetMax != null) payload.budget_max = body.budgetMax
    if (body.longitude != null && body.latitude != null) {
      payload.location = `POINT(${body.longitude} ${body.latitude})`
    }

    const { data: demand, error } = await supabase.from('demands').insert(payload).select().single()
    if (error) throw new Error(`Supabase insert error: ${error.message} (${JSON.stringify(error)})`)

    after(async () => {
      if (!body.category) return
      try {
        const { findMatches } = await import("@/lib/matching/engine")
        const matches = await findMatches(body.category)
        if (matches.length > 0) {
          await supabase
            .from('demands')
            .update({ matched_provider_id: matches[0].providerId })
            .eq('id', demand.id)
        }
      } catch (err) {
        console.warn("Auto-match (pre-classified mode) skipped:", err)
      }
    })

    return NextResponse.json({ id: demand.id }, { status: 201 })
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

  let query = supabase.from('demands').select('*').eq('customer_id', user.id)
  if (status) query = query.eq('status', status)
  query = query.order('created_at', { ascending: false }).limit(20)

  const { data: demands, error } = await query
  if (error) throw error

  return NextResponse.json({ demands })
})
