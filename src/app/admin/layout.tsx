"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { useState } from "react"
import {
  LayoutDashboard, FileText, ShieldAlert, Scale, Settings, Gavel, Menu, X,
} from "lucide-react"

const NAV_ITEMS = [
  { href: "/admin/dashboard", label: "仪表盘", icon: LayoutDashboard },
  { href: "/admin/complaints", label: "投诉管理", icon: ShieldAlert },
  { href: "/admin/disputes", label: "纠纷处理", icon: Scale },
  { href: "/admin/protocols", label: "协议配置", icon: FileText },
  { href: "/admin/config", label: "系统配置", icon: Settings },
  { href: "/admin/review", label: "审核评价", icon: Gavel },
]

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const [sidebarOpen, setSidebarOpen] = useState(false)

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-zinc-950">
      {/* Mobile header */}
      <div className="sticky top-0 z-40 flex items-center gap-3 border-b border-slate-200/60 bg-white px-4 py-3 dark:border-zinc-800/60 dark:bg-zinc-900 lg:hidden">
        <button
          onClick={() => setSidebarOpen(!sidebarOpen)}
          className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-zinc-800"
        >
          {sidebarOpen ? <X className="size-5" /> : <Menu className="size-5" />}
        </button>
        <span className="text-sm font-bold text-slate-900 dark:text-zinc-100">管理后台</span>
      </div>

      {/* Overlay for mobile */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-30 bg-black/30 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside
        className={`fixed inset-y-0 left-0 z-40 flex w-60 flex-col border-r border-slate-200/60 bg-white transition-transform duration-200 dark:border-zinc-800/60 dark:bg-zinc-900 lg:static lg:translate-x-0 ${
          sidebarOpen ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <div className="flex h-14 items-center gap-2 border-b border-slate-200/60 px-5 dark:border-zinc-800/60">
          <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-indigo-600 text-[10px] font-bold text-white">
            dp
          </span>
          <span className="text-sm font-bold text-slate-900 dark:text-zinc-100">
            管理控制台
          </span>
        </div>

        <nav className="flex-1 space-y-1 overflow-y-auto p-3">
          {NAV_ITEMS.map((item) => {
            const active = pathname === item.href || pathname.startsWith(item.href + "/")
            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => setSidebarOpen(false)}
                className={`flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors ${
                  active
                    ? "bg-indigo-50 text-indigo-700 dark:bg-indigo-950/30 dark:text-indigo-400"
                    : "text-slate-600 hover:bg-slate-100 dark:text-zinc-400 dark:hover:bg-zinc-800"
                }`}
              >
                <item.icon className="size-4 shrink-0" />
                {item.label}
              </Link>
            )
          })}
        </nav>

        <div className="border-t border-slate-200/60 p-4 dark:border-zinc-800/60">
          <Link
            href="/admin"
            className="flex items-center gap-2 text-xs text-slate-400 hover:text-slate-600 dark:text-zinc-500 dark:hover:text-zinc-300"
          >
            <LayoutDashboard className="size-3.5" />
            返回管理概览
          </Link>
        </div>
      </aside>

      {/* Main content */}
      <main className="lg:pl-60">
        <div className="p-4 sm:p-6 lg:p-8">{children}</div>
      </main>
    </div>
  )
}
