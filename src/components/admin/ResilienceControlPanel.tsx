"use client"

import React, { useCallback, useEffect, useState } from "react"
import type {
  DegradationLevel,
  SystemActionCategory,
} from "@/base/platform/resilience"

interface GateRuleView {
  category: SystemActionCategory
  allowed: boolean
  httpStatus: number | null
  errorCode: string | null
}

interface ResilienceState {
  level: DegradationLevel
  availableLevels: DegradationLevel[]
  rules: GateRuleView[]
}

const LEVEL_COLOR: Record<DegradationLevel, { ring: string; text: string; badge: string; desc: string }> = {
  NORMAL: { ring: "ring-emerald-500 border-emerald-400", text: "text-emerald-600 dark:text-emerald-400", badge: "bg-emerald-500", desc: "全量放行" },
  DROP_NON_CORE: { ring: "ring-sky-500 border-sky-400", text: "text-sky-600 dark:text-sky-400", badge: "bg-sky-500", desc: "关闭非核心分析服务" },
  RATE_LIMIT_QUEUE: { ring: "ring-amber-500 border-amber-400", text: "text-amber-600 dark:text-amber-400", badge: "bg-amber-500", desc: "新需求排队限流 429 + Retry-After 5s" },
  PRESERVE_CORE: { ring: "ring-orange-500 border-orange-400", text: "text-orange-600 dark:text-orange-400", badge: "bg-orange-500", desc: "仅放行 SOS 与在途履约" },
  READ_ONLY: { ring: "ring-red-500 border-red-400", text: "text-red-600 dark:text-red-400", badge: "bg-red-500", desc: "全站只读，阻断一切写操作" },
}

const CATEGORY_LABEL: Record<SystemActionCategory, string> = {
  CRITICAL_SOS: "一键 SOS 报警",
  CORE_FULFILLMENT: "在途履约跃迁",
  NEW_DEMAND: "新需求发布",
  NON_CORE_ANALYTICS: "非核心分析 BI",
  GENERAL_READ: "一般只读 GET",
}

const LEVEL_LABEL: Record<DegradationLevel, string> = {
  NORMAL: "NORMAL 正常",
  DROP_NON_CORE: "DROP_NON_CORE 关非核心",
  RATE_LIMIT_QUEUE: "RATE_LIMIT 排队限流",
  PRESERVE_CORE: "PRESERVE_CORE 保核心",
  READ_ONLY: "READ_ONLY 全站只读",
}

/**
 * 容灾控制台（L6-M3）：五色等级切换卡片 + 当前生效等级 + 拦截规则矩阵
 * + 一键应急熔断 / 演练恢复。
 */
export default function ResilienceControlPanel() {
  const [state, setState] = useState<ResilienceState | null>(null)
  const [loading, setLoading] = useState(true)
  const [switching, setSwitching] = useState<DegradationLevel | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [okMsg, setOkMsg] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch("/api/admin/resilience")
      if (!res.ok) {
        const body = (await res.json().catch(() => null)) as { error?: string } | null
        throw new Error(body?.error ?? `状态读取失败（HTTP ${res.status}）`)
      }
      setState((await res.json()) as ResilienceState)
    } catch (err) {
      setError(err instanceof Error ? err.message : "容灾状态读取失败")
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    const init = async () => {
      await load()
    }
    init()
  }, [load])

  const switchLevel = useCallback(
    async (level: DegradationLevel) => {
      if (switching || state?.level === level) return
      setSwitching(level)
      setError(null)
      setOkMsg(null)
      try {
        const res = await fetch("/api/admin/resilience", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ level }),
        })
        if (!res.ok) {
          const body = (await res.json().catch(() => null)) as { error?: string } | null
          throw new Error(body?.error ?? `切换失败（HTTP ${res.status}）`)
        }
        const next = (await res.json()) as ResilienceState
        setState(next)
        setOkMsg(`已切换至 ${LEVEL_LABEL[next.level]}，网关拦截即时生效`)
      } catch (err) {
        setError(err instanceof Error ? err.message : "等级切换失败")
      } finally {
        setSwitching(null)
      }
    },
    [switching, state?.level],
  )

  if (loading && !state) {
    return (
      <section className="bg-white dark:bg-zinc-900 p-6 rounded-2xl shadow-sm border border-zinc-100 dark:border-zinc-800">
        <h2 className="text-xl font-black mb-4">🛡️ 容灾控制台</h2>
        <p className="text-sm text-zinc-400 animate-pulse">加载容灾状态…</p>
      </section>
    )
  }

  const current = state?.level ?? "NORMAL"

  return (
    <section className="bg-white dark:bg-zinc-900 p-6 rounded-2xl shadow-sm border border-zinc-100 dark:border-zinc-800">
      <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
        <h2 className="text-xl font-black">🛡️ 容灾控制台</h2>
        <span className="text-xs font-mono text-zinc-400">L6-M3 · 多云多活四步降级</span>
      </div>

      <div className="flex items-center gap-3 p-4 rounded-xl bg-zinc-50 dark:bg-zinc-800 border border-zinc-100 dark:border-zinc-700 mb-5">
        <span className={`w-3 h-3 rounded-full ${LEVEL_COLOR[current].badge} animate-pulse`} />
        <span className="text-sm font-bold text-zinc-700 dark:text-zinc-200">
          当前生效等级：
          <span className={`ml-1 ${LEVEL_COLOR[current].text}`}>{LEVEL_LABEL[current]}</span>
        </span>
        <span className="ml-auto text-xs text-zinc-400">{LEVEL_COLOR[current].desc}</span>
      </div>

      {error && (
        <p className="mb-4 p-3 rounded-xl bg-red-50 dark:bg-red-950/30 text-red-600 dark:text-red-400 text-sm">
          ⚠️ {error}
        </p>
      )}
      {okMsg && (
        <p className="mb-4 p-3 rounded-xl bg-emerald-50 dark:bg-emerald-950/30 text-emerald-600 dark:text-emerald-400 text-sm">
          ✅ {okMsg}
        </p>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
        {(state?.availableLevels ?? (["NORMAL", "DROP_NON_CORE", "RATE_LIMIT_QUEUE", "PRESERVE_CORE", "READ_ONLY"] as DegradationLevel[])).map(
          (level) => {
            const color = LEVEL_COLOR[level]
            const active = current === level
            return (
              <button
                key={level}
                type="button"
                disabled={switching !== null || active}
                onClick={() => void switchLevel(level)}
                className={`rounded-xl border p-4 text-left transition-all focus:outline-none focus:ring-2 focus:ring-blue-500/50 disabled:opacity-40 disabled:cursor-not-allowed ${
                  active
                    ? `bg-white dark:bg-zinc-800 ring-2 ${color.ring}`
                    : "bg-zinc-50 dark:bg-zinc-800/60 hover:bg-zinc-100 dark:hover:bg-zinc-800 border-zinc-200 dark:border-zinc-700"
                }`}
                aria-label={`切换容灾等级 ${level}`}
                aria-pressed={active}
              >
                <div className="flex items-center gap-2 mb-1">
                  <span className={`w-2.5 h-2.5 rounded-full ${color.badge}`} />
                  <span className={`text-sm font-black ${active ? color.text : "text-zinc-600 dark:text-zinc-300"}`}>
                    {LEVEL_LABEL[level]}
                  </span>
                </div>
                <p className="text-xs text-zinc-400 leading-relaxed">{color.desc}</p>
                {switching === level && <p className="text-xs text-blue-500 mt-2 animate-pulse">切换中…</p>}
              </button>
            )
          },
        )}
      </div>

      {state && (
        <div className="mt-5">
          <p className="text-xs text-zinc-400 font-medium mb-2">当前拦截规则矩阵</p>
          <div className="grid grid-cols-1 sm:grid-cols-5 gap-2">
            {state.rules.map((r) => (
              <div
                key={r.category}
                className={`p-2.5 rounded-lg border text-xs ${
                  r.allowed
                    ? "border-emerald-200 dark:border-emerald-900 bg-emerald-50 dark:bg-emerald-950/30"
                    : "border-red-200 dark:border-red-900 bg-red-50 dark:bg-red-950/30"
                }`}
              >
                <p className="font-medium text-zinc-600 dark:text-zinc-300 mb-0.5">{CATEGORY_LABEL[r.category]}</p>
                <p className={r.allowed ? "text-emerald-600 dark:text-emerald-400 font-bold" : "text-red-600 dark:text-red-400 font-bold"}>
                  {r.allowed ? "✓ 放行" : `✗ 阻断 ${r.httpStatus ?? ""}`}
                </p>
                {r.errorCode && <p className="text-xs text-zinc-400 mt-0.5 break-all">{r.errorCode}</p>}
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="mt-5 pt-4 border-t border-zinc-100 dark:border-zinc-800 flex flex-wrap gap-3">
        <button
          type="button"
          disabled={switching !== null || current === "READ_ONLY"}
          onClick={() => void switchLevel("READ_ONLY")}
          className="px-4 py-2.5 rounded-xl bg-red-600 text-white text-sm font-bold disabled:opacity-40 disabled:cursor-not-allowed hover:bg-red-700 transition-colors"
        >
          🚨 一键应急熔断（READ_ONLY）
        </button>
        <button
          type="button"
          disabled={switching !== null || current === "NORMAL"}
          onClick={() => void switchLevel("NORMAL")}
          className="px-4 py-2.5 rounded-xl bg-emerald-600 text-white text-sm font-bold disabled:opacity-40 disabled:cursor-not-allowed hover:bg-emerald-700 transition-colors"
        >
          ✅ 演练恢复（NORMAL）
        </button>
        <button
          type="button"
          onClick={() => void load()}
          disabled={loading}
          className="px-4 py-2.5 rounded-xl border border-zinc-200 dark:border-zinc-700 text-sm font-medium text-zinc-600 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-colors disabled:opacity-40"
        >
          ⟳ 刷新状态
        </button>
        <p className="text-xs text-zinc-400 self-center">
          生命线保护：除 READ_ONLY 外，一键 SOS（/api/sos/trigger）与在途履约跃迁（/api/orders/*/transit）100% 无条件放行
        </p>
      </div>
    </section>
  )
}
