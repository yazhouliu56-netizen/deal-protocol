import React from "react"
import { notFound } from "next/navigation"
import { getRouteClient } from "@/lib/supabase-route-client"
import { auth } from "@/lib/auth"
import AcceptanceCard from "./AcceptanceCard"

export const dynamic = "force-dynamic"

interface PageProps {
  params: Promise<{ id: string }>
}

export default async function DemandAcceptancePage({ params }: PageProps) {
  const { id } = await params

  const session = await auth()
  const userId = session?.user?.id
  if (!userId) {
    notFound()
  }

  // Step3b：用户态 client + 代码层三别名属主校验（RLS demands_select 同步放行）。
  const supabase = await getRouteClient()
  const { data: demand, error } = await supabase
    .from("demands")
    .select("id, title, price, status, released_at, demander_id, client_id, customer_id")
    .eq("id", id)
    .single()

  if (error || !demand) {
    notFound()
  }

  const isOwner =
    demand.demander_id === userId || demand.client_id === userId || demand.customer_id === userId
  if (!isOwner) {
    notFound()
  }

  return (
    <div className="min-h-screen bg-zinc-50 pb-24 text-zinc-900">
      {/* Batch⑤-5：深黑顶栏→Duo 白底（验收语义零动） */}
      <header className="bg-white/90 backdrop-blur-xl border-b-2 border-[var(--color-duo-swan)] text-[var(--color-duo-eel)] p-4 sticky top-0 z-50 shadow-sm">
        <span className="text-sm font-medium">订单验收 · {demand.id.slice(0, 8)}...</span>
      </header>
      <div className="max-w-md mx-auto p-4">
        <AcceptanceCard
          orderId={demand.id}
          title={demand.title ?? "未命名需求"}
          price={demand.price}
          status={demand.status}
          releasedAt={demand.released_at}
        />
      </div>
    </div>
  )
}
