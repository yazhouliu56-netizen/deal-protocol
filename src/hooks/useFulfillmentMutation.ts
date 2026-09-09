import { useState, useEffect, useCallback, useRef } from "react"
import { toast, updateToast, useToastStore } from "@/base/platform/toast";

type SyncState = "idle" | "syncing" | "pending"

export function useFulfillmentMutation(
  key: string,
  mutationFn: (data: unknown) => Promise<unknown>,
) {
  const [syncState, setSyncState] = useState<SyncState>("idle")
  const mutationFnRef = useRef(mutationFn)
  useEffect(() => { mutationFnRef.current = mutationFn }, [mutationFn])

  const execute = useCallback(async (data: unknown) => {
    if (!navigator.onLine) {
      try {
        const existing = localStorage.getItem(`pending_${key}`)
        const queue = existing ? JSON.parse(existing) : []
        queue.push({ data, createdAt: Date.now() })
        localStorage.setItem(`pending_${key}`, JSON.stringify(queue))
      } catch {
        localStorage.setItem(`pending_${key}`, JSON.stringify([{ data, createdAt: Date.now() }]))
      }
      toast("网络已断开，操作已暂存，联网后自动同步", "error")
      return
    }

    setSyncState("syncing")
    try {
      const result = await mutationFnRef.current(data)
      return result
    } catch (e) {
      toast("操作失败，请检查网络", "error")
      throw e
    } finally {
      setSyncState("idle")
    }
  }, [key])

  useEffect(() => {
    const handleOnline = async () => {
      const raw = localStorage.getItem(`pending_${key}`)
      if (!raw) return

      let queue: { data: unknown; createdAt: number }[] = []
      try {
        queue = JSON.parse(raw)
      } catch {
        localStorage.removeItem(`pending_${key}`)
        return
      }

      if (queue.length === 0) return

      setSyncState("syncing")
      const toastId = toast(`检测到网络恢复，正在同步 ${queue.length} 条暂存操作...`, "info")

      for (let i = 0; i < queue.length; i++) {
        try {
          await mutationFnRef.current(queue[i].data)
          updateToast(toastId, `已同步 ${i + 1}/${queue.length}`, "success")
        } catch {
          updateToast(toastId, `第 ${i + 1} 条同步失败，将保留在队列中`, "error")
          return
        }
      }

      localStorage.removeItem(`pending_${key}`)
      useToastStore.getState().dismiss(toastId)
      toast("所有离线操作已同步！", "success")
      setSyncState("idle")
    }

    window.addEventListener("online", handleOnline)
    return () => window.removeEventListener("online", handleOnline)
  }, [key])

  return { execute, syncState }
}
