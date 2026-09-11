"use client"

import { useState } from "react"
import Link from "next/link"
import { useSession } from "@/components/SessionProvider"
import { getBrowserSupabase } from "@/lib/supabase-browser"
import { useRouter, usePathname } from "next/navigation"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Menu, X, User, ChevronDown, FileText, ShieldCheck, LogOut, Scroll } from "lucide-react"
import NotificationBell from "@/components/NotificationBell"

export default function Header() {
  const { user: session, loading } = useSession()
  const router = useRouter()
  const pathname = usePathname()
  const [mobileOpen, setMobileOpen] = useState(false)

  // Batch⑤ 拆桥：/console 与 /dp/console 路由已删，守卫只留现存前缀
  if (pathname?.startsWith("/admin") || pathname?.startsWith("/dp/provider") || pathname === "/") return null

  const parseRoles = (roles: unknown): string[] => {
    if (Array.isArray(roles)) return roles
    if (typeof roles === "string") {
      try { return JSON.parse(roles) as string[] } catch { return [] }
    }
    return []
  }

  const userRoles = parseRoles(session?.roles)
  const isAdmin = userRoles.includes("ADMIN") || session?.role === "ADMIN"
  const isProvider = userRoles.includes("PROVIDER") || session?.role === "PROVIDER"

  const linkClass = (href: string) => {
    const isActive = pathname === href || (href !== "/" && pathname.startsWith(href))
    // Batch⑤ Header Duo 化（Batch②-2 admin 轨同例）：深黑壳→白底，cyan 霓虹→Duo 蓝 soft
    return `rounded-lg px-3 py-1.5 text-sm font-medium transition-colors ${
      isActive
        ? "bg-[var(--color-duo-blue)]/10 text-[var(--color-duo-blue-ink)] border border-[var(--color-duo-blue)]/40"
        : "text-[var(--color-duo-wolf)] hover:text-[var(--color-duo-eel)] hover:bg-[var(--color-duo-polar)]"
    }`
  }

  return (
    <header className="sticky top-0 z-40 w-full border-b-2 border-[var(--color-duo-swan)] bg-white/90 backdrop-blur-xl">
      <div className="mx-auto flex h-14 max-w-7xl items-center justify-between px-6 sm:px-8 lg:px-10">
        <Link href="/" className="flex items-center gap-2.5 group">
          <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-[var(--color-duo-blue)] text-xs font-bold tracking-tight text-white shadow-sm transition-shadow group-hover:shadow-md">
            <Scroll className="w-4 h-4" />
          </span>
          <span className="text-sm font-semibold text-[var(--color-duo-eel)]">
            deal-protocol <span className="text-[var(--color-duo-blue-ink)] text-xs">| 同城服务网络</span>
          </span>
        </Link>

        <nav className="hidden items-center gap-1 md:flex">
          <Link href="/" className={linkClass("/")}>OTO空间</Link>
          <Link href="/dp" className={linkClass("/dp")}>协议后台</Link>
          {isAdmin && <Link href="/admin" className="rounded-lg px-3 py-1.5 text-sm font-medium transition-colors bg-[var(--color-duo-yellow)]/10 text-[var(--color-duo-yellow-ink)] border border-[var(--color-duo-yellow-dark)]/50">管理后台</Link>}
        </nav>

        <div className="hidden items-center gap-2 md:flex">
          {loading ? (
            <div className="h-8 w-20 animate-pulse rounded-lg bg-[var(--color-duo-swan)]" />
          ) : session ? (
            <>
              <NotificationBell />
              <DropdownMenu>
                <DropdownMenuTrigger className="flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-sm font-medium text-[var(--color-duo-wolf)] hover:bg-[var(--color-duo-polar)] hover:text-[var(--color-duo-eel)] outline-none transition-colors">
                  <User className="size-4" />
                  <span className="max-w-[100px] truncate">{session.name || session.email}</span>
                  <ChevronDown className="size-3 opacity-50" />
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-44 border-[var(--color-duo-swan)] bg-white text-[var(--color-duo-eel)]">
                  <div className="px-2.5 py-2 text-xs text-[var(--color-duo-wolf)] border-b border-[var(--color-duo-swan)] mb-1">
                    {session.email}
                  </div>
                  <DropdownMenuItem onClick={() => router.push("/")} className="hover:bg-[var(--color-duo-polar)] focus:bg-[var(--color-duo-polar)]">
                    <FileText className="mr-2 size-4" /> 发布需求
                  </DropdownMenuItem>
                  {isProvider && (
                    <DropdownMenuItem onClick={() => router.push("/dp/provider/incoming")} className="hover:bg-[var(--color-duo-polar)] focus:bg-[var(--color-duo-polar)]">
                      <ShieldCheck className="mr-2 size-4" /> 待接工单
                    </DropdownMenuItem>
                  )}
                  <DropdownMenuSeparator className="bg-[var(--color-duo-swan)]" />
                  <DropdownMenuItem onClick={() => router.push("/profile")} className="hover:bg-[var(--color-duo-polar)] focus:bg-[var(--color-duo-polar)]">
                    <User className="mr-2 size-4" /> 个人中心
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={async () => { await getBrowserSupabase().auth.signOut(); window.location.href = "/" }} className="text-red-600 hover:bg-[var(--color-duo-polar)] focus:bg-[var(--color-duo-polar)]">
                    <LogOut className="mr-2 size-4" /> 退出登录
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </>
          ) : (
            <>
              <Button variant="ghost" size="sm" className="text-[var(--color-duo-wolf)] hover:text-[var(--color-duo-eel)] hover:bg-[var(--color-duo-polar)]" onClick={() => router.push("/login")}>登录</Button>
              <Button size="sm" className="bg-[var(--color-duo-green)] border-b-2 border-[var(--color-duo-green-dark)] text-neutral-900 hover:brightness-105" onClick={() => router.push("/register")}>注册</Button>
            </>
          )}
        </div>

        <button
          type="button"
          className="flex h-11 w-11 items-center justify-center rounded-lg md:hidden hover:bg-[var(--color-duo-polar)] transition-colors text-[var(--color-duo-wolf)]"
          onClick={() => setMobileOpen(!mobileOpen)}
          aria-label={mobileOpen ? "关闭菜单" : "打开菜单"}
        >
          {mobileOpen ? <X className="size-5" /> : <Menu className="size-5" />}
        </button>
      </div>

      {mobileOpen && (
        <div className="border-t-2 border-[var(--color-duo-swan)] md:hidden animate-in touch-manipulation">
          <nav className="flex flex-col gap-px px-6 py-3">
            <Link href="/" onClick={() => setMobileOpen(false)} className="touch-target flex items-center rounded-lg px-3 text-sm font-medium text-[var(--color-duo-eel)] hover:bg-[var(--color-duo-polar)] active:bg-[var(--color-duo-swan)]">OTO空间</Link>
            <Link href="/dp" onClick={() => setMobileOpen(false)} className="touch-target flex items-center rounded-lg px-3 text-sm text-[var(--color-duo-wolf)] hover:bg-[var(--color-duo-polar)] hover:text-[var(--color-duo-eel)] active:bg-[var(--color-duo-swan)]">协议后台</Link>
            {isAdmin && <Link href="/admin" onClick={() => setMobileOpen(false)} className="touch-target flex items-center rounded-lg px-3 text-sm text-[var(--color-duo-yellow-ink)] hover:bg-[var(--color-duo-yellow)]/10 active:bg-[var(--color-duo-yellow)]/20">管理后台</Link>}
            <hr className="my-2 border-[var(--color-duo-swan)]" />
            {loading ? (
              <div className="h-11 animate-pulse rounded-lg bg-[var(--color-duo-swan)]" />
            ) : session ? (
              <>
                <div className="touch-target flex items-center gap-2 px-3 text-sm font-medium text-[var(--color-duo-eel)]">
                  <User className="size-4" />
                  <span className="truncate">{session.name || session.email}</span>
                </div>
                <Link href="/profile" onClick={() => setMobileOpen(false)} className="touch-target flex items-center rounded-lg px-3 text-sm text-[var(--color-duo-wolf)] hover:bg-[var(--color-duo-polar)] active:bg-[var(--color-duo-swan)]">玩家中心</Link>
                <button type="button" onClick={async () => { setMobileOpen(false); await getBrowserSupabase().auth.signOut(); window.location.href = "/" }} className="touch-target flex items-center rounded-lg px-3 text-left text-sm font-medium text-red-600 transition-colors hover:bg-[var(--color-duo-polar)] active:bg-[var(--color-duo-swan)]">退出登录</button>
              </>
            ) : (
              <div className="flex gap-2 pt-1">
                <Button variant="ghost" size="sm" className="flex-1 touch-target text-[var(--color-duo-wolf)]" onClick={() => { setMobileOpen(false); router.push("/login") }}>登录</Button>
                <Button size="sm" className="flex-1 touch-target bg-[var(--color-duo-green)] border-b-2 border-[var(--color-duo-green-dark)] text-neutral-900" onClick={() => { setMobileOpen(false); router.push("/register") }}>注册</Button>
              </div>
            )}
          </nav>
        </div>
      )}
    </header>
  )
}
