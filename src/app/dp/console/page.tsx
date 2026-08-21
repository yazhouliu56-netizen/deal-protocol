"use client"

import { useRouter } from "next/navigation"
import ClientConsole from "@/components/ClientConsole"

/**
 * 协议专区 · 契约派单控制台（/dp/console）
 * C16 收编落点：原 /console 平移归位至 /dp 协议专区，根路由 /console 保留优雅重定向。
 * 管理台资产完整性 100% 保留（ClientConsole 调试逻辑零改动，红线 3 单向依赖）。
 */
export default function DpConsolePage() {
  const router = useRouter()
  return <ClientConsole onBackToHome={() => router.push("/dp")} />
}
