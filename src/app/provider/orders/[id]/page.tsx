import React from "react"
import { notFound } from "next/navigation"
import { getSupabase } from "@/lib/supabase-client"
import { auth } from "@/lib/auth"
import OrderFulfillmentClient from "./OrderFulfillmentClient"
import type { DemandDetail } from "./OrderFulfillmentClient"

export const dynamic = "force-dynamic"

interface PageProps {
  params: Promise<{ id: string }>
}

export default async function OrderDetailPage({ params }: PageProps) {
  const { id } = await params

  const session = await auth()
  const supabase = getSupabase()

  const { data: demand, error } = await supabase
    .from("demands")
    .select("id, title, price, status, latitude, longitude")
    .eq("id", id)
    .single()

  if (error || !demand) {
    notFound()
  }

  const providerId = session?.user?.id ?? ""

  return (
    <OrderFulfillmentClient
      initialDemand={demand as DemandDetail}
      providerId={providerId}
    />
  )
}
