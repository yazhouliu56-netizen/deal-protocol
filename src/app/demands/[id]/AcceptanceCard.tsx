"use client"

import React, { useState } from "react"

interface AcceptanceCardProps {
  title: string
  price: number | null
  status: string
  releasedAt: string | null
  /** P2：有孪生合同 → 放款入口退役，只展示合同验收指引。 */
  hasContract?: boolean
}

// P2 退役 demands 放款（路由＋引擎已删除）：验收卡只做状态展示，不再发起任何放款调用。
// 有孪生合同 → 指引去合同验收；无合同（未托管）→ 无背书放款，只展示状态。
export default function AcceptanceCard({ title, price, status, releasedAt, hasContract = false }: AcceptanceCardProps) {
  const [settled] = useState<{ payout: number; fee: number; releasedAt: string } | null>(
    status === "settled" ? { payout: 0, fee: 0, releasedAt: releasedAt ?? "" } : null,
  )

  const priceReady = price != null && Number(price) > 0

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
      ) : hasContract ? (
        <div className="p-3 bg-sky-50 text-sky-700 text-sm rounded-xl border border-sky-200">
          本单已纳入合同结算（85% 确认即释 + 15% 评价暂扣），请前往合同验收查看进度。
          当前状态：{status}。
        </div>
      ) : (
        <p className="text-sm text-zinc-400">当前状态：{status}（托管签约后进入合同验收）</p>
      )}
    </div>
  )
}
