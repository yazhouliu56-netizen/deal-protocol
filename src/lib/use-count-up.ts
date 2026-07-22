import { useEffect, useState } from "react"

export function useCountUp(target: number, duration = 1200, enabled = true) {
  const [value, setValue] = useState(0)

  useEffect(() => {
    if (!enabled) { setValue(target); return }

    const start = performance.now()
    let raf: number

    const tick = (now: number) => {
      const elapsed = now - start
      const progress = Math.min(elapsed / duration, 1)
      const easeOut = 1 - Math.pow(1 - progress, 3)
      setValue(Math.round(target * easeOut))
      if (progress < 1) raf = requestAnimationFrame(tick)
    }

    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [target, duration, enabled])

  return value
}
