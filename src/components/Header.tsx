"use client"

import { useState } from "react"
import Link from "next/link"
import { useSession } from "@/components/SessionProvider"
import { getSupabase } from "@/lib/supabase-client"
import { useRouter, usePathname } from "next/navigation"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Menu, X, User, ChevronDown, LayoutDashboard, FileText, ShieldCheck, LogOut, Sparkles } from "lucide-react"
import NotificationBell from "@/components/NotificationBell"

export default function Header() {
  const { user: session, loading } = useSession()
  const router = useRouter()
  const pathname = usePathname()
  const [mobileOpen, setMobileOpen] = useState(false)

  const isLoggedIn = !!session
  const isAdmin = session?.roles ? (JSON.parse(session.roles) as string[]).includes("ADMIN") : session?.role === "ADMIN"
  const isProvider = session?.roles ? (JSON.parse(session.roles) as string[]).includes("PROVIDER") : session?.role === "PROVIDER"

  const linkClass = (href: string) => {
    const isActive = pathname === href || (href !== "/" && pathname.startsWith(href))
    return `rounded-lg px-3 py-1.5 text-sm font-medium transition-colors ${
      isActive
        ? "bg-indigo-50 text-indigo-700 dark:bg-indigo-950/30 dark:text-indigo-400"
        : "text-slate-500 hover:text-slate-900 hover:bg-slate-100 dark:text-zinc-400 dark:hover:text-zinc-100 dark:hover:bg-zinc-800"
    }`
  }

  return (
    <header className="sticky top-0 z-40 w-full border-b border-slate-200/60 bg-white/80 backdrop-blur-xl supports-[backdrop-filter]:bg-white/60 dark:border-zinc-800/60 dark:bg-zinc-950/80 dark:supports-[backdrop-filter]:bg-zinc-950/60">
      <div className="mx-auto flex h-14 max-w-7xl items-center justify-between px-6 sm:px-8 lg:px-10">
        <Link href="/" className="flex items-center gap-2.5 group">
          <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-indigo-600 text-[10px] font-bold tracking-tight text-white shadow-sm transition-shadow group-hover:shadow-md">
            dp
          </span>
          <span className="text-sm font-semibold text-slate-900 dark:text-zinc-100">
            deal<span className="text-indigo-600">-protocol</span>
          </span>
        </Link>

        <nav className="hidden items-center gap-1 md:flex">
          <Link href="/" className={linkClass("/")}>首页</Link>
          {isLoggedIn && <Link href="/demands/new" className={linkClass("/demands/new")}>发布需求</Link>}
          {isLoggedIn && <Link href="/dashboard" className={linkClass("/dashboard")}>我的订单</Link>}
          {isProvider && <Link href="/provider/incoming" className={linkClass("/provider/incoming")}>待接需求</Link>}
          {isAdmin && <Link href="/admin" className={linkClass("/admin") + " bg-amber-50 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400"}>管理后台</Link>}
        </nav>

        <div className="hidden items-center gap-2 md:flex">
          {loading ? (
            <div className="h-8 w-20 animate-pulse rounded-lg bg-slate-200 dark:bg-zinc-800" />
          ) : session ? (
            <>
              <NotificationBell />
              <DropdownMenu>
                <DropdownMenuTrigger className="flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-sm font-medium text-slate-500 hover:bg-slate-100 hover:text-slate-900 outline-none transition-colors dark:text-zinc-400 dark:hover:bg-zinc-800 dark:hover:text-zinc-100">
                  <User className="size-4" />
                  <span className="max-w-[100px] truncate">{session.name || session.email}</span>
                  <ChevronDown className="size-3 opacity-50" />
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-44">
                  <div className="px-2.5 py-2 text-xs text-slate-500 border-b border-slate-200 mb-1 dark:text-zinc-400 dark:border-zinc-800">
                    {session.email}
                  </div>
                  <DropdownMenuItem onClick={() => router.push("/dashboard")}>
                    <LayoutDashboard className="mr-2 size-4" /> 控制面板
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => router.push("/demands/new")}>
                    <FileText className="mr-2 size-4" /> 发布需求
                  </DropdownMenuItem>
                  {isProvider && (
                    <DropdownMenuItem onClick={() => router.push("/provider/incoming")}>
                      <ShieldCheck className="mr-2 size-4" /> 待接需求
                    </DropdownMenuItem>
                  )}
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={() => router.push("/profile")}>
                    <User className="mr-2 size-4" /> 个人资料
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => getSupabase().auth.signOut()} className="text-destructive focus:text-destructive">
                    <LogOut className="mr-2 size-4" /> 退出登录
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </>
          ) : (
            <>
              <Button variant="ghost" size="sm" onClick={() => router.push("/login")}>登录</Button>
              <Button size="sm" onClick={() => router.push("/register")}>注册</Button>
            </>
          )}
        </div>

        <button
          type="button"
          className="flex h-11 w-11 items-center justify-center rounded-lg md:hidden hover:bg-slate-100 transition-colors dark:hover:bg-zinc-800"
          onClick={() => setMobileOpen(!mobileOpen)}
          aria-label={mobileOpen ? "关闭菜单" : "打开菜单"}
        >
          {mobileOpen ? <X className="size-5" /> : <Menu className="size-5" />}
        </button>
      </div>

      {mobileOpen && (
        <div className="border-t border-slate-200/60 md:hidden animate-in dark:border-zinc-800/60 touch-manipulation">
          <nav className="flex flex-col gap-px px-6 py-3">
            <Link href="/" onClick={() => setMobileOpen(false)} className="touch-target flex items-center rounded-lg px-3 text-sm font-medium text-slate-900 hover:bg-slate-100 active:bg-slate-200 dark:text-zinc-100 dark:hover:bg-zinc-800 dark:active:bg-zinc-700">首页</Link>
            {isLoggedIn && <Link href="/demands/new" onClick={() => setMobileOpen(false)} className="touch-target flex items-center rounded-lg px-3 text-sm text-slate-500 hover:bg-slate-100 hover:text-slate-900 active:bg-slate-200 dark:text-zinc-400 dark:hover:bg-zinc-800 dark:hover:text-zinc-100 dark:active:bg-zinc-700">发布需求</Link>}
            {isLoggedIn && <Link href="/dashboard" onClick={() => setMobileOpen(false)} className="touch-target flex items-center rounded-lg px-3 text-sm text-slate-500 hover:bg-slate-100 hover:text-slate-900 active:bg-slate-200 dark:text-zinc-400 dark:hover:bg-zinc-800 dark:hover:text-zinc-100 dark:active:bg-zinc-700">我的订单</Link>}
            {isProvider && <Link href="/provider/incoming" onClick={() => setMobileOpen(false)} className="touch-target flex items-center rounded-lg px-3 text-sm text-slate-500 hover:bg-slate-100 hover:text-slate-900 active:bg-slate-200 dark:text-zinc-400 dark:hover:bg-zinc-800 dark:hover:text-zinc-100 dark:active:bg-zinc-700">待接需求</Link>}
            {isAdmin && <Link href="/admin" onClick={() => setMobileOpen(false)} className="touch-target flex items-center rounded-lg px-3 text-sm text-amber-700 hover:bg-amber-50 active:bg-amber-100 dark:text-amber-400 dark:hover:bg-amber-900/30 dark:active:bg-amber-900/50">管理后台</Link>}
            <hr className="my-2 border-slate-200/60 dark:border-zinc-800/60" />
            {loading ? (
              <div className="h-11 animate-pulse rounded-lg bg-slate-200 dark:bg-zinc-800" />
            ) : session ? (
              <>
                <div className="touch-target flex items-center gap-2 px-3 text-sm font-medium text-slate-900 dark:text-zinc-100">
                  <User className="size-4" />
                  <span className="truncate">{session.name || session.email}</span>
                </div>
                <Link href="/profile" onClick={() => setMobileOpen(false)} className="touch-target flex items-center rounded-lg px-3 text-sm text-slate-500 hover:bg-slate-100 active:bg-slate-200 dark:text-zinc-400 dark:hover:bg-zinc-800 dark:active:bg-zinc-700">个人资料</Link>
                <button type="button" onClick={() => { setMobileOpen(false); getSupabase().auth.signOut() }} className="touch-target flex items-center rounded-lg px-3 text-left text-sm font-medium text-destructive transition-colors hover:bg-destructive/10 active:bg-destructive/20">退出登录</button>
              </>
            ) : (
              <div className="flex gap-2 pt-1">
                <Button variant="ghost" size="sm" className="flex-1 touch-target" onClick={() => { setMobileOpen(false); router.push("/login") }}>登录</Button>
                <Button size="sm" className="flex-1 touch-target" onClick={() => { setMobileOpen(false); router.push("/register") }}>注册</Button>
              </div>
            )}
          </nav>
        </div>
      )}
    </header>
  )
}
