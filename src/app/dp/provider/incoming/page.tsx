import React from "react"
import { getSupabase } from "@/lib/supabase-client"
import IncomingListClient from "@/app/provider/incoming/IncomingListClient"
import type { IncomingDemand } from "@/components/SwipeableCard"

export const dynamic = "force-dynamic"

/**
 * 协议专区 · 实时接单需求池（/dp/provider/incoming）
 * C16 收编落点：原 /provider/incoming 平移归位至 /dp 协议专区，SwipeableCard 滑动接单逻辑 100% 复用。
 */
export default async function DpIncomingPage() {
  const supabase = getSupabase()

  const { data: demands } = await supabase
    .from("demands")
    .select("id, title, price, latitude, longitude, created_at")
    .eq("status", "OPEN")
    .order("created_at", { ascending: false })

  return <IncomingListClient initialDemands={(demands as IncomingDemand[]) ?? []} />
}
