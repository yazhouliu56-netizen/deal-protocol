"use client"

import { useEffect, useRef } from "react"

export function useSSE(type: string, id: string | null, onEvent: () => void) {
  const onEventRef = useRef(onEvent)

  useEffect(() => {
    onEventRef.current = onEvent
  }, [onEvent])

  useEffect(() => {
    if (!id) return

    let fallback: ReturnType<typeof setInterval> | null = null
    const es = new EventSource(`/api/sse?type=${type}&id=${id}`, { withCredentials: true })
    es.onmessage = () => onEventRef.current()
    es.onerror = () => {
      es.close()
      if (fallback) return
      fallback = setInterval(() => onEventRef.current(), 5000)
    }

    return () => {
      if (fallback) clearInterval(fallback)
      es.close()
    }
  }, [type, id])
}
