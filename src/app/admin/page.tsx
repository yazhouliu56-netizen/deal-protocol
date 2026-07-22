"use client"

import { useState, useEffect } from "react"
import { useSession } from "@/components/SessionProvider"
import Link from "next/link"
import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"
import { useCountUp } from "@/lib/use-count-up"
import {
  FileText, Users, ShieldAlert, AlertTriangle, Settings, Scale, Gavel, Clock,
} from "lucide-react"

interface DashboardStats {
  total_protocols_today: number
  pending_reviews: number
  active_complaints: number
  recent_sos: number
  total_protocols: number
  active_protocols: number
  total_providers: number
}

function StatCard({ title, value, desc, href, icon: Icon, accent }: {
  title: string; value: number; desc: string; href: string; icon: React.ElementType; accent: string
}) {
  const count = useCountUp(value)
  return (
    <Link href={href}>
      <div className="group rounded-2xl border border-slate-200/60 bg-white p-6 transition-all duration-200 hover:shadow-md hover:-translate-y-0.5 dark:border-zinc-800/60 dark:bg-zinc-900">
        <div className="flex items-center justify-between mb-3">
          <div className={cn("flex h-10 w-10 items-center justify-center rounded-xl", accent)}>
            <Icon className="size-5 text-white" />
          </div>
          <Badge variant="outline" className="border-slate-200 text-[10px] dark:border-zinc-700">{desc}</Badge>
        </div>
        <p className="text-3xl font-black text-slate-900 tabular-nums dark:text-zinc-100">{count}</p>
        <p className="mt-1 text-xs text-slate-500 dark:text-zinc-400">{title}</p>
      </div>
    </Link>
  )
}

export default function AdminDashboardPage() {
  const { user: session } = useSession()
  const [stats, setStats] = useState<DashboardStats | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (session?.role !== "ADMIN") return
    ;(async () => {
      try {
        const res = await fetch("/api/admin/stats")
        if (!res.ok) return
        const statsData = await res.json()

        const today = new Date().toISOString().slice(0, 10)
        const todayCount = Object.entries(statsData.contracts_by_day ?? {})
          .filter(([day]) => day >= today)
          .reduce((sum, [, count]) => sum + (count as number), 0)

        const reviewRes = await fetch("/api/admin/review")
        const reviewData = reviewRes.ok ? await reviewRes.json() : { items: [] }

        const complaintsRes = await fetch("/api/admin/complaints")
        const complaintsData = complaintsRes.ok ? await complaintsRes.json() : { complaints: [] }

        setStats({
          total_protocols_today: todayCount || statsData.total_contracts || 0,
          pending_reviews: (reviewData.items ?? []).length,
          active_complaints: (complaintsData.complaints ?? []).length,
          recent_sos: 0,
          total_protocols: statsData.total_contracts ?? 0,
          active_protocols: statsData.contracts_by_status?.PENDING ?? 0,
          total_providers: statsData.total_users ?? 0,
        })
      } catch { /* ignore */ }
      finally { setLoading(false) }
    })()
  }, [session])

  const cards = [
    { title: "今日协议数", value: stats?.total_protocols_today ?? 0, desc: "今日新增", href: "/admin/review", icon: FileText, accent: "bg-indigo-600" },
    { title: "待审核", value: stats?.pending_reviews ?? 0, desc: "待处理", href: "/admin/review", icon: Clock, accent: "bg-amber-500" },
    { title: "待处理举报", value: stats?.active_complaints ?? 0, desc: "待响应", href: "/admin/complaints", icon: ShieldAlert, accent: "bg-rose-500" },
    { title: "近期 SOS", value: stats?.recent_sos ?? 0, desc: "24小时", href: "#", icon: AlertTriangle, accent: "bg-orange-500" },
  ]

  if (loading || !stats) {
    return (
      <div>
        <div className="mx-auto max-w-7xl">
          <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="animate-pulse rounded-2xl border border-slate-200/60 bg-white p-6 dark:border-zinc-800/60 dark:bg-zinc-900">
                <div className="mb-3 h-10 w-10 rounded-xl bg-slate-200 dark:bg-zinc-700" />
                <div className="h-8 w-20 rounded bg-slate-200 dark:bg-zinc-700" />
                <div className="mt-2 h-4 w-24 rounded bg-slate-200 dark:bg-zinc-700" />
              </div>
            ))}
          </div>
        </div>
      </div>
    )
  }

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-3xl font-bold tracking-tight text-slate-900 dark:text-zinc-100">管理后台</h1>
        <p className="mt-2 text-sm text-slate-500 dark:text-zinc-500">平台运营概览与快捷操作</p>
      </div>

      <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
        {cards.map((card) => <StatCard key={card.title} {...card} />)}
      </div>

      <div className="mt-8 grid gap-6 lg:grid-cols-2">
        <div className="rounded-2xl border border-slate-200/60 bg-white p-6 dark:border-zinc-800/60 dark:bg-zinc-900">
          <h2 className="mb-4 text-sm font-bold text-slate-900 dark:text-zinc-100">快捷入口</h2>
          <div className="space-y-2">
            {[
              { href: "/admin/review", icon: Gavel, label: "审核队列", desc: "处理待确认的协议和服务者资质" },
              { href: "/admin/complaints", icon: ShieldAlert, label: "举报处理", desc: "查看证据链并作出处理决定" },
              { href: "/admin/disputes", icon: Scale, label: "纠纷仲裁", desc: "管理平台纠纷并作出裁决" },
              { href: "/admin/config", icon: Settings, label: "平台配置", desc: "佣金、信用等级、规则设置" },
              { href: "/admin/protocols", icon: FileText, label: "协议管理", desc: "启用/禁用交易协议" },
            ].map((item) => (
              <Link key={item.href} href={item.href}>
                <div className="flex items-center gap-3 rounded-xl border border-slate-100 px-4 py-3 transition-all hover:border-indigo-200 hover:bg-indigo-50/30 dark:border-zinc-800 dark:hover:border-indigo-800 dark:hover:bg-indigo-950/10">
                  <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-indigo-50 dark:bg-indigo-950/30">
                    <item.icon className="size-4 text-indigo-600 dark:text-indigo-400" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-slate-900 dark:text-zinc-100">{item.label}</p>
                    <p className="text-xs text-slate-500 dark:text-zinc-500">{item.desc}</p>
                  </div>
                  <span className="text-xs text-slate-400 dark:text-zinc-600">→</span>
                </div>
              </Link>
            ))}
          </div>
        </div>

        <div className="rounded-2xl border border-slate-200/60 bg-white p-6 dark:border-zinc-800/60 dark:bg-zinc-900">
          <h2 className="mb-4 text-sm font-bold text-slate-900 dark:text-zinc-100">平台数据</h2>
          <div className="space-y-3">
            {[
              { label: "累计协议数", value: stats.total_protocols, icon: FileText },
              { label: "活跃协议数", value: stats.active_protocols, icon: FileText },
              { label: "注册服务商", value: stats.total_providers, icon: Users },
            ].map((row) => (
              <div key={row.label} className="flex items-center justify-between rounded-lg border border-slate-100 px-4 py-3 dark:border-zinc-800">
                <div className="flex items-center gap-2">
                  <row.icon className="size-3.5 text-slate-400" />
                  <span className="text-sm text-slate-600 dark:text-zinc-400">{row.label}</span>
                </div>
                <span className="text-base font-bold text-slate-900 tabular-nums dark:text-zinc-100">{row.value}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
