import { useCallback, useRef } from "react"

export function useContractSound() {
  const ctxRef = useRef<AudioContext | null>(null)

  const getCtx = useCallback(() => {
    if (!ctxRef.current) ctxRef.current = new AudioContext()
    return ctxRef.current
  }, [])

  const playCoinDrop = useCallback(() => {
    try {
      const ctx = getCtx()
      const now = ctx.currentTime

      // High-frequency ding (like a coin landing on glass)
      const osc1 = ctx.createOscillator()
      const gain1 = ctx.createGain()
      osc1.type = "sine"
      osc1.frequency.setValueAtTime(1800, now)
      osc1.frequency.exponentialRampToValueAtTime(1200, now + 0.08)
      gain1.gain.setValueAtTime(0.3, now)
      gain1.gain.exponentialRampToValueAtTime(0.001, now + 0.15)
      osc1.connect(gain1)
      gain1.connect(ctx.destination)
      osc1.start(now)
      osc1.stop(now + 0.15)

      // Lower body thump (satisfying weight)
      const osc2 = ctx.createOscillator()
      const gain2 = ctx.createGain()
      osc2.type = "triangle"
      osc2.frequency.setValueAtTime(400, now + 0.05)
      osc2.frequency.exponentialRampToValueAtTime(200, now + 0.15)
      gain2.gain.setValueAtTime(0.25, now + 0.05)
      gain2.gain.exponentialRampToValueAtTime(0.001, now + 0.25)
      osc2.connect(gain2)
      gain2.connect(ctx.destination)
      osc2.start(now + 0.05)
      osc2.stop(now + 0.25)
    } catch {
      // Audio not available — silently skip
    }
  }, [getCtx])

  const playContractSeal = useCallback(() => {
    try {
      const ctx = getCtx()
      const now = ctx.currentTime

      // Mechanical "chunk" — low frequency burst with fast decay
      const osc = ctx.createOscillator()
      const gain = ctx.createGain()
      osc.type = "square"
      osc.frequency.setValueAtTime(80, now)
      osc.frequency.exponentialRampToValueAtTime(40, now + 0.12)
      gain.gain.setValueAtTime(0.4, now)
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.2)
      osc.connect(gain)
      gain.connect(ctx.destination)
      osc.start(now)
      osc.stop(now + 0.2)

      // Followed by a bright "ting"
      const osc2 = ctx.createOscillator()
      const gain2 = ctx.createGain()
      osc2.type = "sine"
      osc2.frequency.setValueAtTime(2200, now + 0.1)
      osc2.frequency.exponentialRampToValueAtTime(1600, now + 0.18)
      gain2.gain.setValueAtTime(0.2, now + 0.1)
      gain2.gain.exponentialRampToValueAtTime(0.001, now + 0.3)
      osc2.connect(gain2)
      gain2.connect(ctx.destination)
      osc2.start(now + 0.1)
      osc2.stop(now + 0.3)
    } catch {
      // silently skip
    }
  }, [getCtx])

  return { playCoinDrop, playContractSeal }
}
