"use client"

import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import {
  Crown, CircleCheck, Lock, Smartphone, Shield,
} from "lucide-react"
import { cn } from "@/lib/utils"

interface CreditDashboardProps {
  creditScore?: number
  level?: string
  completedOrders?: number
  satisfactionRate?: string
  orderSummary?: Array<{ label: string; value: string; color?: string }>
  identityItems?: Array<{ label: string; icon: React.ElementType; done: boolean }>
  showHeader?: boolean
}

export function CreditDashboard({
  creditScore = 780,
  level = "信用极佳",
  completedOrders = 15,
  satisfactionRate = "98%",
  orderSummary,
  identityItems,
  showHeader = true,
}: CreditDashboardProps) {
  const defaultOrderSummary = orderSummary ?? [
    { label: "进行中", value: "2" },
    { label: "待接单", value: "1" },
    { label: "待评价", value: "3" },
  ]

  const defaultIdentity = identityItems ?? [
    { icon: CircleCheck, label: "实名认证", done: true },
    { icon: Smartphone, label: "手机绑定", done: true },
    { icon: Lock, label: "人脸识别", done: true },
    { icon: Shield, label: "保险已生效", done: true },
  ]

  return (
    <aside className="flex h-full flex-col space-y-6 p-6">
      {showHeader && (
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-indigo-600 text-sm font-bold tracking-tight text-white shadow-sm">
            dp
          </div>
          <div>
            <p className="text-sm font-semibold text-slate-900 dark:text-zinc-100">deal-protocol</p>
            <p className="text-xs text-slate-500 dark:text-zinc-500">信用看板</p>
          </div>
        </div>
      )}

      {/* Credit Score Card */}
      <Card className="border-slate-200/60 bg-white shadow-sm dark:border-zinc-800/60 dark:bg-zinc-900">
        <CardContent className="p-5">
          <div className="flex flex-col items-center text-center">
            <div className="flex h-14 w-14 items-center justify-center rounded-full bg-indigo-50 text-2xl dark:bg-indigo-950/30">
              <Crown className="size-7 text-indigo-600 dark:text-indigo-400" />
            </div>
            <Badge className="mt-3 border-0 bg-emerald-50 px-3 py-1 text-xs text-emerald-700 dark:bg-emerald-950/30 dark:text-emerald-400">
              {level}
            </Badge>
            <div className="mt-2 flex items-baseline gap-0.5">
              <span className="text-4xl font-bold tracking-tight text-slate-900 dark:text-zinc-100">{creditScore}</span>
              <span className="text-sm text-slate-500 dark:text-zinc-500">/1000</span>
            </div>
            <div className="mt-4 flex w-full gap-3">
              <div className="flex-1 rounded-lg bg-indigo-50 px-3 py-2 text-center dark:bg-indigo-950/20">
                <p className="text-lg font-bold text-indigo-700 dark:text-indigo-400">{completedOrders}</p>
                <p className="text-[10px] text-indigo-500">已完成</p>
              </div>
              <div className="flex-1 rounded-lg bg-emerald-50 px-3 py-2 text-center dark:bg-emerald-950/20">
                <p className="text-lg font-bold text-emerald-700 dark:text-emerald-400">{satisfactionRate}</p>
                <p className="text-[10px] text-emerald-500">好评率</p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Order Summary */}
      <div>
        <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-slate-400 dark:text-zinc-500">订单概览</p>
        <div className="space-y-2">
          {defaultOrderSummary.map((item) => (
            <div
              key={item.label}
              className="flex items-center justify-between rounded-lg border border-slate-200/60 bg-white px-4 py-2.5 dark:border-zinc-800/60 dark:bg-zinc-900"
            >
              <span className="text-sm text-slate-600 dark:text-zinc-400">{item.label}</span>
              <span className={cn("font-semibold text-slate-900 dark:text-zinc-100 tabular-nums", item.color)}>{item.value}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Identity Verification */}
      <div>
        <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-slate-400 dark:text-zinc-500">身份认证</p>
        <div className="space-y-2">
          {defaultIdentity.map((item) => (
            <div
              key={item.label}
              className="flex items-center gap-2.5 rounded-lg border border-slate-200/60 bg-white px-4 py-2.5 dark:border-zinc-800/60 dark:bg-zinc-900"
            >
              <item.icon
                className={cn(
                  "size-4 shrink-0",
                  item.done ? "text-emerald-500" : "text-slate-300 dark:text-zinc-600",
                )}
              />
              <span className="text-sm text-slate-600 dark:text-zinc-400">{item.label}</span>
              <span className="ml-auto text-xs text-emerald-600 dark:text-emerald-500">已认证</span>
            </div>
          ))}
        </div>
      </div>
    </aside>
  )
}
