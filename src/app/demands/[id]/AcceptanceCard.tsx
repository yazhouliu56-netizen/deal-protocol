"use client"

import React, { useState } from "react"
import { toast } from "@/base/platform/toast";
import DuoButton from "@/components/ui/DuoButton"
import ConfirmSheet from "@/components/ui/ConfirmSheet"

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
  // 放款二次确认（直调 /api/payment/release 改显式确认，放款不可逆）
  const [confirmOpen, setConfirmOpen] = useState(false)

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
      toast(`验收成功，已放款 ￥${json.payout}`, "success")
    } catch (e) {
      setErrorMsg(e instanceof Error ? e.message : "网络异常，放款未执行")
    } finally {
      setIsReleasing(false)
    }
  }

  return (
    <div className="bg-white border border-zinc-200 rounded-2xl p-5 shadow-sm space-y-4">
      <div>
        <p className="text-xs text-zinc-400 mb-1">订单金额</p>
        <p className="text-3xl font-black text-zinc-900">
          {priceReady ? `￥${price}` : "待定价"}
        </p>
        <h2 className="text-base font-bold mt-2">{title}</h2>
      </div>

      {settled ? (
        <div className="p-3 bg-emerald-50 text-emerald-700 text-sm rounded-xl border border-emerald-200">
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
            onClick={() => setConfirmOpen(true)}
            disabled={isReleasing || !priceReady}
            data-testid="accept-release-btn"
          >
            {isReleasing ? "放款中…" : "确认验收并放款"}
          </DuoButton>
          {confirmOpen && (
            <ConfirmSheet
              title="确认验收并放款？"
              body={`放款 ￥${price} 后不可撤销，师傅将收到打款（平台抽成后）。`}
              danger
              confirmLabel="确认放款"
              onConfirm={() => {
                setConfirmOpen(false);
                void handleAccept();
              }}
              onCancel={() => setConfirmOpen(false)}
            />
          )}
        </div>
      ) : (
        <p className="text-sm text-zinc-400">当前状态：{status}（完工后可验收）</p>
      )}

      {errorMsg && (
        <div className="p-3 bg-red-50 text-red-500 text-xs rounded-xl border border-red-200">
                    {errorMsg}
        </div>
      )}
    </div>
  )
}
