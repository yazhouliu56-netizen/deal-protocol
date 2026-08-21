import { redirect } from "next/navigation"

/**
 * 根路由重定向（C16 收编）：/console → /dp/console
 * 保留优雅重定向，彻底清理根路由命名空间，管理台资产已平移至协议专区。
 */
export default function ConsolePage() {
  redirect("/dp/console")
}
