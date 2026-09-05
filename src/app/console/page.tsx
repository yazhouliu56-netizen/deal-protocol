import { redirect } from "next/navigation"

/**
 * 根路由优雅重定向（C16 收编）：一步到位至真实供给接单池，
 * 消除经 /dp/console 的二次跳转。
 */
export default function ConsolePage() {
  redirect("/dp/provider/incoming")
}
