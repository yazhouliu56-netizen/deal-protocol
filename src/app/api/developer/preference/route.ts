import { NextResponse } from "next/server"
import { withAuth } from "@/lib/api-auth"
import { getServiceClient } from "@/lib/supabase-client"

export const POST = withAuth(async (req, user) => {
  const supabase = getServiceClient()
  const { skills, preferenceEmbedding } = await req.json()

  if (
    !Array.isArray(skills) ||
    !Array.isArray(preferenceEmbedding) ||
    preferenceEmbedding.length !== 1536
  ) {
    return NextResponse.json(
      { error: "Parameter signature structural validation failed." },
      { status: 400 },
    )
  }

  const { data, error } = await supabase
    .from("developer_profiles")
    .upsert({
      id: user.id,
      skills: skills,
      preference_embedding: preferenceEmbedding,
      last_active_at: new Date().toISOString(),
    })
    .select()
    .single()

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 })
  }

  return NextResponse.json({ success: true, profile: data })
})
