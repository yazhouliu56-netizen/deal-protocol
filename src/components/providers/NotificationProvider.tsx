"use client"

import React, { createContext, useContext, useState, useEffect, useCallback } from "react"
import { getBrowserSupabase } from "@/lib/supabase-browser"
import { useSession } from "@/components/SessionProvider"
import { toast } from "@/base/platform/toast";

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
        toast("所有未读通知已全部清理清除完毕", "success")
      }
    } catch (e) {
      console.error(e)
    }
  }

  useEffect(() => {
    if (!user?.id) return
    const init = async () => {
      await fetchNotifications()
    }
    init()
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

          const tone = newNotif.type === "finance" ? "success" : newNotif.type === "arbitration" ? "error" : "info";
          toast(`${newNotif.title}：${newNotif.content}`, tone, {
            label: "知晓",
            onClick: () => void markAsRead(newNotif.id),
          });
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
