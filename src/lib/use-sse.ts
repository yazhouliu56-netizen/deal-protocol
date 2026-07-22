"use client"

import { useEffect, useRef } from "react"

export function useSSE(type: string, id: string | null, onEvent: () => void) {
  const onEventRef = useRef(onEvent)
  onEventRef.current = onEvent

  useEffect(() => {
    if (!id) return

    const es = new EventSource(`/api/sse?type=${type}&id=${id}`, { withCredentials: true })
    es.onmessage = () => onEventRef.current()
    es.onerror = () => {
      es.close()
      const fallback = setInterval(() => onEventRef.current(), 5000)
      const cleanup = () => clearInterval(fallback)
      return cleanup
    }

    return () => es.close()
  }, [type, id])
}
