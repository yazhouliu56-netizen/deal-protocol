import { NextResponse } from "next/server"
import { withAuth } from "@/lib/api-auth"
import { getRouteClient } from "@/lib/supabase-route-client"
import { getServiceClient } from "@/lib/supabase-client"
import { appendEvidence } from "@/modules/m11-evidence-log/evidence-chain"
import { routeProtocol } from "@/modules/m06-matching-routing/matcher"
import { checkRateLimit, rateLimitResponse, RULE_DEFAULT } from "@/lib/rate-limit"

export const POST = withAuth(async (req, user) => {
  const userResult = checkRateLimit(`tip:user:${user.id}`, RULE_DEFAULT)
  if (!userResult.allowed) return rateLimitResponse(userResult.resetAt)

  const svc = getServiceClient()
  const url = new URL(req.url)
  const id = url.pathname.split('/')[3]

  const { tipAmount } = await req.json()
  if (typeof tipAmount !== 'number' || tipAmount <= 0) {
    return NextResponse.json({ error: 'tipAmount must be a positive number' }, { status: 400 })
  }

  const { data: protocol } = await svc
    .from('protocols')
    .select('id, demander_id, category, core_fields, category_fields, location')
    .eq('id', id)
    .single()

  if (!protocol) {
    return NextResponse.json({ error: 'Protocol not found' }, { status: 404 })
  }
  if (protocol.demander_id !== user.id) {
    return NextResponse.json({ error: 'Only the demander can add a tip' }, { status: 403 })
  }

  const oldCore = (protocol.core_fields ?? {}) as Record<string, unknown>
  const currentBudget = (protocol.category_fields as Record<string, unknown> ?? {}).budget ?? 0
  const newBudget = Number(currentBudget) + tipAmount

  await svc
    .from('protocols')
    .update({
      core_fields: { ...oldCore, tip_amount: tipAmount, has_tip: true },
      category_fields: { ...(protocol.category_fields as Record<string, unknown> ?? {}), budget: newBudget },
    })
    .eq('id', id)

  await svc
    .from('contracts')
    .update({ amount: newBudget })
    .eq('id', id)

  await appendEvidence({
    protocolId: id,
    eventType: 'PRIORITY_TIP_ADDED',
    payload: { tip_amount: tipAmount, new_budget: newBudget },
  })

  const catFields = protocol.category_fields as Record<string, unknown> ?? {}
  const loc = protocol.location as { x?: number; y?: number; coordinates?: number[] } | null
  const lat = catFields.latitude as number ?? loc?.coordinates?.[1] ?? 0
  const lng = catFields.longitude as number ?? loc?.coordinates?.[0] ?? 0

  try {
    await routeProtocol({
      protocolId: id,
      latitude: lat,
      longitude: lng,
      category: protocol.category,
    })
  } catch (err) {
    console.warn('[Tip] Re-match failed:', err)
  }

  return NextResponse.json({ success: true, tip_amount: tipAmount, new_budget: newBudget })
})
