import { NextResponse } from "next/server"
import { withAuth } from "@/lib/api-auth"
import { getServiceClient } from "@/lib/supabase-client"

export const POST = withAuth(async (req, user) => {
  const supabase = getServiceClient()
  const { embedding, limit = 10, threshold = 0.6 } = await req.json()

  if (!embedding || !Array.isArray(embedding) || embedding.length !== 1536) {
    return NextResponse.json({ error: "Invalid vector coordinates payload." }, { status: 400 })
  }

  const { data: matches, error } = await supabase.rpc("match_demands_hybrid", {
    p_developer_id: user.id,
    p_query_embedding: embedding,
    p_similarity_threshold: threshold,
    p_match_count: limit,
  })

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 })
  }

  return NextResponse.json(matches || [])
})
