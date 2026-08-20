import { redirect } from "next/navigation"

/**
 * 老版注册页已随登录一起迁入 /dp/login（协议管理专区），前台注册统一走
 * OTO AuthSheet（/?auth=open 唤起）。本路由仅作服务端重定向兜底，
 * 保证旧链接/外部书签 100% 整页落地到前台登录抽屉。
 */
export default function RegisterPage() {
  redirect("/?auth=open")
}