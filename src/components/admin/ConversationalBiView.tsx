"use client"

import React, { useCallback, useState } from "react"

export interface IBiMetricView {
  key: string
  label: string
  value: string | number
  trend?: "UP" | "DOWN" | "FLAT"
  changePercent?: number
}

export interface IBiChartDatum {
  label: string
  value: number
  secondaryValue?: number
  extra?: string
}

export interface IBiReportView {
  query: string
  title: string
  summary: string
  timeRange: { start: string; end: string }
  metrics: IBiMetricView[]
  chartType: "BAR" | "LINE" | "PIE" | "TABLE"
  chartData: IBiChartDatum[]
  suggestedFollowUps: string[]
}

const QUICK_CHIPS = [
  "各品类违约率与退款分布",
  "分析近30天平台佣金与保险计提走势",
  "高频客诉归因诊断",
]

function formatRange(range: IBiReportView["timeRange"]): string {
  const s = new Date(range.start)
  const e = new Date(range.end)
  const fmt = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`
  return `${fmt(s)} ~ ${fmt(e)}`
}

function TrendArrow({ trend, changePercent }: { trend?: "UP" | "DOWN" | "FLAT"; changePercent?: number }) {
  if (!trend) return null
  const color = trend === "UP" ? "text-emerald-500" : trend === "DOWN" ? "text-red-500" : "text-zinc-400"
  const arrow = trend === "UP" ? "↑" : trend === "DOWN" ? "↓" : "→"
  const pct = changePercent === undefined ? "" : ` ${Math.abs(changePercent).toFixed(1)}%`
  return <span className={`text-xs font-bold ${color}`}>{arrow}{pct}</span>
}

function BarChart({ data }: { data: IBiChartDatum[] }) {
  const max = Math.max(1, ...data.map((d) => d.secondaryValue ?? d.value))
  return (
    <div className="space-y-2">
      {data.map((d, i) => (
        <div key={`${d.label}-${i}`} className="flex items-center gap-2 text-sm">
          <span className="w-16 shrink-0 text-zinc-500 truncate">{d.label}</span>
          <div className="relative flex-1 h-6 bg-zinc-100 dark:bg-zinc-800 rounded overflow-hidden">
            <div
              className="absolute inset-y-0 left-0 bg-blue-500/80 rounded"
              style={{ width: `${Math.max(2, (d.value / max) * 100)}%` }}
            />
            {d.secondaryValue !== undefined && (
              <div
                className="absolute inset-y-0 left-0 bg-zinc-300 dark:bg-zinc-700 rounded"
                style={{ width: `${Math.max(2, (d.secondaryValue / max) * 100)}%` }}
              />
            )}
          </div>
          <span className="w-20 shrink-0 text-right font-mono text-zinc-600 dark:text-zinc-300">
            {d.value}{d.extra ? `（${d.extra}）` : ""}
          </span>
        </div>
      ))}
    </div>
  )
}

function LineChart({ data }: { data: IBiChartDatum[] }) {
  const W = 560
  const H = 160
  const PAD = 8
  const max = Math.max(1, ...data.flatMap((d) => [d.value, d.secondaryValue ?? 0]))
  const x = (i: number) => (data.length <= 1 ? W / 2 : PAD + (i / (data.length - 1)) * (W - PAD * 2))
  const y = (v: number) => H - PAD - (v / max) * (H - PAD * 2)

  const line = (selector: (d: IBiChartDatum) => number, stroke: string) => {
    if (data.length === 0) return null
    const pts = data.map((d, i) => `${x(i)},${y(selector(d))}`).join(" ")
    const area = data.length === 1
      ? `M ${x(0)} ${H - PAD} L ${x(0)} ${y(selector(data[0]))} L ${x(0)} ${H - PAD} Z`
      : `M ${x(0)} ${H - PAD} L ${data.map((d, i) => `${x(i)},${y(selector(d))}`).join(" L ")} L ${x(data.length - 1)} ${H - PAD} Z`
    return (
      <g key={stroke}>
        <path d={area} fill={stroke} opacity={0.08} />
        <polyline points={pts} fill="none" stroke={stroke} strokeWidth={2} strokeLinejoin="round" />
      </g>
    )
  }

  return (
    <div>
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-40" preserveAspectRatio="none" aria-label="折线走势图">
        {line((d) => d.value, "#3b82f6")}
        {line((d) => d.secondaryValue ?? 0, "#f59e0b")}
      </svg>
      <div className="flex justify-between text-xs text-zinc-400 mt-1">
        {data.length <= 8 ? data.map((d, i) => <span key={`${d.label}-${i}`}>{d.label}</span>) : (
          <span>{data[0]?.label} … {data[data.length - 1]?.label}</span>
        )}
      </div>
      <div className="flex gap-4 text-xs text-zinc-500 mt-2">
        <span className="inline-flex items-center gap-1"><i className="w-3 h-0.5 bg-blue-500 inline-block" />主指标</span>
        <span className="inline-flex items-center gap-1"><i className="w-3 h-0.5 bg-amber-500 inline-block" />次指标</span>
      </div>
    </div>
  )
}

function PieChart({ data }: { data: IBiChartDatum[] }) {
  const total = Math.max(1, data.reduce((s, d) => s + d.value, 0))
  const R = 42
  const C = 2 * Math.PI * R
  const COLORS = ["#3b82f6", "#f59e0b", "#10b981", "#ef4444", "#8b5cf6", "#ec4899", "#14b8a6", "#f97316"]
  let acc = 0
  const segments = data.map((d, i) => {
    const frac = d.value / total
    const seg = (
      <circle
        key={`${d.label}-${i}`}
        cx={60}
        cy={60}
        r={R}
        fill="none"
        stroke={COLORS[i % COLORS.length]}
        strokeWidth={14}
        strokeDasharray={`${Math.max(0, frac * C - 1.5)} ${C - Math.max(0, frac * C - 1.5)}`}
        strokeDashoffset={-acc * C}
        transform="rotate(-90 60 60)"
      />
    )
    acc += frac
    return seg
  })

  return (
    <div className="flex items-center gap-6 flex-wrap">
      <svg viewBox="0 0 120 120" className="w-32 h-32 shrink-0">
        <circle cx={60} cy={60} r={R} fill="none" stroke="#e4e4e7" strokeWidth={14} />
        {segments}
        <text x={60} y={58} textAnchor="middle" className="fill-zinc-500" fontSize={11}>占比</text>
        <text x={60} y={74} textAnchor="middle" className="fill-zinc-900 dark:fill-zinc-100" fontSize={14} fontWeight={700}>
          {data.length} 类
        </text>
      </svg>
      <ul className="space-y-1 text-sm min-w-0 flex-1">
        {data.map((d, i) => (
          <li key={`${d.label}-${i}`} className="flex items-center gap-2">
            <i className="w-3 h-3 rounded-sm inline-block shrink-0" style={{ background: COLORS[i % COLORS.length] }} />
            <span className="text-zinc-600 dark:text-zinc-300 truncate">{d.label}</span>
            <span className="ml-auto font-mono text-zinc-500">{d.value}（{Math.round((d.value / total) * 1000) / 10}%）</span>
          </li>
        ))}
      </ul>
    </div>
  )
}

function DataTable({ data }: { data: IBiChartDatum[] }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="text-left text-zinc-400 border-b border-zinc-200 dark:border-zinc-700">
            <th className="py-2 pr-4 font-medium">类目 / 维度</th>
            <th className="py-2 pr-4 font-medium text-right">主指标</th>
            <th className="py-2 pr-4 font-medium text-right">次指标</th>
            <th className="py-2 font-medium text-right">占比 / 备注</th>
          </tr>
        </thead>
        <tbody>
          {data.map((d, i) => (
            <tr key={`${d.label}-${i}`} className="border-b border-zinc-100 dark:border-zinc-800/60 last:border-0">
              <td className="py-2 pr-4 text-zinc-600 dark:text-zinc-300">{d.label}</td>
              <td className="py-2 pr-4 text-right font-mono">{d.value}</td>
              <td className="py-2 pr-4 text-right font-mono text-zinc-500">{d.secondaryValue ?? "—"}</td>
              <td className="py-2 text-right font-mono text-zinc-500">{d.extra ?? "—"}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function ChartBody({ report }: { report: IBiReportView }) {
  if (report.chartData.length === 0) {
    return <p className="text-sm text-zinc-400">暂无数据可渲染</p>
  }
  switch (report.chartType) {
    case "BAR": return <BarChart data={report.chartData} />
    case "LINE": return <LineChart data={report.chartData} />
    case "PIE": return <PieChart data={report.chartData} />
    case "TABLE": return <DataTable data={report.chartData} />
  }
}

/**
 * 对话式 BI 看板（P2 · L3-M5）：自然语言提问 + AI 归因诊断卡 + KPI 指标网格
 * + 自适应 SVG/CSS 图表（BAR/LINE/PIE/TABLE，零图表库依赖）+ 追问引导。
 */
export default function ConversationalBiView() {
  const [query, setQuery] = useState("")
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [report, setReport] = useState<IBiReportView | null>(null)

  const runQuery = useCallback(async (q: string) => {
    const text = q.trim()
    if (!text || loading) return
    setLoading(true)
    setError(null)
    try {
      const res = await fetch("/api/admin/bi", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query: text }),
      })
      if (!res.ok) {
        const body = (await res.json().catch(() => null)) as { error?: string } | null
        throw new Error(body?.error ?? `查询失败（HTTP ${res.status}）`)
      }
      setReport((await res.json()) as IBiReportView)
    } catch (err) {
      setError(err instanceof Error ? err.message : "查询失败，请稍后重试")
    } finally {
      setLoading(false)
    }
  }, [loading])

  return (
    <section className="bg-white dark:bg-zinc-900 p-6 rounded-2xl shadow-sm border border-zinc-100 dark:border-zinc-800">
      <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
        <h2 className="text-xl font-black">💬 对话式数据 BI</h2>
        <span className="text-xs font-mono text-zinc-400">L3-M5 · LLM 归因增强 / 规则确定性兜底</span>
      </div>

      <form
        className="flex gap-2"
        onSubmit={(e) => {
          e.preventDefault()
          void runQuery(query)
        }}
      >
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="用自然语言提问，如：统计各品类违约率与退款分布"
          className="flex-1 min-w-0 px-4 py-3 rounded-xl border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/50"
          aria-label="BI 查询输入框"
        />
        <button
          type="submit"
          disabled={loading || !query.trim()}
          className="px-5 py-3 rounded-xl bg-blue-600 text-white text-sm font-bold disabled:opacity-40 disabled:cursor-not-allowed hover:bg-blue-700 transition-colors"
        >
          {loading ? "解析中…" : "查询"}
        </button>
      </form>

      <div className="flex flex-wrap gap-2 mt-3">
        {QUICK_CHIPS.map((chip) => (
          <button
            key={chip}
            type="button"
            onClick={() => {
              setQuery(chip)
              void runQuery(chip)
            }}
            disabled={loading}
            className="px-3 py-1.5 rounded-full bg-blue-50 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300 text-xs font-medium hover:bg-blue-100 dark:hover:bg-blue-900/50 transition-colors disabled:opacity-40"
          >
            {chip}
          </button>
        ))}
      </div>

      {error && (
        <p className="mt-4 p-3 rounded-xl bg-red-50 dark:bg-red-950/30 text-red-600 dark:text-red-400 text-sm">
          ⚠️ {error}
        </p>
      )}

      {report && (
        <div className="mt-6 space-y-6">
          <div className="p-4 rounded-xl bg-gradient-to-br from-blue-50 to-indigo-50 dark:from-blue-950/30 dark:to-indigo-950/30 border border-blue-100 dark:border-blue-900/50">
            <div className="flex items-center gap-2 text-sm text-zinc-500 mb-1 flex-wrap">
              <span className="font-mono">📊 {report.title}</span>
              <span className="text-xs">({formatRange(report.timeRange)})</span>
            </div>
            <p className="text-zinc-700 dark:text-zinc-200 text-sm leading-relaxed">🧠 {report.summary}</p>
          </div>

          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            {report.metrics.map((m) => (
              <div key={m.key} className="p-4 rounded-xl bg-zinc-50 dark:bg-zinc-800 border border-zinc-100 dark:border-zinc-700">
                <p className="text-xs text-zinc-400 font-medium">{m.label}</p>
                <div className="flex items-baseline gap-2 mt-1">
                  <p className="text-2xl font-black text-zinc-800 dark:text-zinc-100 truncate">{m.value}</p>
                  <TrendArrow trend={m.trend} changePercent={m.changePercent} />
                </div>
              </div>
            ))}
          </div>

          <div className="rounded-xl border border-zinc-100 dark:border-zinc-700 p-4">
            <ChartBody report={report} />
          </div>

          {report.suggestedFollowUps.length > 0 && (
            <div>
              <p className="text-xs text-zinc-400 font-medium mb-2">💡 继续追问</p>
              <div className="flex flex-wrap gap-2">
                {report.suggestedFollowUps.map((f) => (
                  <button
                    key={f}
                    type="button"
                    onClick={() => {
                      setQuery(f)
                      void runQuery(f)
                    }}
                    disabled={loading}
                    className="px-3 py-1.5 rounded-full border border-zinc-200 dark:border-zinc-700 text-zinc-600 dark:text-zinc-300 text-xs hover:border-blue-400 hover:text-blue-600 dark:hover:text-blue-300 transition-colors disabled:opacity-40"
                  >
                    {f}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </section>
  )
}

export { QUICK_CHIPS }