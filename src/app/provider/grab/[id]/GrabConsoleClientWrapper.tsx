"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import toast from "react-hot-toast"
import GrabConsole from "@/components/GrabConsole"

interface GrabConsoleClientWrapperProps {
  demandId: string
  initialCreatedAt: string
  initialCompetitors: {
    id: string
    avatar: string
    name: string
  }[]
}

export default function GrabConsoleClientWrapper({
  demandId,
  initialCreatedAt,
  initialCompetitors,
}: GrabConsoleClientWrapperProps) {
  const router = useRouter()
  const [verificationStatus, setVerificationStatus] = useState<string | undefined>(undefined)
  const [initialTimeLeft] = useState(() =>
    Math.max(0, 900 - Math.floor((Date.now() - new Date(initialCreatedAt).getTime()) / 1000)),
  )

  useEffect(() => {
    fetch("/api/profile")
      .then((res) => res.json())
      .then((data) => setVerificationStatus(data.user?.verification_status))
      .catch(() => {})
  }, [])

  const handleGrabSuccess = () => {
    toast.success("抢单成功！")
    // 存活路由：/orders/:id 不存在，履约唯一实体为 /provider/orders/[id]。
    router.push(`/provider/orders/${demandId}`)
    router.refresh()
  }

  const handleGrabFailure = (reason: string) => {
    toast.error(reason)
  }

  return (
    <GrabConsole
      demandId={demandId}
      initialTimeLeft={initialTimeLeft}
      initialCompetitors={initialCompetitors}
      onGrabSuccess={handleGrabSuccess}
      onGrabFailure={handleGrabFailure}
      verificationStatus={verificationStatus}
    />
  )
}
