"use client"

import React, { useState, useRef, useEffect } from "react"
import dynamic from "next/dynamic"
import Link from "next/link"
import toast from "react-hot-toast"
import { Skeleton } from "@/components/ui/Skeleton"
import { useFulfillmentMutation } from "@/hooks/useFulfillmentMutation"
import { getBrowserSupabase } from "@/lib/supabase-browser"
import { uploadPhotoWithRetry } from "@/lib/upload"

const MapWithNoSSR = dynamic(() => import("@/components/MapComponent").then((m) => ({ default: m.MapComponent })), {
  ssr: false,
  loading: () => <Skeleton className="h-64 w-full" />,
})

export interface DemandDetail {
  id: string
  title: string
  price: number
  status: "ASSIGNED" | "DEPARTED" | "ARRIVED" | "STARTED" | "COMPLETED"
  latitude: number
  longitude: number
  client_name?: string
  client_phone?: string
  address?: string
  certificate_images?: string[]
}

interface OrderFulfillmentClientProps {
  initialDemand: DemandDetail
  providerId: string
}

const STATUS_MAP = {
  ASSIGNED: { label: "已接单", next: "DEPARTED", btnText: "🔥 长按 1.5 秒出发前往现场" },
  DEPARTED: { label: "已出发", next: "ARRIVED", btnText: "📍 长按 1.5 秒确认到达现场" },
  ARRIVED: { label: "已到现场", next: "STARTED", btnText: "🛠️ 长按 1.5 秒开始提供服务" },
  STARTED: { label: "施工中", next: "COMPLETED", btnText: "🏁 长按 1.5 秒确认服务完工" },
  COMPLETED: { label: "已完工", next: null, btnText: "服务已结束" },
}

export default function OrderFulfillmentClient({
  initialDemand,
  providerId,
}: OrderFulfillmentClientProps) {
  const [demand, setDemand] = useState<DemandDetail>(initialDemand)
  const [loading, setLoading] = useState(false)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)
  const [uploadedImages, setUploadedImages] = useState<string[]>(demand.certificate_images || [])
  const [uploading, setUploading] = useState(false)
  const [isPressing, setIsPressing] = useState(false)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const duration = 1500

  const { execute: executeStatusTransition } = useFulfillmentMutation(
    `status_${demand.id}`,
    async (data: unknown) => {
      const { nextStatus, imageUrls } = data as { nextStatus: string; imageUrls: string[] }
      const res = await fetch(`/api/demands/${demand.id}/status`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ nextStatus, providerId, imageUrls }),
      })
      const json = await res.json()
      if (!res.ok || !json.success) {
        throw new Error(json.error || "状态更新失败")
      }
      return json
    },
  )

  const currentConfig = STATUS_MAP[demand.status]
  const isMissingCertificates = demand.status === "STARTED" && uploadedImages.length < 2

  const handleStatusAdvance = async () => {
    if (!currentConfig.next || loading || isMissingCertificates) return
    setLoading(true)
    setErrorMsg(null)

    try {
      const result = await executeStatusTransition({
        nextStatus: currentConfig.next,
        imageUrls: uploadedImages,
      }) as { success: boolean; updatedStatus: string }

      if (result.success) {
        toast.success("状态流转成功！")
        setDemand((prev) => ({ ...prev, status: result.updatedStatus as DemandDetail["status"] }))
      }
    } catch (e) {
      setErrorMsg(e instanceof Error ? e.message : "网络异常，更新未成功")
    } finally {
      setLoading(false)
      setIsPressing(false)
    }
  }

  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files || e.target.files.length === 0) return
    setUploading(true)
    setErrorMsg(null)

    try {
      const file = e.target.files[0]
      const publicUrl = await uploadPhotoWithRetry(file, demand.id)
      setUploadedImages((prev) => [...prev, publicUrl])
    } catch (err: unknown) {
      setErrorMsg(err instanceof Error ? err.message : "图片上传失败，已自动重试 3 次，请检查网速")
    } finally {
      setUploading(false)
    }
  }

  const startPress = () => {
    if (!currentConfig.next || loading || isMissingCertificates) return
    setIsPressing(true)
    timerRef.current = setTimeout(() => {
      handleStatusAdvance()
    }, duration)
  }

  const endPress = () => {
    setIsPressing(false)
    if (timerRef.current) {
      clearTimeout(timerRef.current)
      timerRef.current = null
    }
  }

  useEffect(() => {
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
          const newStatus = (payload.new as Partial<DemandDetail>).status
          if (newStatus && newStatus !== demand.status) {
            toast(`订单状态已更新: ${newStatus}`, { icon: "🔔" })
          }
          setDemand((prev) => ({ ...prev, ...(payload.new as Partial<DemandDetail>) }) as DemandDetail)
        },
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
      if (timerRef.current) clearTimeout(timerRef.current)
    }
  }, [demand.id])

  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950 pb-24 text-zinc-900 dark:text-zinc-100 select-none">
      <header className="bg-zinc-900 text-white p-4 sticky top-0 z-50 flex items-center justify-between shadow">
        <span className="text-sm font-medium">工单 ID: {demand.id.slice(0, 8)}...</span>
        <span className="bg-blue-500 text-white text-xs px-2 py-0.5 rounded-full font-bold">
          {currentConfig.label}
        </span>
      </header>

      <div className="max-w-md mx-auto p-4 space-y-4">
        <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl p-5 shadow-sm text-center">
          <p className="text-xs text-zinc-400 mb-1">应收服务费</p>
          <p className="text-3xl font-black text-emerald-600 dark:text-emerald-400 mb-3">￥{demand.price}</p>
          <h2 className="text-base font-bold">{demand.title}</h2>
        </div>

        <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl p-5 shadow-sm space-y-3">
          <h3 className="text-xs font-bold uppercase tracking-wider text-zinc-400">联系人与地址信息</h3>
          <div className="text-sm space-y-2">
            <p><span className="text-zinc-400">客户姓名：</span>{demand.client_name || "张先生 (系统脱敏)"}</p>
            <p><span className="text-zinc-400">服务地址：</span>{demand.address || "北京市海淀区中关村南大街1号"}</p>
          </div>
          <MapWithNoSSR lat={demand.latitude} lng={demand.longitude} />
          <div className="grid grid-cols-3 gap-3 pt-2">
            <a
              href={`tel:${demand.client_phone || "13800000000"}`}
              className="touch-target flex items-center justify-center gap-2 border border-zinc-200 dark:border-zinc-800 py-3 rounded-xl text-xs font-medium bg-zinc-50 dark:bg-zinc-950 hover:bg-zinc-100 active:scale-95 transition-transform"
            >
              📞 拨打电话
            </a>
            <button
              onClick={() => alert(`唤起导航至: [${demand.latitude}, ${demand.longitude}]`)}
              className="touch-target flex items-center justify-center gap-2 border border-zinc-200 dark:border-zinc-800 py-3 rounded-xl text-xs font-medium bg-zinc-50 dark:bg-zinc-950 hover:bg-zinc-100 active:scale-95 transition-transform"
            >
              🗺️ 开启导航
            </button>
            <Link
              href={`/chat/${demand.id}`}
              className="touch-target flex items-center justify-center gap-2 border border-zinc-200 dark:border-zinc-800 py-3 rounded-xl text-xs font-medium bg-zinc-50 dark:bg-zinc-950 hover:bg-zinc-100 active:scale-95 transition-transform"
            >
              💬 发起聊天
            </Link>
          </div>
        </div>

        <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl p-5 shadow-sm">
          <h3 className="text-xs font-bold uppercase tracking-wider text-zinc-400 mb-4">履约进度条</h3>
          <div className="flex justify-between items-center text-xs relative">
            {Object.keys(STATUS_MAP).map((statusKey, index) => {
              const currentStatusIndex = Object.keys(STATUS_MAP).indexOf(demand.status)
              const isPastOrCurrent = index <= currentStatusIndex
              return (
                <div key={statusKey} className="flex flex-col items-center z-10 flex-1">
                  <div className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold transition-all ${isPastOrCurrent ? "bg-emerald-500 text-white" : "bg-zinc-200 dark:bg-zinc-800 text-zinc-400"}`}>
                    {index + 1}
                  </div>
                  <span className="mt-1 text-[10px] scale-90">{STATUS_MAP[statusKey as keyof typeof STATUS_MAP].label}</span>
                </div>
              )
            })}
          </div>
        </div>

        {(demand.status === "STARTED" || demand.status === "COMPLETED") && (
          <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl p-5 shadow-sm space-y-3">
            <div className="flex justify-between items-center">
              <h3 className="text-xs font-bold uppercase tracking-wider text-zinc-400">
                完工施工凭证 <span className="text-red-500">(必填, 至少2张)</span>
              </h3>
              <span className="text-xs text-zinc-500">{uploadedImages.length}/5</span>
            </div>

            <div className="grid grid-cols-3 gap-2">
              {uploadedImages.map((url, i) => (
                <div key={i} className="aspect-square relative rounded-xl overflow-hidden border border-zinc-100 dark:border-zinc-800">
                  <img src={url} alt="完工凭证" className="w-full h-full object-cover" />
                </div>
              ))}

              {demand.status === "STARTED" && uploadedImages.length < 5 && (
                <button
                  onClick={() => fileInputRef.current?.click()}
                  disabled={uploading}
                  className="touch-target aspect-square flex flex-col items-center justify-center border-2 border-dashed border-zinc-200 dark:border-zinc-800 rounded-xl hover:bg-zinc-50 dark:hover:bg-zinc-950 active:scale-95 transition-transform disabled:opacity-50"
                >
                  {uploading ? (
                    <div className="w-5 h-5 border-2 border-zinc-400 border-t-transparent rounded-full animate-spin" />
                  ) : (
                    <>
                      <span className="text-xl">📸</span>
                      <span className="text-[10px] text-zinc-400 mt-1">现场拍照</span>
                    </>
                  )}
                </button>
              )}
            </div>

            <input
              type="file"
              accept="image/*"
              capture="environment"
              ref={fileInputRef}
              onChange={handlePhotoUpload}
              className="hidden"
            />
          </div>
        )}

        {errorMsg && (
          <div className="p-3 bg-red-50 dark:bg-red-950/30 text-red-500 text-xs rounded-xl border border-red-200 dark:border-red-900/50">
            ⚠️ {errorMsg}
          </div>
        )}
      </div>

      {currentConfig.next && (
        <div className="fixed bottom-0 left-0 right-0 p-4 pb-[max(env(safe-area-inset-bottom,0px),1rem)] bg-white/80 dark:bg-zinc-950/80 backdrop-blur border-t border-zinc-200 dark:border-zinc-800 flex justify-center z-50">
          <div
            className={`relative w-full max-w-md h-14 rounded-xl overflow-hidden shadow select-none transition-all touch-manipulation ${isMissingCertificates ? "bg-zinc-100 dark:bg-zinc-800 cursor-not-allowed opacity-75" : "bg-zinc-200 dark:bg-zinc-800 cursor-pointer active:scale-[0.98]"}`}
            onMouseDown={startPress}
            onMouseUp={endPress}
            onMouseLeave={endPress}
            onTouchStart={startPress}
            onTouchEnd={endPress}
          >
            {!isMissingCertificates && (
              <div
                className="absolute left-0 top-0 bottom-0 bg-emerald-500 origin-left"
                style={{
                  width: isPressing ? "100%" : "0%",
                  transition: isPressing ? "width 1500ms linear" : "width 200ms ease-out",
                }}
              />
            )}

            <div className="absolute inset-0 flex items-center justify-center font-bold text-sm text-zinc-900 dark:text-white pointer-events-none mix-blend-difference">
              {loading ? (
                <div className="w-5 h-5 border-2 border-current border-t-transparent rounded-full animate-spin" />
              ) : isMissingCertificates ? (
                `⚠️ 请先拍 ${2 - uploadedImages.length} 张完工照 (还差 ${2 - uploadedImages.length} 张)`
              ) : (
                currentConfig.btnText
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
