"use client"

import { useState, useEffect, useRef, useCallback } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { useSession } from "@/components/SessionProvider"
import toast from "react-hot-toast"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card"
import { cn } from "@/lib/utils"
import { Loader2, ExternalLink, CheckCircle2, AlertTriangle, MessageCircle, Clock, MapPin, User, Shield } from "lucide-react"
import OrderOperations from "./order-operations"
import { useOrderRealtime } from "@/hooks/use-order-realtime"
import { useSSE } from "@/lib/use-sse"
import { useContractSound } from "@/lib/use-contract-sound"

interface Payment {
  id: string; status: string; amount: number
}
interface Review {
  id: string; rating: number; comment: string | null; created_at: string; reviewer: { name: string }
}
interface Contract {
  id: string; fund_status: string; service_stage: number; terms: string; amount: number
  address: string | null; scheduled_at: string | null; notes: string | null
  completed_at: string | null; auto_complete_at: string | null; created_at: string
  provider: { id: string; name: string; phone: string | null; creditScore: number }
  customer: { id: string; name: string; phone: string | null }
  payments: Payment[]; reviews: Review[]
  events: { id: string; action: string; from_status: string; to_status: string; reason: string | null; created_at: string }[]
  paymentChannels?: string[]
}

const STATUS_CONFIG: Record<string, { label: string; color: string; step: number }> = {
  PENDING_HELD: { label: "待支付", color: "bg-amber-50 text-amber-700 dark:bg-amber-950/30 dark:text-amber-400", step: 1 },
  PENDING: { label: "待支付", color: "bg-amber-50 text-amber-700 dark:bg-amber-950/30 dark:text-amber-400", step: 1 },
  HELD: { label: "服务中", color: "bg-indigo-50 text-indigo-700 dark:bg-indigo-950/30 dark:text-indigo-400", step: 2 },
  COMPLETED: { label: "已完成", color: "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/30 dark:text-emerald-400", step: 3 },
  SATISFACTION_HELD: { label: "暂存评估", color: "bg-purple-50 text-purple-700 dark:bg-purple-950/30 dark:text-purple-400", step: 3 },
  SETTLED: { label: "已结算", color: "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/30 dark:text-emerald-400", step: 4 },
  CANCELLED: { label: "已取消", color: "bg-slate-100 text-slate-600 dark:bg-zinc-800 dark:text-zinc-400", step: -1 },
  DISPUTED: { label: "纠纷中", color: "bg-rose-50 text-rose-700 dark:bg-rose-950/30 dark:text-rose-400", step: -1 },
  REJECTED: { label: "已拒绝", color: "bg-red-50 text-red-700 border border-red-200 dark:bg-red-950/30 dark:text-red-400", step: -1 },
}

const STEPS = [
  { label: "资金托管", icon: "💠" },
  { label: "施工中", icon: "🛠" },
  { label: "验收中", icon: "🔍" },
  { label: "已结算", icon: "💰" },
]

function getCreditBadge(score: number) {
  if (score >= 200) return { label: "信用极佳", color: "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/30 dark:text-emerald-400" }
  if (score >= 150) return { label: "信用良好", color: "bg-indigo-50 text-indigo-700 dark:bg-indigo-950/30 dark:text-indigo-400" }
  if (score >= 100) return { label: "信用一般", color: "bg-amber-50 text-amber-700 dark:bg-amber-950/30 dark:text-amber-400" }
  return { label: "待提升", color: "bg-rose-50 text-rose-700 dark:bg-rose-950/30 dark:text-rose-400" }
}

export default function OrderDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const router = useRouter()
  const { user: session, loading: authStatus } = useSession()
  const [orderId, setOrderId] = useState<string | null>(null)
  const [contract, setContract] = useState<Contract | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => { params.then(({ id }) => setOrderId(id)) }, [params])

  useEffect(() => {
    if (!orderId) return
    let cancelled = false
    const fetchOrder = async () => {
      try {
        const res = await fetch(`/api/orders/${orderId}`)
        if (!res.ok) throw new Error()
        const data = await res.json()
        if (!cancelled) setContract(data.contract)
      } catch {
        if (!cancelled) toast.error("加载订单详情失败")
      } finally { if (!cancelled) setLoading(false) }
    }
    fetchOrder()
    return () => { cancelled = true }
  }, [orderId])

  useSSE("order", orderId, () => {
    fetch(`/api/orders/${orderId}`)
      .then((r) => r.ok ? r.json() : null)
      .then((d) => { if (d) setContract(d.contract) })
      .catch(() => {})
  })

  const reFetchOrder = useCallback(async () => {
    if (!orderId) return
    try {
      const res = await fetch(`/api/orders/${orderId}`)
      if (res.ok) {
        const data = await res.json()
        setContract(data.contract)
      }
    } catch { /* silent */ }
  }, [orderId])

  useOrderRealtime(
    { id: orderId ?? '', status: contract?.fund_status ?? '' },
    { onChange: () => reFetchOrder() },
  )

  useEffect(() => {
    if (!authStatus && !session) router.push("/login")
  }, [session, authStatus, router])

  const userRole = session?.id === contract?.customer?.id ? "CUSTOMER" : "PROVIDER"
  const isCustomer = userRole === "CUSTOMER"
  const isProvider = userRole === "PROVIDER"
  const currentStep = contract ? STATUS_CONFIG[contract.fund_status]?.step ?? -1 : -1

  const [paymentChannels, setPaymentChannels] = useState<string[]>([])
  const [payLoading, setPayLoading] = useState<string | null>(null)
  const [activePayment, setActivePayment] = useState<{ channel: string; payUrl: string | null; qrCode: string | null; mock: boolean } | null>(null)
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const stopPolling = useCallback(() => {
    if (pollRef.current) { clearInterval(pollRef.current); pollRef.current = null }
  }, [])
  const startPolling = useCallback((orderId: string) => {
    stopPolling()
    pollRef.current = setInterval(async () => {
      try {
        const res = await fetch(`/api/payment/status/${orderId}`)
        if (!res.ok) return
        const data = await res.json()
        if (data.fundStatus === "HELD") {
          stopPolling(); setActivePayment(null)
          const refreshed = await fetch(`/api/orders/${orderId}`)
          if (refreshed.ok) {
            const refreshedData = await refreshed.json()
            setContract(refreshedData.contract)
          }
          toast.success("支付成功！")
        }
      } catch { /* continue polling */ }
    }, 3000)
  }, [stopPolling])

  const canPay = isCustomer && currentStep === 1
  const { playCoinDrop, playContractSeal } = useContractSound()

  useEffect(() => {
    if (!canPay || !orderId) return
    fetch(`/api/orders/${orderId}`)
      .then((r) => r.ok ? r.json() : null)
      .then((d) => { if (d?.contract?.paymentChannels) setPaymentChannels(d.contract.paymentChannels) })
      .catch(() => {})
  }, [canPay, orderId])

  useEffect(() => () => stopPolling(), [stopPolling])

  const handlePayment = async (channel: string) => {
    setPayLoading(channel)
    try {
      const res = await fetch("/api/payment/create", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ orderId, channel }) })
      const data = await res.json()
      if (!res.ok) { toast.error(data.error || "支付创建失败"); return }
      if (data.mock) {
        const refreshed = await fetch(`/api/orders/${orderId}`)
        if (refreshed.ok) { const d = await refreshed.json(); setContract(d.contract) }
        toast.success("支付成功！"); return
      }
      setActivePayment(data)
      startPolling(orderId!)
    } catch { toast.error("网络错误，请重试") }
    finally { setPayLoading(null) }
  }

  if (authStatus || loading) {
    return (
      <div className="min-h-screen bg-slate-50 px-4 py-10 dark:bg-zinc-950">
        <div className="mx-auto max-w-5xl">
          <div className="grid grid-cols-1 gap-8 lg:grid-cols-[2fr_1fr]">
            <div className="space-y-4">
              <div className="h-20 animate-pulse rounded-2xl bg-slate-200 dark:bg-zinc-800" />
              <div className="h-40 animate-pulse rounded-2xl bg-slate-200 dark:bg-zinc-800" />
              <div className="h-32 animate-pulse rounded-2xl bg-slate-200 dark:bg-zinc-800" />
            </div>
            <div className="hidden lg:block h-64 animate-pulse rounded-3xl bg-slate-200 dark:bg-zinc-800 lg:sticky lg:top-6" />
          </div>
        </div>
      </div>
    )
  }

  if (!contract) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-20 text-center">
        <p className="text-slate-500 dark:text-zinc-400">订单不存在</p>
        <Button className="mt-4 rounded-xl" onClick={() => router.push("/orders")}>返回订单列表</Button>
      </div>
    )
  }

  const st = STATUS_CONFIG[contract.fund_status] ?? { label: contract.fund_status, color: "bg-slate-100 text-slate-600" }
  const customerCredit = getCreditBadge(contract.customer?.name?.length ? 750 : 200)
  const providerCredit = getCreditBadge(contract.provider?.creditScore ?? 200)

  return (
    <div className="min-h-screen bg-slate-50 px-4 py-10 dark:bg-zinc-950 touch-manipulation">
      <div className="mx-auto max-w-5xl pb-16 lg:pb-0">
        <nav className="mb-6 text-xs text-slate-500 dark:text-zinc-500 touch-target inline-flex items-center">
          <Link href="/orders" className="hover:text-slate-700 dark:hover:text-zinc-300">我的订单</Link>
          <span className="mx-2">/</span>
          <span className="text-slate-900 dark:text-zinc-100">控制室</span>
        </nav>

        <div className="grid grid-cols-1 gap-8 lg:grid-cols-[2fr_1fr]">
          {/* ══ LEFT: Core Details ══ */}
          <div className="space-y-6">
            {/* Smart Stepper */}
            <div className="rounded-2xl border border-slate-200/60 bg-white p-6 dark:border-zinc-800/60 dark:bg-zinc-900">
              <div className="flex items-center justify-between">
                {STEPS.map((step, i) => {
                  const stepNum = i + 1
                  const isActive = currentStep >= stepNum
                  const isCurrent = currentStep === stepNum
                  const isDone = currentStep > stepNum
                  const isFuture = currentStep < stepNum
                  return (
                    <div key={step.label} className="flex flex-col items-center">
                      <div className={cn(
                        "flex h-10 w-10 items-center justify-center rounded-full text-sm font-bold transition-all",
                        isDone && "bg-emerald-500 text-white",
                        isCurrent && "bg-indigo-600 text-white ring-2 ring-indigo-300 dark:ring-indigo-700 animate-pulse",
                        isFuture && "bg-slate-100 text-slate-400 dark:bg-zinc-800 dark:text-zinc-500",
                      )}>
                        {isDone ? <CheckCircle2 className="size-5" /> : step.icon}
                      </div>
                      <span className={cn(
                        "mt-2 text-[10px] font-medium whitespace-nowrap",
                        isActive ? "text-slate-700 dark:text-zinc-300" : "text-slate-400 dark:text-zinc-600",
                      )}>{step.label}</span>
                    </div>
                  )
                })}
              </div>
              {/* Connecting line */}
              <div className="relative mt-2 mx-2">
                <div className="h-0.5 w-full bg-slate-100 dark:bg-zinc-800">
                  <div className="h-full bg-gradient-to-r from-emerald-500 via-indigo-500 to-emerald-500 transition-all" style={{ width: `${Math.max(0, ((currentStep - 1) / (STEPS.length - 1)) * 100)}%` }} />
                </div>
              </div>
              <div className="mt-3 text-center">
                <Badge className={cn("border-0", st.color)}>{st.label}</Badge>
              </div>
            </div>

            {/* Protocol Card */}
            <div className="rounded-2xl border border-slate-200/60 bg-white p-6 dark:border-zinc-800/60 dark:bg-zinc-900">
              <h2 className="mb-4 text-xs font-semibold uppercase tracking-wider text-slate-400 dark:text-zinc-500">协议内容</h2>
              <div className="flex items-start justify-between">
                <div className="flex-1 min-w-0 mr-4">
                  <p className="line-clamp-2 text-base font-bold text-slate-900 dark:text-zinc-100">
                    {(() => { try { const t = JSON.parse(contract.terms); return t.title ?? "服务订单" } catch { return contract.terms } })()}
                  </p>
                </div>
                <span className="text-2xl font-black text-indigo-600 tabular-nums shrink-0 dark:text-indigo-400">
                  ¥{contract.amount.toFixed(2)}
                </span>
              </div>
              <div className="mt-4 space-y-2 text-xs text-slate-500 dark:text-zinc-500">
                {contract.address && <div className="flex items-center gap-1.5"><MapPin className="size-3" /><span>{contract.address}</span></div>}
                {contract.scheduled_at && <div className="flex items-center gap-1.5"><Clock className="size-3" /><span>{new Date(contract.scheduled_at).toLocaleString("zh-CN")}</span></div>}
              </div>
            </div>

            {/* Participants */}
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="rounded-2xl border border-slate-200/60 bg-white p-5 dark:border-zinc-800/60 dark:bg-zinc-900">
                <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400 dark:text-zinc-500 mb-3">客户</p>
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-full bg-indigo-100 text-sm font-bold text-indigo-700 dark:bg-indigo-950/30 dark:text-indigo-400">
                    {contract.customer.name?.[0] ?? "?"}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-slate-900 dark:text-zinc-100">{contract.customer.name}</p>
                    <Badge className={cn("mt-0.5 border-0 text-[9px]", customerCredit.color)}>👑 {customerCredit.label}</Badge>
                  </div>
                </div>
              </div>
              <div className="rounded-2xl border border-slate-200/60 bg-white p-5 dark:border-zinc-800/60 dark:bg-zinc-900">
                <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400 dark:text-zinc-500 mb-3">服务商</p>
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-full bg-emerald-100 text-sm font-bold text-emerald-700 dark:bg-emerald-950/30 dark:text-emerald-400">
                    {contract.provider.name?.[0] ?? "?"}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-slate-900 dark:text-zinc-100">{contract.provider.name}</p>
                    <Badge className={cn("mt-0.5 border-0 text-[9px]", providerCredit.color)}>👑 {providerCredit.label} | {contract.provider.creditScore}分</Badge>
                  </div>
                </div>
              </div>
            </div>

            {/* Event Timeline */}
            <div className="rounded-2xl border border-slate-200/60 bg-white p-6 dark:border-zinc-800/60 dark:bg-zinc-900">
              <h2 className="mb-4 text-xs font-semibold uppercase tracking-wider text-slate-400 dark:text-zinc-500">操作记录</h2>
              {contract.events.length === 0 ? (
                <p className="text-xs text-slate-400 dark:text-zinc-500">暂无操作记录</p>
              ) : (
                <div className="space-y-0">
                  {contract.events.map((event, idx) => {
                    const isLast = idx === contract.events.length - 1
                    const actionLabels: Record<string, string> = {
                      create: "创建订单", pay: "支付", cancel_before_pay: "取消订单", provider_accept: "接单",
                      provider_depart: "出发", provider_arrive: "到达", start_service: "开始服务",
                      request_complete: "请求完成", confirm_complete: "确认完成", open_dispute: "发起争议",
                      cancel_during_service: "取消服务", settle_cancelled: "订单归档", batch_release: "批量释放",
                      auto_complete: "自动完成",
                    }
                    return (
                      <div key={event.id} className="relative flex gap-3 pb-4">
                        <div className="flex flex-col items-center">
                          <div className={cn(
                            "z-10 flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[8px] font-bold",
                            isLast ? "bg-indigo-600 text-white" : "bg-slate-100 text-slate-500 dark:bg-zinc-800 dark:text-zinc-400",
                          )}>{contract.events.length - idx}</div>
                          {idx < contract.events.length - 1 && <div className="mt-0.5 h-full w-px bg-slate-100 dark:bg-zinc-800" />}
                        </div>
                        <div className="min-w-0 flex-1 pt-0">
                          <div className="flex items-center justify-between">
                            <p className="text-xs font-medium text-slate-900 dark:text-zinc-100">{actionLabels[event.action] || event.action}</p>
                            <time className="shrink-0 text-[10px] text-slate-400 dark:text-zinc-500">{new Date(event.created_at).toLocaleString("zh-CN")}</time>
                          </div>
                          {event.reason && <p className="mt-0.5 text-[10px] text-slate-400 dark:text-zinc-500">{event.reason}</p>}
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>

            {/* Reviews */}
            {contract.reviews.length > 0 && (
              <div className="rounded-2xl border border-slate-200/60 bg-white p-6 dark:border-zinc-800/60 dark:bg-zinc-900">
                <h2 className="mb-4 text-xs font-semibold uppercase tracking-wider text-slate-400 dark:text-zinc-500">服务评价</h2>
                <div className="space-y-3">
                  {contract.reviews.map((review) => (
                    <div key={review.id} className="border-b border-slate-100 pb-3 last:border-0 last:pb-0 dark:border-zinc-800">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-semibold text-slate-900 dark:text-zinc-100">{review.reviewer.name}</span>
                        <span className="text-yellow-500 text-xs">{"★".repeat(review.rating)}{"☆".repeat(5 - review.rating)}</span>
                        <span className="text-[10px] text-slate-400 dark:text-zinc-500">{new Date(review.created_at).toLocaleDateString("zh-CN")}</span>
                      </div>
                      {review.comment && <p className="mt-1 text-xs text-slate-500 dark:text-zinc-400">{review.comment}</p>}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* ══ RIGHT: Control Panel ══ */}
          <aside className="lg:sticky lg:top-6 lg:self-start">
            <div className="flex flex-col gap-4 rounded-3xl border border-slate-200/60 bg-white p-6 shadow-sm dark:border-zinc-800/60 dark:bg-zinc-900">
              {/* Status + Amount */}
              <div className="text-center">
                <Badge className={cn("border-0", st.color)}>
                  {st.label}
                </Badge>
                <p className="mt-3 text-3xl font-black text-slate-900 tabular-nums dark:text-zinc-100">
                  ¥{contract.amount.toFixed(2)}
                </p>
                <p className="mt-0.5 text-[10px] text-slate-400 dark:text-zinc-500">合约金额</p>
              </div>

              {/* Payment section */}
              {contract.payments.length > 0 && (
                <div className="rounded-xl border border-slate-100 bg-slate-50 p-4 dark:border-zinc-800 dark:bg-zinc-800/50">
                  <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400 dark:text-zinc-500 mb-2">支付明细</p>
                  <div className="space-y-1.5">
                    {contract.payments.map((payment) => (
                      <div key={payment.id} className="flex items-center justify-between text-xs">
                        <span className="text-slate-600 dark:text-zinc-400">¥{payment.amount.toFixed(2)}</span>
                        <Badge className={cn("border-0 text-[9px]", payment.status === "RELEASED" ? "bg-emerald-50 text-emerald-600 dark:bg-emerald-950/30 dark:text-emerald-400" : payment.status === "ESCROW" ? "bg-indigo-50 text-indigo-600 dark:bg-indigo-950/30 dark:text-indigo-400" : "bg-amber-50 text-amber-600 dark:bg-amber-950/30 dark:text-amber-400")}>
                          {payment.status === "RELEASED" ? "已释放" : payment.status === "ESCROW" ? "托管中" : "待支付"}
                        </Badge>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Payment channel selection */}
              {canPay && paymentChannels.length > 0 && !activePayment && (
                <div className="flex flex-col gap-2">
                  {paymentChannels.map((ch) => (
                    <Button key={ch} onClick={() => handlePayment(ch)} disabled={payLoading !== null} className="touch-target rounded-xl py-5 font-bold shadow-sm active:scale-[0.98]" size="lg">
                      {payLoading === ch ? <Loader2 className="mr-2 size-4 animate-spin" /> : null}
                      {ch === "alipay" ? "支付宝支付" : "微信支付"}
                    </Button>
                  ))}
                </div>
              )}

              {/* QR payment */}
              {activePayment && (
                <div className="space-y-3">
                  <p className="text-xs font-semibold text-slate-900 dark:text-zinc-100 text-center">扫码支付</p>
                  {activePayment.qrCode && (
                    <div className="flex flex-col items-center gap-2">
                      <div className="rounded-lg border bg-white p-3"><img src={`https://api.qrserver.com/v1/create-qr-code/?size=180x180&data=${encodeURIComponent(activePayment.qrCode)}`} alt="QR" className="h-40 w-40" /></div>
                      <p className="text-[10px] text-slate-500">请使用{activePayment.channel === "alipay" ? "支付宝" : "微信"}扫码</p>
                    </div>
                  )}
                  {activePayment.payUrl && <Button size="lg" className="w-full rounded-xl" onClick={() => window.open(activePayment.payUrl!, "_blank")}><ExternalLink className="mr-2 size-4" />前往支付</Button>}
                  {!activePayment.mock && <div className="flex items-center justify-center gap-2 text-xs text-slate-400"><Loader2 className="size-3 animate-spin" />等待支付确认</div>}
                  <Button variant="ghost" size="sm" className="w-full text-xs" onClick={() => { stopPolling(); setActivePayment(null) }}>取消支付</Button>
                </div>
              )}

              {/* Role-based actions */}
              <div className="flex flex-col gap-3">
                {currentStep === 2 && isCustomer && (
                  <Button className="w-full rounded-xl bg-emerald-600 py-5 text-base font-bold shadow-sm hover:bg-emerald-700 touch-feedback active:scale-[0.98]" size="lg" onClick={playCoinDrop}>
                    <CheckCircle2 className="mr-2 size-4" />验证无误，释放资金
                  </Button>
                )}
                {currentStep === 2 && isProvider && (
                  <Button className="w-full rounded-xl bg-indigo-600 py-5 text-base font-bold shadow-sm hover:bg-indigo-700 touch-feedback active:scale-[0.98]" size="lg" onClick={playContractSeal}>
                    <CheckCircle2 className="mr-2 size-4" />我已完工，申请验收
                  </Button>
                )}
                <OrderOperations contract={contract} orderId={orderId!} userRole={userRole} onActionSuccess={async () => {
                  const refreshed = await fetch(`/api/orders/${orderId}`)
                  if (refreshed.ok) { const d = await refreshed.json(); setContract(d.contract) }
                }} />
              </div>

              {/* SOS */}
              <Button variant="ghost" size="sm" className="touch-target w-full text-amber-600 hover:bg-amber-50 dark:text-amber-400 dark:hover:bg-amber-950/20 active:scale-[0.98]">
                <AlertTriangle className="mr-1.5 size-3" />申请官方介入 / SOS 纠纷
              </Button>
            </div>
          </aside>
        </div>
      </div>
    </div>
  )
}
