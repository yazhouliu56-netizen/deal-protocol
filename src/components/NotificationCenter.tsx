"use client"

import React, { useState } from "react"
import { useNotifications } from "./providers/NotificationProvider"
import { Bell, MailOpen, Calendar, AlertCircle, Sparkles } from "lucide-react"

export default function NotificationCenter() {
  const { notifications, unreadCount, markAsRead, markAllAsRead } = useNotifications()
  const [isOpen, setIsOpen] = useState<boolean>(false)

  return (
    <div className="relative inline-block text-left font-sans z-40">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="relative p-2 text-zinc-400 hover:text-zinc-100 border border-zinc-800 bg-zinc-900/40 rounded-xl transition"
      >
        <Bell className="w-4 h-4" />
        {unreadCount > 0 && (
          <span className="absolute -top-1.5 -right-1.5 min-w-4 h-4 rounded-full bg-amber-500 text-[10px] font-black text-zinc-950 px-1 flex items-center justify-center animate-pulse">
            {unreadCount > 9 ? "9+" : unreadCount}
          </span>
        )}
      </button>

      {isOpen && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setIsOpen(false)} />
          <div className="absolute right-0 mt-2.5 w-80 max-h-[460px] overflow-y-auto rounded-2xl border border-zinc-800 bg-zinc-900 shadow-2xl z-50 p-4 text-left flex flex-col">
            <div className="flex items-center justify-between border-b border-zinc-800 pb-2.5 mb-2">
              <span className="text-xs font-bold text-zinc-200 flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5 text-amber-400" /> 系统通知总线
              </span>
              {unreadCount > 0 && (
                <button
                  onClick={markAllAsRead}
                  className="text-[10px] text-zinc-500 hover:text-zinc-300 transition flex items-center gap-1"
                >
                  <MailOpen className="w-3 h-3" /> 全部清除
                </button>
              )}
            </div>

            <div className="space-y-2 flex-1 overflow-y-auto max-h-80 pr-1">
              {notifications.length === 0 ? (
                <div className="py-8 text-center text-zinc-500 text-xs flex flex-col items-center justify-center gap-2">
                  <AlertCircle className="w-5 h-5 text-zinc-700" />
                  流体网络静默，暂无任何投递历史
                </div>
              ) : (
                notifications.map((item) => (
                  <div
                    key={item.id}
                    onClick={() => !item.is_read && markAsRead(item.id)}
                    className={`p-3 rounded-xl border transition cursor-pointer text-left ${
                      item.is_read
                        ? "bg-zinc-950/40 border-zinc-900 text-zinc-500"
                        : "bg-zinc-950 border-zinc-800 text-zinc-200 hover:border-zinc-700"
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2 mb-1">
                      <span
                        className={`text-[11px] font-bold tracking-wide ${
                          item.is_read ? "text-zinc-600" : "text-zinc-300"
                        }`}
                      >
                        {item.title}
                      </span>
                      {!item.is_read && (
                        <span className="w-1.5 h-1.5 rounded-full bg-amber-500 shrink-0 mt-1" />
                      )}
                    </div>
                    <p className="text-[11px] text-zinc-400 leading-relaxed line-clamp-2">
                      {item.content}
                    </p>
                    <div className="mt-2 text-[9px] text-zinc-600 font-mono flex items-center gap-1">
                      <Calendar className="w-2.5 h-2.5" /> {new Date(item.created_at).toLocaleString()}
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </>
      )}
    </div>
  )
}
