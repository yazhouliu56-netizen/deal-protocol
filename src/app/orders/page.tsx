"use client"

import { useState, useEffect } from "react"
import Link from "next/link"
import { useSession } from "@/components/SessionProvider"
import { useRouter } from "next/navigation"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import { Clock, User, ShieldCheck } from "lucide-react"

const FUND_STATUS_MAP: Record<string, { label: string; color: string }> = {
  PENDING_HELD: { label: "待支付", color: "bg-amber-50 text-amber-700 dark:bg-amber-950/30 dark:text-amber-400" },
  PENDING: { label: "待支付", color: "bg-amber-50 text-amber-700 dark:bg-amber-950/30 dark:text-amber-400" },
  HELD: { label: "资金托管中", color: "bg-indigo-50 text-indigo-700 dark:bg-indigo-950/30 dark:text-indigo-400" },
  COMPLETED: { label: "已完成", color: "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/30 dark:text-emerald-400" },
  SATISFACTION_HELD: { label: "暂存评估", color: "bg-purple-50 text-purple-700 dark:bg-purple-950/30 dark:text-purple-400" },
  SETTLED: { label: "已结算", color: "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/30 dark:text-emerald-400" },
  CANCELLED: { label: "已取消", color: "bg-slate-100 text-slate-600 dark:bg-zinc-800 dark:text-zinc-400" },
  DISPUTED: { label: "纠纷中", color: "bg-rose-50 text-rose-700 dark:bg-rose-950/30 dark:text-rose-400" },
  REJECTED: { label: "已拒绝", color: "bg-red-50 text-red-700 border border-red-200 dark:bg-red-950/30 dark:text-red-400" },
}

interface ContractSummary {
  id: string
  fund_status: string
  amount: number
  created_at: string
  demand: { id: string; title: string } | null
  provider: { id: string; name: string }
  customer: { id: string; name: string }
  payments: { status: string; amount: number }[]
}

type RoleTab = "customer" | "provider"

function OrdersSkeleton() {
  return (
    <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
      {[...Array(6)].map((_, i) => (
        <div key={i} className="animate-pulse rounded-2xl border border-slate-200/60 bg-white p-6 dark:border-zinc-800/60 dark:bg-zinc-900">
          <div className="mb-3 h-4 w-16 rounded bg-slate-200 dark:bg-zinc-700" />
          <div className="mb-2 h-5 w-3/4 rounded bg-slate-200 dark:bg-zinc-700" />
          <div className="mb-4 h-4 w-1/2 rounded bg-slate-200 dark:bg-zinc-700" />
          <div className="flex justify-between">
            <div className="h-6 w-16 rounded bg-slate-200 dark:bg-zinc-700" />
            <div className="h-6 w-20 rounded bg-slate-200 dark:bg-zinc-700" />
          </div>
        </div>
      ))}
    </div>
  )
}

export default function OrdersPage() {
  const router = useRouter()
  const { user: session, loading: authStatus } = useSession()
  const [role, setRole] = useState<RoleTab>("customer")
  const [contracts, setContracts] = useState<ContractSummary[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!authStatus && !session) router.push("/login")
  }, [session, authStatus, router])

  useEffect(() => {
    setLoading(true)
    fetch(`/api/orders?role=${role}`)
      .then((res) => res.ok ? res.json() : [])
      .then((data) => setContracts(data.contracts ?? []))
      .catch(() => {})
      .finally(() => setLoading(false))
    const poll = setInterval(() => {
      fetch(`/api/orders?role=${role}`)
        .then((res) => res.ok ? res.json() : null)
        .then((data) => { if (data) setContracts(data.contracts ?? []) })
        .catch(() => {})
    }, 5000)
    return () => clearInterval(poll)
  }, [role])

  return (
    <div className="min-h-screen bg-slate-50 px-4 py-10 dark:bg-zinc-950 touch-manipulation">
      <div className="mx-auto max-w-6xl">
        <div className="mb-8 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold text-slate-900 dark:text-zinc-100">我的订单</h1>
            <p className="mt-1 text-sm text-slate-500 dark:text-zinc-500">管理您的全部订单与服务记录</p>
          </div>
        </div>

        {/* Role Tabs */}
        <div className="mb-6 flex gap-1 rounded-xl bg-slate-100 p-1 dark:bg-zinc-800 touch-manipulation">
          {(["customer", "provider"] as const).map((r) => (
            <button
              key={r}
              type="button"
              onClick={() => setRole(r)}
              className={cn(
                "touch-target flex-1 rounded-lg px-4 py-2 text-sm font-medium transition-all active:scale-[0.98]",
                role === r
                  ? "bg-white text-slate-900 shadow-sm dark:bg-zinc-900 dark:text-zinc-100"
                  : "text-slate-500 hover:text-slate-700 dark:text-zinc-400 dark:hover:text-zinc-200",
              )}
            >
              {r === "customer" ? "我的下单" : "我的接单"}
            </button>
          ))}
        </div>

        {loading ? (
          <OrdersSkeleton />
        ) : contracts.length === 0 ? (
          <div className="flex flex-col items-center py-24 text-center">
            <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-slate-100 dark:bg-zinc-800">
              <ShieldCheck className="size-7 text-slate-400 dark:text-zinc-500" />
            </div>
            <p className="text-lg font-semibold text-slate-900 dark:text-zinc-100">
              {role === "customer" ? "暂无下单记录" : "暂无接单记录"}
            </p>
            <p className="mt-1 text-sm text-slate-500 dark:text-zinc-500">
              {role === "customer" ? "发布需求后，服务商会主动接单" : "有空时浏览需求大厅，接取订单"}
            </p>
            {role === "customer" && (
              <Button className="mt-6 rounded-xl" onClick={() => router.push("/demands/new")}>
                发布需求
              </Button>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
            {contracts.map((c) => {
              const fund = FUND_STATUS_MAP[c.fund_status] ?? { label: c.fund_status, color: "bg-slate-100 text-slate-600 dark:bg-zinc-800 dark:text-zinc-400" }
              const totalPaid = c.payments?.reduce((sum, p) => sum + p.amount, 0) ?? 0
              return (
                <Link key={c.id} href={`/orders/${c.id}`} className="block touch-feedback active:scale-[0.98]">
                  <div className="rounded-2xl border border-slate-200/60 bg-white p-6 transition-all duration-200 hover:shadow-md dark:border-zinc-800/60 dark:bg-zinc-900">
                    {/* Fund status badge */}
                    <div className="mb-3 flex items-center justify-between">
                      <Badge className={cn("border-0 text-[10px]", fund.color)}>
                        💠 {fund.label}
                      </Badge>
                      <span className="text-xs text-slate-400 dark:text-zinc-500 tabular-nums">
                        {new Date(c.created_at).toLocaleDateString("zh-CN")}
                      </span>
                    </div>

                    {/* Title */}
                    <h2 className="line-clamp-2 text-sm font-bold text-slate-900 min-w-0 dark:text-zinc-100">
                      {c.demand?.title ?? "服务订单"}
                    </h2>

                    {/* Counterparty */}
                    <div className="mt-2 flex items-center gap-1.5 text-xs text-slate-500 dark:text-zinc-500">
                      <User className="size-3 shrink-0" />
                      <span className="truncate">
                        {role === "customer" ? `服务商：${c.provider.name}` : `客户：${c.customer.name}`}
                      </span>
                    </div>

                    {/* Bottom: amount + fund status indicator */}
                    <div className="mt-4 flex items-center justify-between border-t border-slate-100 pt-3 dark:border-zinc-800">
                      <div className="flex items-center gap-1.5">
                        <div className={cn("h-1.5 w-1.5 rounded-full", fund.color.includes("emerald") ? "bg-emerald-500" : fund.color.includes("indigo") ? "bg-indigo-500" : fund.color.includes("amber") ? "bg-amber-500" : fund.color.includes("rose") ? "bg-rose-500" : "bg-slate-400")} />
                        <span className="text-xs text-slate-500 dark:text-zinc-400">{fund.label}</span>
                      </div>
                      <div className="flex items-center gap-3">
                        <span className="text-xs text-slate-400 dark:text-zinc-500 tabular-nums">
                          实付¥{totalPaid.toFixed(0)}
                        </span>
                        <span className="text-sm font-bold text-slate-900 tabular-nums dark:text-zinc-100">
                          ¥{c.amount.toFixed(2)}
                        </span>
                      </div>
                    </div>
                  </div>
                </Link>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
