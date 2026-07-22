import { NextResponse } from "next/server"
import { withAuth } from "@/lib/api-auth"
import { getRouteClient } from "@/lib/supabase-route-client"
import { findMatches, type MatchCandidate } from "@/lib/matching/engine"
import { validateDemandTransition } from "@/lib/demand/state"

export const POST = withAuth(async (req, user, ...args) => {
  const { id } = await (args[0] as { params: Promise<{ id: string }> }).params
  const supabase = await getRouteClient()

  const { data: demand, error } = await supabase
    .from('demands')
    .select('*')
    .eq('id', id)
    .single()

  if (error || !demand) {
    return NextResponse.json({ error: "需求不存在" }, { status: 404 } )
  }

  const err = validateDemandTransition(demand.status, "MATCHED")
  if (err) return NextResponse.json({ error: err }, { status: 409 })

  let matches: MatchCandidate[] = []
  try {
    matches = await findMatches(demand.category ?? "其他")
  } catch {
    return NextResponse.json({ error: "匹配失败" }, { status: 500 })
  }

  if (matches.length > 0) {
    const { error: updateError } = await supabase
      .from('demands')
      .update({ matched_provider_id: matches[0].providerId, status: "MATCHED" })
      .eq('id', id)

    if (updateError) {
      console.error('Match update error:', updateError)
      return NextResponse.json({ error: "匹配更新失败" }, { status: 500 })
    }
  }

  return NextResponse.json({ matches })
})
