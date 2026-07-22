import { NextResponse } from "next/server"
import { withAuth } from "@/lib/api-auth"
import { getServiceClient } from "@/lib/supabase-client"

export const GET = withAuth(async (req, user) => {
  const svc = getServiceClient()

  const { data: profile } = await svc
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single()

  if (!profile || profile.role !== "ADMIN") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  const { data: withdrawals, error } = await svc
    .from("withdrawal_requests")
    .select("*, profiles:provider_id(full_name, email)")
    .eq("status", "pending")
    .order("created_at", { ascending: true })

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json(withdrawals || [])
})
