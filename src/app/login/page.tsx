import { redirect } from "next/navigation"

/**
 * 老版全页登录已迁入 /dp/login（协议管理专区），前台统一经 OTO AuthSheet
 * （/?auth=open 唤起）。本路由仅作服务端重定向兜底，保证旧链接/外部书签
 * 及未登录守卫（proxy.ts 指向 /login）100% 整页落地到前台登录抽屉。
 */
export default function LoginPage() {
  redirect("/?auth=open")
}