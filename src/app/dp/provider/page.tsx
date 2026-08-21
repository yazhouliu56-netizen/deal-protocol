"use client"

import ProviderConsole from "@/components/ProviderConsole"

/**
 * 协议专区 · 服务商控制台（/dp/provider）
 * C16 收编落点：原 /provider 平移归位至 /dp 协议专区，根路由 /provider 保留优雅重定向。
 * WorkerWorkbench + FulfillmentCockpit 已接管 OTO 前台接单履约，本页保留老协议管理视角供协议后台调试验收。
 */
export default function DpProviderPage() {
  return <ProviderConsole />
}
