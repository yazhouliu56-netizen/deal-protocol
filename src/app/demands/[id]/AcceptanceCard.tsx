"use client"

import React, { useState } from "react"
import toast from "react-hot-toast"
import DuoButton from "@/components/ui/DuoButton"

interface AcceptanceCardProps {
  orderId: string
  title: string
  price: number | null
  status: string
  releasedAt: string | null
}

export default function AcceptanceCard({ orderId, title, price, status, releasedAt }: AcceptanceCardProps) {
  const [isReleasing, setIsReleasing] = useState(false)
  const [settled, setSettled] = useState<{ payout: number; fee: number; releasedAt: string } | null>(
    status === "settled" ? { payout: 0, fee: 0, releasedAt: releasedAt ?? "" } : null,
  )
  const [errorMsg, setErrorMsg] = useState<string | null>(null)

  const awaitable = status === "COMPLETED" && !releasedAt && !settled
  const priceReady = price != null && Number(price) > 0

  const handleAccept = async () => {
    if (isReleasing || !awaitable || !priceReady) return
    setIsReleasing(true)
    setErrorMsg(null)
    try {
      const res = await fetch("/api/payment/release", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ orderId }),
      })
      const json = await res.json()
      if (res.status === 409) {
        setErrorMsg("订单已结算，请勿重复点击")
        return
      }
      if (!res.ok || !json.success) {
        throw new Error(json.message || json.error || "放款失败")
      }
      setSettled({ payout: json.payout, fee: json.fee, releasedAt: json.releasedAt })
      toast.success(`验收成功，已放款 ￥${json.payout}`)
    } catch (e) {
      setErrorMsg(e instanceof Error ? e.message : "网络异常，放款未执行")
    } finally {
      setIsReleasing(false)
    }
  }

  return (
    <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl p-5 shadow-sm space-y-4">
      <div>
        <p className="text-xs text-zinc-400 mb-1">订单金额</p>
        <p className="text-3xl font-black text-zinc-900 dark:text-white">
          {priceReady ? `￥${price}` : "待定价"}
        </p>
        <h2 className="text-base font-bold mt-2">{title}</h2>
      </div>

      {settled ? (
        <div className="p-3 bg-emerald-50 dark:bg-emerald-950/30 text-emerald-700 dark:text-emerald-300 text-sm rounded-xl border border-emerald-200 dark:border-emerald-900/50">
                    已结算{settled.payout > 0 && <>：师傅实收 ￥{settled.payout}，平台保障费 ￥{settled.fee}</>}
        </div>
      ) : awaitable ? (
        <div className="space-y-3">
          <p className="text-sm text-zinc-500">师傅已完工，请确认验收。验收后平台将按阶梯抽成打款给师傅。</p>
          {!priceReady && (
            <p className="text-xs text-amber-600">订单金额缺失，暂不可放款（ORDER_AMOUNT_INVALID）</p>
          )}
          <DuoButton
            variant="primary"
            size="lg"
            fullWidth
            sound="click"
            onClick={handleAccept}
            disabled={isReleasing || !priceReady}
            data-testid="accept-release-btn"
          >
            {isReleasing ? "放款中…" : "确认验收并放款"}
          </DuoButton>
        </div>
      ) : (
        <p className="text-sm text-zinc-400">当前状态：{status}（完工后可验收）</p>
      )}

      {errorMsg && (
        <div className="p-3 bg-red-50 dark:bg-red-950/30 text-red-500 text-xs rounded-xl border border-red-200 dark:border-red-900/50">
                    {errorMsg}
        </div>
      )}
    </div>
  )
}
