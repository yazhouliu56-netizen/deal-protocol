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
import { Menu, X, User, ChevronDown, LayoutDashboard, FileText, ShieldCheck, LogOut, Scroll } from "lucide-react"
import NotificationBell from "@/components/NotificationBell"
import { ThemeSwitcher } from "@/components/theme/theme-switcher"

export default function Header() {
  const { user: session, loading } = useSession()
  const router = useRouter()
  const pathname = usePathname()
  const [mobileOpen, setMobileOpen] = useState(false)

  if (pathname?.startsWith("/admin") || pathname?.startsWith("/console") || pathname?.startsWith("/dp/console") || pathname?.startsWith("/dp/provider") || pathname === "/") return null

  const isLoggedIn = !!session

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
    return `rounded-lg px-3 py-1.5 text-sm font-medium transition-colors ${
      isActive
        ? "bg-cyan-950/40 text-cyan-400 border border-cyan-500/30"
        : "text-slate-400 hover:text-slate-100 hover:bg-slate-800"
    }`
  }

  return (
    <header className="sticky top-0 z-40 w-full border-b border-slate-800/80 bg-slate-950/80 backdrop-blur-xl supports-[backdrop-filter]:bg-slate-950/60">
      <div className="mx-auto flex h-14 max-w-7xl items-center justify-between px-6 sm:px-8 lg:px-10">
        <Link href="/" className="flex items-center gap-2.5 group">
          <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-gradient-to-tr from-cyan-500 to-purple-600 text-xs font-bold tracking-tight text-white shadow-sm transition-shadow group-hover:shadow-md">
            <Scroll className="w-4 h-4" />
          </span>
          <span className="text-sm font-semibold text-slate-100">
            deal-protocol <span className="text-cyan-400 text-xs">| 异世界冒险者公会</span>
          </span>
        </Link>

        <nav className="hidden items-center gap-1 md:flex">
          <Link href="/" className={linkClass("/")}>OTO空间</Link>
          <Link href="/dp" className={linkClass("/dp")}>协议后台</Link>
          <Link href="/demands" className={linkClass("/demands")}>悬赏大厅</Link>
          <Link href="/orders" className={linkClass("/orders")}>我的契约</Link>
          {isLoggedIn && <Link href="/dashboard" className={linkClass("/dashboard")}>控制面板</Link>}
          {isAdmin && <Link href="/admin" className="rounded-lg px-3 py-1.5 text-sm font-medium transition-colors bg-amber-950/40 text-amber-400 border border-amber-500/30">管理后台</Link>}
        </nav>

        <div className="hidden items-center gap-2 md:flex">
          <ThemeSwitcher />
          {loading ? (
            <div className="h-8 w-20 animate-pulse rounded-lg bg-slate-800" />
          ) : session ? (
            <>
              <NotificationBell />
              <DropdownMenu>
                <DropdownMenuTrigger className="flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-sm font-medium text-slate-400 hover:bg-slate-800 hover:text-slate-100 outline-none transition-colors">
                  <User className="size-4" />
                  <span className="max-w-[100px] truncate">{session.name || session.email}</span>
                  <ChevronDown className="size-3 opacity-50" />
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-44 border-slate-800 bg-slate-950 text-slate-200">
                  <div className="px-2.5 py-2 text-xs text-slate-400 border-b border-slate-800 mb-1">
                    {session.email}
                  </div>
                  <DropdownMenuItem onClick={() => router.push("/dashboard")} className="hover:bg-slate-800 focus:bg-slate-800">
                    <LayoutDashboard className="mr-2 size-4" /> 控制面板
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => router.push("/demands/create")} className="hover:bg-slate-800 focus:bg-slate-800">
                    <FileText className="mr-2 size-4" /> 发布悬赏
                  </DropdownMenuItem>
                  {isProvider && (
                    <DropdownMenuItem onClick={() => router.push("/dp/provider/incoming")} className="hover:bg-slate-800 focus:bg-slate-800">
                      <ShieldCheck className="mr-2 size-4" /> 待接悬赏
                    </DropdownMenuItem>
                  )}
                  <DropdownMenuSeparator className="bg-slate-800" />
                  <DropdownMenuItem onClick={() => router.push("/profile")} className="hover:bg-slate-800 focus:bg-slate-800">
                    <User className="mr-2 size-4" /> 玩家中心
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={async () => { await getBrowserSupabase().auth.signOut(); window.location.href = "/" }} className="text-red-400 hover:bg-slate-800 focus:bg-slate-800">
                    <LogOut className="mr-2 size-4" /> 退出登录
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </>
          ) : (
            <>
              <Button variant="ghost" size="sm" className="text-slate-400 hover:text-slate-100 hover:bg-slate-800" onClick={() => router.push("/login")}>登录</Button>
              <Button size="sm" className="bg-gradient-to-r from-cyan-500 to-purple-600 text-white hover:brightness-110" onClick={() => router.push("/register")}>注册</Button>
            </>
          )}
        </div>

        <button
          type="button"
          className="flex h-11 w-11 items-center justify-center rounded-lg md:hidden hover:bg-slate-800 transition-colors text-slate-400"
          onClick={() => setMobileOpen(!mobileOpen)}
          aria-label={mobileOpen ? "关闭菜单" : "打开菜单"}
        >
          {mobileOpen ? <X className="size-5" /> : <Menu className="size-5" />}
        </button>
      </div>

      {mobileOpen && (
        <div className="border-t border-slate-800/60 md:hidden animate-in touch-manipulation">
          <nav className="flex flex-col gap-px px-6 py-3">
            <Link href="/" onClick={() => setMobileOpen(false)} className="touch-target flex items-center rounded-lg px-3 text-sm font-medium text-slate-100 hover:bg-slate-800 active:bg-slate-700">OTO空间</Link>
            <Link href="/dp" onClick={() => setMobileOpen(false)} className="touch-target flex items-center rounded-lg px-3 text-sm text-slate-400 hover:bg-slate-800 hover:text-slate-100 active:bg-slate-700">协议后台</Link>
            <Link href="/demands" onClick={() => setMobileOpen(false)} className="touch-target flex items-center rounded-lg px-3 text-sm text-slate-400 hover:bg-slate-800 hover:text-slate-100 active:bg-slate-700">悬赏大厅</Link>
            <Link href="/orders" onClick={() => setMobileOpen(false)} className="touch-target flex items-center rounded-lg px-3 text-sm text-slate-400 hover:bg-slate-800 hover:text-slate-100 active:bg-slate-700">我的契约</Link>
            {isLoggedIn && <Link href="/dashboard" onClick={() => setMobileOpen(false)} className="touch-target flex items-center rounded-lg px-3 text-sm text-slate-400 hover:bg-slate-800 hover:text-slate-100 active:bg-slate-700">控制面板</Link>}
            {isAdmin && <Link href="/admin" onClick={() => setMobileOpen(false)} className="touch-target flex items-center rounded-lg px-3 text-sm text-amber-400 hover:bg-amber-950/30 active:bg-amber-950/50">管理后台</Link>}
            <hr className="my-2 border-slate-800/60" />
            <div className="px-3 py-1">
              <ThemeSwitcher />
            </div>
            {loading ? (
              <div className="h-11 animate-pulse rounded-lg bg-slate-800" />
            ) : session ? (
              <>
                <div className="touch-target flex items-center gap-2 px-3 text-sm font-medium text-slate-100">
                  <User className="size-4" />
                  <span className="truncate">{session.name || session.email}</span>
                </div>
                <Link href="/profile" onClick={() => setMobileOpen(false)} className="touch-target flex items-center rounded-lg px-3 text-sm text-slate-400 hover:bg-slate-800 active:bg-slate-700">玩家中心</Link>
                <button type="button" onClick={async () => { setMobileOpen(false); await getBrowserSupabase().auth.signOut(); window.location.href = "/" }} className="touch-target flex items-center rounded-lg px-3 text-left text-sm font-medium text-red-400 transition-colors hover:bg-slate-800 active:bg-slate-700">退出登录</button>
              </>
            ) : (
              <div className="flex gap-2 pt-1">
                <Button variant="ghost" size="sm" className="flex-1 touch-target text-slate-400" onClick={() => { setMobileOpen(false); router.push("/login") }}>登录</Button>
                <Button size="sm" className="flex-1 touch-target bg-gradient-to-r from-cyan-500 to-purple-600 text-white" onClick={() => { setMobileOpen(false); router.push("/register") }}>注册</Button>
              </div>
            )}
          </nav>
        </div>
      )}
    </header>
  )
}
