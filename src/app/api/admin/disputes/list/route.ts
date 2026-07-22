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

  const { data: disputes, error } = await svc
    .from("order_disputes")
    .select("id, order_id, initiator_id, reason, evidence_urls, status, created_at")
    .order("created_at", { ascending: false })

  if (error) {
    return NextResponse.json({ disputes: [] })
  }

  const orderIds = disputes.map((d) => d.order_id).filter(Boolean)

  let demandMap = new Map<string, { title: string; price: number }>()
  if (orderIds.length > 0) {
    const { data: demands } = await svc
      .from("demands")
      .select("id, title, price")
      .in("id", orderIds)

    if (demands) {
      demandMap = new Map(demands.map((d) => [d.id, { title: d.title ?? "Unknown", price: d.price ?? 0 }]))
    }
  }

  const result = disputes.map((d) => ({
    ...d,
    demand_title: demandMap.get(d.order_id)?.title ?? null,
    demand_price: demandMap.get(d.order_id)?.price ?? null,
  }))

  return NextResponse.json(result)
})
