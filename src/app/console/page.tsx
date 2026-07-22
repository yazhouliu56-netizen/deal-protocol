"use client"

import { useRouter } from "next/navigation"
import ClientConsole from "@/components/ClientConsole"

export default function ConsolePage() {
  const router = useRouter()

  return <ClientConsole onBackToHome={() => router.push("/dashboard")} />
}
