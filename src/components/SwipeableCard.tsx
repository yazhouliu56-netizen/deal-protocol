"use client"

import React, { useState, useRef } from "react"

export interface IncomingDemand {
  id: string
  title: string
  price: number
  latitude: number
  longitude: number
  created_at: string
  isNew?: boolean
}

interface SwipeableCardProps {
  order: IncomingDemand
  currentDistance: number
  onAcceptSuccess: (id: string) => void
  onAcceptFailure: (reason: string) => void
  verificationStatus?: string
}

export default function SwipeableCard({
  order,
  currentDistance,
  onAcceptSuccess,
  onAcceptFailure,
  verificationStatus,
}: SwipeableCardProps) {
  const [startX, setStartX] = useState(0)
  const [currentX, setCurrentX] = useState(0)
  const [isSwiping, setIsSwiping] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)

  const maxSwipeDistance = 240

  const handleTouchStart = (e: React.TouchEvent) => {
    if (isSubmitting) return
    setStartX(e.touches[0].clientX)
    setIsSwiping(true)
  }

  const handleTouchMove = (e: React.TouchEvent) => {
    if (!isSwiping || isSubmitting) return
    const moveX = e.touches[0].clientX - startX
    if (moveX > 0) {
      setCurrentX(Math.min(moveX, maxSwipeDistance + 20))
    }
  }

  const handleTouchEnd = async () => {
    if (!isSwiping || isSubmitting) return
    setIsSwiping(false)

    if (currentX >= maxSwipeDistance * 0.8) {
      setCurrentX(maxSwipeDistance)
      await triggerAccept()
    } else {
      setCurrentX(0)
    }
  }

  const triggerAccept = async () => {
    if (verificationStatus && verificationStatus !== "approved") {
      onAcceptFailure("抢单失败：请先完成实名身份验证！")
      setCurrentX(0)
      setIsSubmitting(false)
      return
    }

    setIsSubmitting(true)
    try {
      const res = await fetch(`/api/demands/${order.id}/assign`, {
        method: "POST",
      })
      const data = await res.json()

      if (res.ok) {
        onAcceptSuccess(order.id)
      } else {
        onAcceptFailure(data.reason || "被其他师傅捷足先登了")
        setCurrentX(0)
        setIsSubmitting(false)
      }
    } catch {
      onAcceptFailure("网络异常，请重试")
      setCurrentX(0)
      setIsSubmitting(false)
    }
  }

  const progress = Math.min(currentX / maxSwipeDistance, 1)
  const highlightClass = order.isNew
    ? "border-2 border-orange-400 shadow-orange-100/60 dark:shadow-none animate-pulse"
    : "border border-gray-100 dark:border-zinc-800 shadow-sm"

  return (
    <div
      className={`relative overflow-hidden bg-white dark:bg-zinc-900 rounded-2xl p-5 transition-all duration-300 touch-manipulation ${highlightClass}`}
    >
      <div className="flex justify-between items-start mb-3">
        <span className="bg-blue-50 dark:bg-blue-950/40 text-blue-600 dark:text-blue-400 text-xs font-semibold px-2 py-1 rounded">
          🛠️ 家庭维修
        </span>
        <span className="text-xl font-black text-red-500">￥{order.price}</span>
      </div>

      <h3 className="text-base font-bold text-gray-800 dark:text-zinc-200 mb-2">
        {order.title}
      </h3>

      <div className="text-xs text-gray-500 dark:text-zinc-400 space-y-1 mb-5">
        <p>📍 距离您当前：<span className="text-blue-600 dark:text-blue-400 font-bold">{currentDistance.toFixed(2)} km</span></p>
        <p>⏱️ 发布时间：{new Date(order.created_at).toLocaleTimeString()}</p>
      </div>

      <div
        className="relative h-12 bg-gray-50 dark:bg-zinc-950 rounded-full flex items-center justify-center overflow-hidden select-none"
        style={{ backgroundColor: `rgba(34, 197, 94, ${progress * 0.12})` }}
      >
        <span className="text-xs font-medium text-gray-400 dark:text-zinc-500 pointer-events-none transition-opacity" style={{ opacity: 1 - progress * 1.8 }}>
          {isSubmitting ? "正在锁单中..." : "👉 向右滑动接此单"}
        </span>

        <div
          className="absolute left-0 top-0 bottom-0 bg-green-500 pointer-events-none transition-opacity"
          style={{ width: `${currentX}px`, opacity: 0.25, borderRadius: "9999px" }}
        />

        <div
          onTouchStart={handleTouchStart}
          onTouchMove={handleTouchMove}
          onTouchEnd={handleTouchEnd}
          className={`absolute left-1 w-10 h-10 bg-green-500 rounded-full flex items-center justify-center cursor-pointer shadow-md text-white font-black select-none active:bg-green-600 ${!isSwiping ? "transition-all duration-200" : ""}`}
          style={{ transform: `translateX(${currentX}px)`, willChange: "transform" }}
        >
          {isSubmitting ? (
            <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
          ) : (
            "»"
          )}
        </div>
      </div>
    </div>
  )
}
