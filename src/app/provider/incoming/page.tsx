import { redirect } from "next/navigation"

/**
 * 根路由重定向（C16 收编）：/provider/incoming → /dp/provider/incoming
 * SwipeableCard 滑动接单逻辑已平移至协议专区，本页保留重定向。
 */
export default function IncomingPage() {
  redirect("/dp/provider/incoming")
}
