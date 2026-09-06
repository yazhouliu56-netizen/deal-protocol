import React from "react"
import { notFound } from "next/navigation"
import { getRouteClient } from "@/lib/supabase-route-client"
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
  // Step3a：用户态 client（携带登录 JWT），RLS 按 matched_provider_id 放行；
  // 旧 anon 无会话 client 在 RLS 下对 ASSIGNED 单必落空 → notFound。
  const supabase = await getRouteClient()

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
