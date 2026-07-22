"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import toast from "react-hot-toast"
import { ShieldCheck, Loader2, ArrowLeft, CheckCircle } from "lucide-react"

export default function PaymentCheckoutPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const router = useRouter()
  const [orderId, setOrderId] = useState<string | null>(null)
  const [demand, setDemand] = useState<{ title: string; price: number; status: string } | null>(null)
  const [loading, setLoading] = useState(true)
  const [paying, setPaying] = useState(false)

  useEffect(() => {
    params.then(({ id }) => setOrderId(id))
  }, [params])

  useEffect(() => {
    if (!orderId) return

    fetch(`/api/orders/${orderId}`)
      .then((r) => r.json())
      .then((data) => {
        const d = data.contract?.demand ?? data.demand ?? null
        setDemand(d)
      })
      .catch(() => toast.error("加载订单信息失败"))
      .finally(() => setLoading(false))
  }, [orderId])

  const handlePay = async () => {
    if (!orderId) return
    setPaying(true)

    try {
      const res = await fetch("/api/payment/escrow", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ orderId }),
      })
      const data = await res.json()

      if (!res.ok) {
        toast.error(data.error || "支付失败")
        setPaying(false)
        return
      }

      toast.success("支付成功，资金已安全托管至平台")
      await new Promise((r) => setTimeout(r, 1000))
      router.push(`/client/orders/${orderId}`)
    } catch {
      toast.error("网络错误，请重试")
      setPaying(false)
    }
  }

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-zinc-950">
        <Loader2 className="size-6 animate-spin text-zinc-400" />
      </div>
    )
  }

  return (
    <div className="flex min-h-screen flex-col bg-zinc-950">
      <div className="flex items-center gap-3 border-b border-zinc-800 px-6 py-4">
        <button
          onClick={() => router.back()}
          className="flex size-9 items-center justify-center rounded-xl border border-zinc-800 bg-zinc-900 text-zinc-400 transition-colors hover:text-zinc-200"
        >
          <ArrowLeft className="size-4" />
        </button>
        <div>
          <h1 className="text-sm font-bold text-zinc-100">确认支付</h1>
          <p className="text-xs text-zinc-500">资金托管至平台，服务完成后再放款</p>
        </div>
      </div>

      <div className="flex flex-1 flex-col items-center justify-center px-6 pb-16">
        <div className="w-full max-w-sm space-y-8">
          {demand && (
            <div className="rounded-2xl border border-zinc-800 bg-zinc-900/60 p-6 backdrop-blur-sm">
              <p className="text-xs font-medium text-zinc-500">订单名称</p>
              <p className="mt-1 text-base font-bold text-zinc-100">{demand.title}</p>

              <div className="mt-5 flex items-baseline justify-center gap-1">
                <span className="text-sm text-zinc-500">¥</span>
                <span className="text-4xl font-extrabold tracking-tight text-white">
                  {demand.price?.toFixed(2) ?? "0.00"}
                </span>
              </div>

              <div className="mt-6 space-y-3 rounded-xl bg-zinc-950 p-4 text-xs">
                <div className="flex justify-between text-zinc-400">
                  <span>托管金额</span>
                  <span className="font-medium text-zinc-200">¥{demand.price?.toFixed(2) ?? "0.00"}</span>
                </div>
                <div className="flex justify-between text-zinc-400">
                  <span>平台服务费</span>
                  <span className="font-medium text-zinc-200">¥0.00（确认放款时扣除）</span>
                </div>
                <div className="border-t border-zinc-800 pt-3">
                  <div className="flex justify-between text-zinc-400">
                    <span className="flex items-center gap-1.5">
                      <ShieldCheck className="size-3.5 text-emerald-500" />
                      资金保障
                    </span>
                    <span className="font-medium text-emerald-400">安心托管</span>
                  </div>
                </div>
              </div>
            </div>
          )}

          <p className="text-center text-xs leading-relaxed text-zinc-600">
            支付完成后资金将由平台暂时托管，待您确认服务完成后再放款至服务商。
          </p>

          <button
            onClick={handlePay}
            disabled={paying}
            className="flex w-full items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-indigo-600 to-violet-600 py-4 text-sm font-bold text-white shadow-lg shadow-indigo-600/20 transition-all hover:from-indigo-500 hover:to-violet-500 active:scale-[0.98] disabled:opacity-50"
          >
            {paying ? (
              <>
                <Loader2 className="size-4 animate-spin" />
                处理中...
              </>
            ) : (
              <>
                <CheckCircle className="size-4" />
                确认支付托管金
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  )
}
