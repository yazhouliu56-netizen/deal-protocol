import { redirect } from "next/navigation"

/**
 * 根路由重定向（C16 收编）：/provider → /dp/provider
 * 管理台资产已平移至 /dp 协议专区，本页保留 307 重定向保障老链接平滑过渡。
 */
export default function ProviderPage() {
  redirect("/dp/provider")
}
