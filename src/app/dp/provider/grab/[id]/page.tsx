import React from "react"
import { getSupabase } from "@/lib/supabase-client"
import GrabConsoleClientWrapper from "@/app/provider/grab/[id]/GrabConsoleClientWrapper"

interface PageProps {
  params: Promise<{ id: string }>
}

/**
 * 协议专区 · 紧急竞抢控制台（/dp/provider/grab/[id]）
 * C16 收编落点：原 /provider/grab/[id] 平移归位至 /dp 协议专区，GrabConsole 竞抢动效与校验逻辑 100% 复用。
 */
export default async function DpGrabPage({ params }: PageProps) {
  const { id: demandId } = await params

  const supabase = getSupabase()

  const { data: demand } = await supabase
    .from("demands")
    .select("id, created_at, status, matched_provider_id")
    .eq("id", demandId)
    .single()

  if (!demand || demand.status === "ACCEPTED" || demand.status === "CANCELLED" || demand.matched_provider_id) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center p-4">
        <div className="text-center p-8 bg-slate-900 border border-slate-800 rounded-3xl max-w-sm text-white">
          <div className="text-4xl mb-4">🔍</div>
          <h2 className="text-lg font-bold mb-2">该订单已结束竞抢</h2>
          <p className="text-slate-400 text-sm leading-relaxed">
            该订单已被其他师傅成功匹配，或已被发布者撤回。
          </p>
        </div>
      </div>
    )
  }

  const { data: contracts } = await supabase
    .from("contracts")
    .select("provider:profiles!provider_id(id, name)")
    .eq("demand_id", demandId)
    .not("provider_id", "is", null)

  const seen = new Set<string>()
  const competitors: { id: string; avatar: string; name: string }[] = []
  for (const row of (contracts ?? []) as Array<{ provider: { id: string; name: string } | unknown }>) {
    const p = (row as { provider: { id: string; name: string } }).provider
    if (p && p.id && !seen.has(p.id)) {
      seen.add(p.id)
      competitors.push({ id: p.id, name: p.name, avatar: "" })
    }
  }

  return (
    <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center p-4">
      <GrabConsoleClientWrapper
        demandId={demandId}
        initialCreatedAt={demand.created_at}
        initialCompetitors={competitors}
      />
    </div>
  )
}
