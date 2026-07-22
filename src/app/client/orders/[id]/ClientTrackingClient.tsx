"use client"

import React, { useState, useEffect } from "react"
import Link from "next/link"
import { getBrowserSupabase } from "@/lib/supabase-browser"
import toast from "react-hot-toast"

interface DemandData {
  id: string
  title: string
  price: number
  status: string
  certificate_images?: string[]
  client_name?: string
}

const STATUS_MAP: Record<string, { title: string; desc: string }> = {
  pending_payment: { title: "待付款", desc: "订单已创建，请支付托管金以开始服务" },
  ASSIGNED: { title: "已接单", desc: "师傅正在准备出发" },
  paid_escrow: { title: "资金已托管", desc: "您的资金已安全托管至平台，服务进行中" },
  DEPARTED: { title: "已出发", desc: "师傅正在赶往您的路上" },
  ARRIVED: { title: "已到达", desc: "师傅已到达现场，准备开工" },
  STARTED: { title: "施工中", desc: "师傅正在为您服务中" },
  COMPLETED: { title: "已完工", desc: "服务已结束，请确认验收并放款" },
  settled: { title: "已结算", desc: "资金已释放至服务商钱包，订单圆满结束" },
}

const FULFILLMENT_STEPS = ["ASSIGNED", "DEPARTED", "ARRIVED", "STARTED", "COMPLETED"]

const STATUS_TOAST: Record<string, string> = {
  ASSIGNED: "师傅已接单，准备出发",
  DEPARTED: "师傅已出发，正在赶往您的位置",
  ARRIVED: "师傅已到达您的位置",
  STARTED: "师傅开始施工",
  COMPLETED: "服务已完工，感谢您的信任",
}

export default function ClientTrackingClient({ initialData }: { initialData: DemandData | null }) {
  const [demand, setDemand] = useState<DemandData | null>(initialData)
  const [settling, setSettling] = useState(false)
  const [showConfirm, setShowConfirm] = useState(false)

  useEffect(() => {
    if (!demand) return
    const supabase = getBrowserSupabase()
    const channel = supabase
      .channel(`demand:${demand.id}`)
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "demands",
          filter: `id=eq.${demand.id}`,
        },
        (payload) => {
          const newStatus = (payload.new as Partial<DemandData>).status
          if (newStatus && newStatus !== demand.status) {
            const msg = STATUS_TOAST[newStatus]
            if (msg) toast(msg, { icon: "🔔" })
          }
          setDemand((prev) => ({ ...prev, ...(payload.new as Partial<DemandData>) }) as DemandData)
        },
      )
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [demand?.id, demand?.status])

  const handleSettle = async () => {
    if (!demand) return
    setSettling(true)
    setShowConfirm(false)

    try {
      const res = await fetch("/api/payment/release", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ orderId: demand.id }),
      })
      const data = await res.json()

      if (!res.ok) {
        toast.error(data.error || "放款失败")
        setSettling(false)
        return
      }

      toast.success("资金已成功解冻至师傅钱包！")
      setDemand((prev) => prev ? { ...prev, status: "settled" } : null)
    } catch {
      toast.error("网络错误，请重试")
    } finally {
      setSettling(false)
    }
  }

  if (!demand || !demand.id || (!STATUS_MAP[demand.status] && !["pending_payment", "paid_escrow", "settled"].includes(demand.status))) {
    return (
      <div className="min-h-screen bg-zinc-50 p-4 flex flex-col items-center justify-center dark:bg-zinc-950">
        <div className="max-w-sm text-center space-y-6">
          <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-full bg-zinc-100 dark:bg-zinc-900">
            <svg className="size-10 text-zinc-300 dark:text-zinc-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M20.25 7.5l-.625 10.632a2.25 2.25 0 01-2.247 2.118H6.622a2.25 2.25 0 01-2.247-2.118L3.75 7.5m8.25 3v6.75m0 0l-3-3m3 3l3-3M3.375 7.5h17.25c.621 0 1.125-.504 1.125-1.125v-1.5c0-.621-.504-1.125-1.125-1.125H3.375c-.621 0-1.125.504-1.125 1.125v1.5c0 .621.504 1.125 1.125 1.125z" />
            </svg>
          </div>
          <h2 className="text-xl font-bold text-zinc-900 dark:text-zinc-100">当前没有进行中的服务工单</h2>
          <p className="text-sm text-zinc-500 dark:text-zinc-400">您可以发布新需求，等待服务商接单</p>
          <Link
            href="/publish"
            className="inline-flex items-center justify-center gap-2 rounded-xl bg-indigo-600 px-6 py-3 text-sm font-semibold text-white shadow-sm transition-all hover:bg-indigo-500 active:scale-[0.97]"
          >
            去发布新需求
            <svg className="size-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5L21 12m0 0l-7.5 7.5M21 12H3" />
            </svg>
          </Link>
        </div>
      </div>
    )
  }

  const currentStepLabel = STATUS_MAP[demand.status]
  const steps = FULFILLMENT_STEPS
  const currentIdx = steps.indexOf(demand.status)
  const isCompleted = demand.status === "COMPLETED"
  const isSettled = demand.status === "settled"
  const isPendingPay = demand.status === "pending_payment"

  return (
    <div className="min-h-screen bg-zinc-50 p-4 dark:bg-zinc-950">
      <h1 className="text-xl font-bold mb-6 text-zinc-900 dark:text-zinc-100">{demand.title}</h1>

      <div className="bg-white dark:bg-zinc-900 p-6 rounded-2xl shadow-sm mb-6">
        <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100 mb-2">
          {currentStepLabel?.title ?? (isPendingPay ? "待付款" : isSettled ? "已结算" : demand.status)}
        </h2>
        <p className="text-zinc-500 dark:text-zinc-400 text-sm">
          {currentStepLabel?.desc ?? (isPendingPay ? "请完成支付以托管资金" : isSettled ? "订单已圆满结束" : "")}
        </p>

        {currentIdx >= 0 && (
          <div className="mt-6 flex justify-between">
            {steps.map((s, i) => (
              <div
                key={s}
                className={`w-3 h-3 rounded-full ${currentIdx >= i ? "bg-blue-500" : "bg-zinc-200 dark:bg-zinc-700"}`}
              />
            ))}
          </div>
        )}
      </div>

      <Link
        href={`/chat/${demand.id}`}
        className="flex items-center justify-center gap-2 mb-6 w-full border border-zinc-200 dark:border-zinc-800 py-3 rounded-xl text-sm font-medium bg-white dark:bg-zinc-900 hover:bg-zinc-50 dark:hover:bg-zinc-800 shadow-sm"
      >
        💬 联系服务方
      </Link>

      {isPendingPay && (
        <Link
          href={`/payment/${demand.id}`}
          className="flex items-center justify-center gap-2 mb-6 w-full rounded-xl bg-gradient-to-r from-indigo-600 to-violet-600 py-3.5 text-sm font-bold text-white shadow-lg shadow-indigo-600/20 transition-all hover:from-indigo-500 hover:to-violet-500 active:scale-[0.98]"
        >
          确认支付托管金 →
        </Link>
      )}

      {isCompleted && !isSettled && (
        <div className="space-y-3">
          <button
            onClick={() => setShowConfirm(true)}
            disabled={settling}
            className="flex items-center justify-center gap-2 w-full rounded-xl bg-gradient-to-r from-emerald-500 to-green-600 py-3.5 text-sm font-bold text-white shadow-lg shadow-emerald-600/20 transition-all hover:from-emerald-400 hover:to-green-500 active:scale-[0.98] disabled:opacity-50"
          >
            确认无误，通过平台放款
          </button>
        </div>
      )}

      {isSettled && (
        <div className="rounded-2xl border border-emerald-500/20 bg-emerald-500/5 p-6 text-center">
          <div className="mx-auto mb-3 flex size-14 items-center justify-center rounded-full bg-emerald-500/10">
            <svg className="size-7 text-emerald-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <h3 className="text-lg font-bold text-emerald-600 dark:text-emerald-400">订单已圆满结束</h3>
          <p className="mt-1 text-sm text-zinc-500">资金已释放至服务商钱包</p>
          <Link
            href="/publish"
            className="mt-4 inline-flex items-center gap-2 rounded-xl bg-indigo-600 px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition-all hover:bg-indigo-500"
          >
            发布新需求
            <svg className="size-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5L21 12m0 0l-7.5 7.5M21 12H3" />
            </svg>
          </Link>
        </div>
      )}

      {demand.certificate_images && demand.certificate_images.length > 0 ? (
        <div className="mt-6 bg-white dark:bg-zinc-900 p-6 rounded-2xl shadow-sm">
          <h3 className="font-bold mb-4 text-zinc-900 dark:text-zinc-100">完工凭证</h3>
          <div className="grid grid-cols-2 gap-3">
            {demand.certificate_images.map((url: string, i: number) => (
              <img key={i} src={url} alt="完工凭证" className="rounded-lg aspect-square object-cover" />
            ))}
          </div>
        </div>
      ) : (
        !isSettled && (
          <div className="bg-white dark:bg-zinc-900 p-6 rounded-2xl shadow-sm text-center">
            <p className="text-zinc-400 dark:text-zinc-500 text-sm">暂无施工凭证，服务进行中...</p>
          </div>
        )
      )}

      {showConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-4 backdrop-blur-sm">
          <div className="w-full max-w-sm rounded-2xl border border-zinc-800 bg-zinc-900 p-6 shadow-2xl">
            <h3 className="text-lg font-bold text-zinc-100">确认放款结算</h3>
            <p className="mt-2 text-sm text-zinc-400">
              确认后资金将从平台托管账户解冻，按分成比例（平台 10%，服务商 90%）释放至服务商钱包。此操作不可撤销。
            </p>
            <div className="mt-6 flex gap-3">
              <button
                onClick={() => setShowConfirm(false)}
                className="flex-1 rounded-xl border border-zinc-700 bg-zinc-800 py-2.5 text-sm font-medium text-zinc-300 transition-colors hover:bg-zinc-700"
              >
                取消
              </button>
              <button
                onClick={handleSettle}
                disabled={settling}
                className="flex-1 rounded-xl bg-emerald-600 py-2.5 text-sm font-bold text-white transition-colors hover:bg-emerald-500 disabled:opacity-50"
              >
                {settling ? "处理中..." : "确认放款"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
