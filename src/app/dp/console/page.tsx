import { redirect } from "next/navigation"

/**
 * 归流（Phase 2.1）：/dp/console 307 至真实供给接单池。
 * C16 合规：保留物理路由文件，101 路由不增不减；
 * ClientConsole 已 @deprecated 下线，需求侧发布走 /landing。
 */
export default function DpConsolePage() {
  redirect("/dp/provider/incoming")
}
