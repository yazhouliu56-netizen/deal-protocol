import React from "react"
import { getSupabase } from "@/lib/supabase-client"
import IncomingListClient from "./IncomingListClient"
import type { IncomingDemand } from "@/components/SwipeableCard"

export const dynamic = "force-dynamic"

export default async function IncomingPage() {
  const supabase = getSupabase()

  const { data: demands } = await supabase
    .from("demands")
    .select("id, title, price, latitude, longitude, created_at")
    .eq("status", "OPEN")
    .order("created_at", { ascending: false })

  return <IncomingListClient initialDemands={(demands as IncomingDemand[]) ?? []} />
}
