"use client"

import React, { useState, useEffect } from "react"
import toast from "react-hot-toast"
import { getBrowserSupabase } from "@/lib/supabase-browser"
import SwipeableCard, { IncomingDemand } from "@/components/SwipeableCard"

function getHaversineDistance(lat1: number, lon1: number, lat2: number, lon2: number) {
  const toRad = (x: number) => (x * Math.PI) / 180
  const R = 6371
  const dLat = toRad(lat2 - lat1)
  const dLon = toRad(lon2 - lon1)
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2)
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
}

interface IncomingListClientProps {
  initialDemands: IncomingDemand[]
}

export default function IncomingListClient({ initialDemands }: IncomingListClientProps) {
  const [demands, setDemands] = useState<IncomingDemand[]>(initialDemands)
  const [geo, setGeo] = useState({ lat: 39.915, lng: 116.404 })
  const [verificationStatus, setVerificationStatus] = useState<string | undefined>(undefined)

  useEffect(() => {
    fetch("/api/profile")
      .then((res) => res.json())
      .then((data) => setVerificationStatus(data.user?.verification_status))
      .catch(() => {})
  }, [])

  useEffect(() => {
    if (!navigator.geolocation) return
    const watchId = navigator.geolocation.watchPosition(
      (pos) => setGeo({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
      () => {},
      { enableHighAccuracy: true },
    )
    return () => navigator.geolocation.clearWatch(watchId)
  }, [])

  useEffect(() => {
    const supabase = getBrowserSupabase()
    const channel = supabase
      .channel("realtime:public:demands")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "demands" },
        (payload) => {
          const { eventType, new: newRecord, old: oldRecord } = payload

          if (eventType === "INSERT" && (newRecord as any).status === "OPEN") {
            setDemands((prev) => [{ ...(newRecord as any), isNew: true } as IncomingDemand, ...prev])
          } else if (eventType === "UPDATE") {
            if ((newRecord as any).status !== "OPEN") {
              setDemands((prev) => prev.filter((d) => d.id !== newRecord.id))
            } else {
              setDemands((prev) =>
                prev.map((d) =>
                  d.id === newRecord.id ? ({ ...d, ...(newRecord as any) } as IncomingDemand) : d,
                ),
              )
            }
          } else if (eventType === "DELETE") {
            setDemands((prev) => prev.filter((d) => d.id !== oldRecord.id))
          }
        },
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [])

  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950 pb-12">
      <header className="bg-gradient-to-r from-zinc-900 to-zinc-800 text-white p-4 sticky top-0 z-50 flex justify-between items-center shadow-sm">
        <h1 className="text-base font-bold">实时接单需求池</h1>
        <span className="text-xs bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 px-2 py-0.5 rounded-full animate-pulse">
          ⚡ 动态雷达定位中
        </span>
      </header>

      <div className="p-4 space-y-4 max-w-md mx-auto">
        {demands.length === 0 ? (
          <div className="text-center text-zinc-400 dark:text-zinc-600 py-24 text-sm">
            暂无附近待接工单，请保持屏幕常亮...
          </div>
        ) : (
          demands.map((demand) => {
            const distance = getHaversineDistance(
              geo.lat, geo.lng,
              demand.latitude, demand.longitude,
            )
            return (
              <SwipeableCard
                key={demand.id}
                order={demand}
                currentDistance={distance}
                verificationStatus={verificationStatus}
                onAcceptSuccess={(id) => {
                  setDemands((prev) => prev.filter((d) => d.id !== id))
                  toast.success("接单锁定成功！")
                }}
                onAcceptFailure={(reason) => alert(reason)}
              />
            )
          })
        )}
      </div>
    </div>
  )
}
