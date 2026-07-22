"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import toast from "react-hot-toast"
import GrabConsole from "@/components/GrabConsole"

interface GrabConsoleClientWrapperProps {
  demandId: string
  initialTimeLeft: number
  initialCompetitors: { id: string; avatar: string; name: string }[]
}

export default function GrabConsoleClientWrapper({
  demandId,
  initialTimeLeft,
  initialCompetitors,
}: GrabConsoleClientWrapperProps) {
  const router = useRouter()
  const [verificationStatus, setVerificationStatus] = useState<string | undefined>(undefined)

  useEffect(() => {
    fetch("/api/profile")
      .then((res) => res.json())
      .then((data) => setVerificationStatus(data.user?.verification_status))
      .catch(() => {})
  }, [])

  const handleGrabSuccess = () => {
    toast.success("抢单成功！")
    router.push(`/orders/${demandId}`)
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
