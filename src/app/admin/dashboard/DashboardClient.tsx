"use client"

import React, { useEffect, useState } from "react"
import { getBrowserSupabase } from "@/lib/supabase-browser"

interface AdminStats {
  active_count: number
  completed_count: number
  anomaly_count: number
}

export default function DashboardClient() {
  const [stats, setStats] = useState<AdminStats>({ active_count: 0, completed_count: 0, anomaly_count: 0 })
  const [anomalies, setAnomalies] = useState<Record<string, unknown>[]>([])

  const fetchDashboardData = async () => {
    const supabase = getBrowserSupabase()

    const { data: statsData } = await supabase
      .from("view_admin_stats")
      .select("*")
      .single()

    if (statsData) {
      setStats(statsData as AdminStats)
    }

    const { data: anomalyList } = await supabase
      .from("demands")
      .select("*")
      .eq("status", "STARTED")
      .lt("updated_at", new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString())

    setAnomalies(anomalyList ?? [])
  }

  useEffect(() => {
    fetchDashboardData()

    const supabase = getBrowserSupabase()
    const channel = supabase
      .channel("admin_stats")
      .on("postgres_changes", { event: "*", schema: "public", table: "demands" }, fetchDashboardData)
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [])

  return (
    <div>
      <h1 className="text-3xl font-black mb-8">🚀 运营驾驶舱</h1>

      <div className="grid grid-cols-3 gap-6 mb-8">
        <StatCard color="text-blue-600" label="施工中" value={stats.active_count} />
        <StatCard color="text-emerald-600" label="已完工" value={stats.completed_count} />
        <StatCard color="text-red-600" label="异常滞留" value={stats.anomaly_count} />
      </div>

      {anomalies.length > 0 && (
        <div className="bg-white dark:bg-zinc-900 p-6 rounded-2xl shadow-sm border border-red-100 dark:border-red-900/50">
          <h2 className="text-red-600 font-bold mb-4">⚠️ 异常滞留工单 (2小时未更新)</h2>
          <div className="space-y-3">
            {anomalies.map((item) => (
              <div key={item.id as string} className="flex justify-between items-center text-sm p-4 bg-red-50 dark:bg-red-950/30 rounded-xl border border-red-100 dark:border-red-900/50">
                <span className="font-mono text-zinc-600 dark:text-zinc-400">ID: {(item.id as string).slice(0, 8)}...</span>
                <span className="text-zinc-400">最后更新: {new Date(item.updated_at as string).toLocaleTimeString()}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

function StatCard({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div className="bg-white dark:bg-zinc-900 p-6 rounded-2xl shadow-sm border border-zinc-100 dark:border-zinc-800">
      <p className="text-zinc-400 text-sm font-medium">{label}</p>
      <p className={`text-5xl font-black ${color} mt-2`}>{value}</p>
    </div>
  )
}
