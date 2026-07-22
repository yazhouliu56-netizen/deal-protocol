"use client"

import React, { createContext, useContext, useState, useEffect, useCallback } from "react"
import { getBrowserSupabase } from "@/lib/supabase-browser"
import { useSession } from "@/components/SessionProvider"
import { toast } from "react-hot-toast"
import { BellRing, ShieldAlert, BadgeCent, MessageSquare } from "lucide-react"

interface NotificationItem {
  id: string
  user_id: string
  title: string
  content: string
  type: "system" | "order" | "finance" | "arbitration"
  is_read: boolean
  created_at: string
}

interface NotificationContextValue {
  notifications: NotificationItem[]
  unreadCount: number
  fetchNotifications: () => Promise<void>
  markAsRead: (id: string) => Promise<void>
  markAllAsRead: () => Promise<void>
}

const NotificationContext = createContext<NotificationContextValue | undefined>(undefined)

export function NotificationProvider({ children }: { children: React.ReactNode }) {
  const { user } = useSession()
  const [notifications, setNotifications] = useState<NotificationItem[]>([])

  const unreadCount = notifications.filter((n) => !n.is_read).length

  const fetchNotifications = useCallback(async () => {
    try {
      const response = await fetch("/api/notifications/list")
      if (response.ok) {
        const data = await response.json()
        setNotifications(data)
      }
    } catch (e) {
      console.error("Failed to fetch notifications", e)
    }
  }, [])

  const markAsRead = async (id: string) => {
    try {
      const response = await fetch("/api/notifications/mark-read", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ notificationId: id }),
      })
      if (response.ok) {
        setNotifications((prev) =>
          prev.map((n) => (n.id === id ? { ...n, is_read: true } : n)),
        )
      }
    } catch (e) {
      console.error(e)
    }
  }

  const markAllAsRead = async () => {
    try {
      const response = await fetch("/api/notifications/mark-read", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ all: true }),
      })
      if (response.ok) {
        setNotifications((prev) => prev.map((n) => ({ ...n, is_read: true })))
        toast.success("所有未读通知已全部清理清除完毕")
      }
    } catch (e) {
      console.error(e)
    }
  }

  useEffect(() => {
    if (!user?.id) return
    fetchNotifications()
  }, [user?.id, fetchNotifications])

  useEffect(() => {
    if (!user?.id) return

    const supabase = getBrowserSupabase()

    const channel = supabase
      .channel(`realtime:user_notifications:${user.id}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "notifications",
          filter: `user_id=eq.${user.id}`,
        },
        (payload) => {
          const newNotif = payload.new as NotificationItem
          setNotifications((prev) => [newNotif, ...prev])

          let iconElement = <BellRing className="w-5 h-5 text-amber-400" />
          if (newNotif.type === "finance")
            iconElement = <BadgeCent className="w-5 h-5 text-emerald-400" />
          if (newNotif.type === "arbitration")
            iconElement = <ShieldAlert className="w-5 h-5 text-red-400" />
          if (newNotif.type === "order")
            iconElement = <MessageSquare className="w-5 h-5 text-sky-400" />

          toast.custom(
            (t) => (
              <div
                className={`${
                  t.visible ? "animate-enter" : "animate-leave"
                } max-w-md w-full bg-zinc-900 border border-zinc-800 shadow-2xl rounded-2xl pointer-events-auto flex ring-1 ring-black ring-opacity-5 p-4 text-left`}
              >
                <div className="flex-1 w-0">
                  <div className="flex items-start">
                    <div className="flex-shrink-0 pt-0.5">{iconElement}</div>
                    <div className="ml-3 flex-1">
                      <p className="text-xs font-bold text-zinc-100">{newNotif.title}</p>
                      <p className="mt-1 text-xs text-zinc-400 leading-normal">{newNotif.content}</p>
                    </div>
                  </div>
                </div>
                <div className="flex border-l border-zinc-800 ml-4 pl-2 items-center">
                  <button
                    onClick={() => {
                      toast.dismiss(t.id)
                      markAsRead(newNotif.id)
                    }}
                    className="w-full border border-transparent rounded-none rounded-r-lg p-2 flex items-center justify-center text-xs font-medium text-zinc-400 hover:text-zinc-200 focus:outline-none"
                  >
                    知晓
                  </button>
                </div>
              </div>
            ),
            { duration: 5000 },
          )
        },
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [user?.id])

  return (
    <NotificationContext.Provider value={{ notifications, unreadCount, fetchNotifications, markAsRead, markAllAsRead }}>
      {children}
    </NotificationContext.Provider>
  )
}

export function useNotifications() {
  const context = useContext(NotificationContext)
  if (!context) throw new Error("useNotifications must be explicitly enclosed within NotificationProvider")
  return context
}
