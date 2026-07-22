import { NextResponse } from "next/server"
import { withAuth } from "@/lib/api-auth"
import { getServiceClient } from "@/lib/supabase-client"

export const GET = withAuth(async (req, user) => {
  const supabase = getServiceClient()

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single()

  if (!profile || profile.role !== "ADMIN") {
    return NextResponse.json({ error: "Forbidden: Administrative clearance required." }, { status: 403 })
  }

  const { data: anomalies, error } = await supabase
    .from("profiles")
    .select("id, full_name, email, role, reputation_score, compliance_status")
    .in("compliance_status", ["WARNED", "SUSPENDED"])
    .order("reputation_score", { ascending: true })

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json(anomalies || [])
})
