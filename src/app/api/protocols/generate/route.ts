import { NextResponse } from "next/server"
import { withAuth } from "@/lib/api-auth"
import { getRouteClient } from "@/lib/supabase-route-client"
import { classifyDemand } from "@/lib/demand/classifier"

export const POST = withAuth(async (req, user) => {
  try {
    const { text } = await req.json()
    if (!text || typeof text !== "string") {
      return NextResponse.json({ error: "Missing input text" }, { status: 400 })
    }

    const supabase = await getRouteClient()
    const classified = await classifyDemand(text)

    const { data: config } = await supabase
      .from('category_configs')
      .select('*')
      .eq('category', classified.dbCategory)
      .single()

    if (!config) {
      return NextResponse.json({ error: `Category "${classified.dbCategory}" not configured` }, { status: 404 })
    }

    const schema = config.schema_json as Record<string, unknown>
    const riskTier = config.risk_tier as string

    return NextResponse.json({
      protocol_json: {},
      schema_json: schema,
      risk_tier: riskTier,
      category: classified.dbCategory,
      title: classified.title,
      description: classified.description,
    })
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Generation failed" }, { status: 500 })
  }
})
