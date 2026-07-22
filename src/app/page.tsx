"use client"

import Link from "next/link"
import { useState, useEffect, useRef } from "react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import ClientConsole from "@/components/ClientConsole"
import { ArrowRight, Sparkles, Shield, ShieldCheck, FileText, Scale, Cpu, ChevronRight, Lock, ScrollText, Zap, Clock, Route, TrendingUp } from "lucide-react"

const STATS = [
  { value: "＜ 3s", sub: "平均 AI 契约生成时效", icon: Clock },
  { value: "99.4%", sub: "全网即时派单抢单响应率", icon: Zap },
  { value: "100%", sub: "双端资金锁定与安全托管", icon: ShieldCheck },
  { value: "¥4.2M", sub: "历史累计安全流转金额", icon: TrendingUp },
]

function Typewriter({ texts }: { texts: string[] }) {
  const [displayText, setDisplayText] = useState("")
  const idxRef = useRef(0)
  const charRef = useRef(0)
  const dirRef = useRef(1)

  useEffect(() => {
    const interval = setInterval(() => {
      const dir = dirRef.current
      const idx = idxRef.current
      const text = texts[idx]
      let next = charRef.current + dir

      if (next > text.length) {
        setTimeout(() => { dirRef.current = -1 }, 1000)
        return
      }
      if (next < 0) {
        dirRef.current = 1
        idxRef.current = (idx + 1) % texts.length
        charRef.current = 0
        setDisplayText("")
        return
      }
      charRef.current = next
      setDisplayText(text.slice(0, next))
    }, 60)
    return () => clearInterval(interval)
  }, [texts])

  return <span>{displayText}<span className="animate-pulse">|</span></span>
}

export default function Home() {
  const [view, setView] = useState<"home" | "clientConsole">("home")

  useEffect(() => {
    if (typeof window !== "undefined" && window.location.search.includes("view=console")) {
      setView("clientConsole")
    }
  }, [])

  if (view === "clientConsole") {
    return <ClientConsole onBackToHome={() => { setView("home"); window.history.replaceState(null, "", "/") }} />
  }

  return (
    <div className="flex flex-col bg-slate-50 dark:bg-zinc-950">
      {/* ══════ Hero ══════ */}
      <section className="relative overflow-hidden px-4 pt-24 pb-20 sm:pt-32 sm:pb-28 lg:pt-40 lg:pb-32">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,rgba(99,102,241,0.08),transparent_50%)]" />
        <div className="relative mx-auto max-w-5xl text-center">
          {/* Pill badge */}
          <div className="mx-auto mb-6 inline-flex items-center gap-2 rounded-full border border-slate-200/60 bg-white px-4 py-1.5 text-xs text-slate-500 shadow-sm dark:border-zinc-800/60 dark:bg-zinc-900 dark:text-zinc-400">
            <Sparkles className="size-3 text-indigo-600 dark:text-indigo-400" />
            AI 驱动 · 隐私脱敏广播 · 毫秒级即时派单
          </div>

          {/* Headline */}
          <h1 className="text-5xl font-black tracking-tight text-slate-900 sm:text-6xl lg:text-7xl dark:text-zinc-100">
            自然语言输入，
            <br className="sm:hidden" />
            <span className="bg-gradient-to-r from-indigo-500 to-emerald-500 bg-clip-text text-transparent">
              秒级智能派单
            </span>
          </h1>

          {/* Subtitle */}
          <p className="mx-auto mt-6 max-w-2xl text-base leading-relaxed text-slate-500 dark:text-zinc-400">
            基于大模型动态解析时空与任务条款。一键全网隐私脱敏广播，认证履约方即时抢单，交付时双端单向解密。
          </p>

          {/* Typewriter sub */}
          <div className="mx-auto mt-6 max-w-2xl text-base text-slate-400 dark:text-zinc-500 h-7">
            <Typewriter texts={[
              "例如：今晚 9 点在临沂科技园需要一位高级网络专家执行核心路由紧急排障，预算 500 元，限时 2 小时完成...",
              "例如：明天上午 10 点杭州滨江需 3 名活动执行搭建展台，含物料搬运，预算 800 元，工期 4 小时...",
              "例如：即刻需要一名同城骑手从 A 点取文件送至 B 点，加急单补贴 20 元，预计 30 分钟送达...",
            ]} />
          </div>

          {/* Dual CTA */}
          <div className="mt-10 flex flex-wrap items-center justify-center gap-4">
            <Link href="/demands/new">
              <Button className="rounded-xl bg-indigo-600 px-8 py-7 text-lg font-bold text-white shadow-lg shadow-indigo-600/20 transition-all hover:bg-indigo-700 hover:shadow-xl hover:shadow-indigo-600/30">
                <Zap className="mr-2 size-5" />
                立即生成并广播协议
              </Button>
            </Link>
            <Link href="/provider">
              <Button
                variant="outline"
                className="rounded-xl border-slate-200/60 bg-white px-8 py-7 text-base font-semibold text-slate-700 shadow-sm dark:border-zinc-800/60 dark:bg-zinc-900 dark:text-zinc-300"
              >
                查看实时派单大盘
                <ChevronRight className="ml-1.5 size-4" />
              </Button>
            </Link>
          </div>

          {/* Trust bar */}
          <div className="mx-auto mt-12 flex max-w-lg flex-wrap items-center justify-center gap-x-8 gap-y-2 text-xs text-slate-400 dark:text-zinc-500">
            <span className="flex items-center gap-1.5"><Cpu className="size-3" />AI 语义解析结构化</span>
            <span className="flex items-center gap-1.5"><Route className="size-3" />即时路由派单网络</span>
            <span className="flex items-center gap-1.5"><Lock className="size-3" />阶段性资金锁定</span>
          </div>
        </div>
      </section>

      {/* ══════ Feature Bento-Grid ══════ */}
      <section className="mx-auto max-w-6xl px-4 pb-20">
        <div className="mb-10 text-center">
          <h2 className="text-3xl font-bold tracking-tight text-slate-900 dark:text-zinc-100">
            三大核心引擎
          </h2>
          <p className="mt-2 text-sm text-slate-500 dark:text-zinc-500">
            语义解析 · 路由派单 · 资金锁定
          </p>
        </div>

        <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
          {/* Card A: AI Semantic Parsing */}
          <div className="rounded-2xl border border-slate-200/60 bg-white p-6 transition-all duration-200 hover:shadow-md dark:border-zinc-800/60 dark:bg-zinc-900">
            <div className="mb-4 flex h-10 w-10 items-center justify-center rounded-xl bg-indigo-50 dark:bg-indigo-950/30">
              <Cpu className="size-5 text-indigo-600 dark:text-indigo-400" />
            </div>
            <h3 className="text-base font-bold text-slate-900 dark:text-zinc-100">AI 语义解析结构化</h3>
            <p className="mt-1 text-xs text-slate-500 dark:text-zinc-500 leading-relaxed">
              大模型实时解析文本，精准提取时间、地点、任务核心、交付标的，自动固化为标准数字智能协议
            </p>
            {/* Protocol card thumbnail */}
            <div className="mt-4 rounded-xl border border-slate-100 bg-slate-50 p-3 dark:border-zinc-800 dark:bg-zinc-800/50">
              <div className="flex items-center gap-2 text-[10px] text-slate-500 dark:text-zinc-400">
                <span className="flex h-1.5 w-1.5 rounded-full bg-emerald-500" />
                <span className="animate-pulse">LLM 解析中...</span>
              </div>
              <div className="mt-2 space-y-1.5">
                <div className="flex justify-between text-[10px]"><span className="text-slate-400 dark:text-zinc-500">📍 位置</span><span className="font-medium text-slate-700 dark:text-zinc-300">杭州滨江国际博览中心</span></div>
                <div className="flex justify-between text-[10px]"><span className="text-slate-400 dark:text-zinc-500">⏱ 时段</span><span className="font-medium text-slate-700 tabular-nums dark:text-zinc-300">明天 10:00 - 18:00</span></div>
                <div className="flex justify-between text-[10px]"><span className="text-slate-400 dark:text-zinc-500">💰 预算</span><span className="font-medium text-amber-600 dark:text-amber-400">¥1,200</span></div>
              </div>
            </div>
          </div>

          {/* Card B: Instant Route Dispatch */}
          <div className="rounded-2xl border border-slate-200/60 bg-white p-6 transition-all duration-200 hover:shadow-md dark:border-zinc-800/60 dark:bg-zinc-900">
            <div className="mb-4 flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-50 dark:bg-emerald-950/30">
              <Zap className="size-5 text-emerald-600 dark:text-emerald-400" />
            </div>
            <h3 className="text-base font-bold text-slate-900 dark:text-zinc-100">动态即时路由派单</h3>
            <p className="mt-1 text-xs text-slate-500 dark:text-zinc-500 leading-relaxed">
              协议确认瞬间，触发毫秒级地理与技能流向过滤，将需求实时精准推送到周边认证履约方
            </p>
            <div className="mt-4 rounded-xl border border-emerald-100 bg-emerald-50/50 p-4 dark:border-emerald-900/30 dark:bg-emerald-950/10">
              <div className="flex items-center gap-2">
                <span className="text-2xl font-black text-slate-900 tabular-nums dark:text-zinc-100">＜ 3s</span>
                <Badge className="border-0 bg-emerald-100 text-[10px] text-emerald-700 dark:bg-emerald-950/30 dark:text-emerald-400">
                  ⚡ 即时抢单进行中
                </Badge>
              </div>
              <p className="mt-2 text-[10px] text-emerald-600 dark:text-emerald-400">认证履约方已收到推送 · 1.2km 范围内</p>
            </div>
          </div>

          {/* Card C: Milestone-based Fund Locking */}
          <div className="rounded-2xl border border-slate-200/60 bg-white p-6 transition-all duration-200 hover:shadow-md dark:border-zinc-800/60 dark:bg-zinc-900">
            <div className="mb-4 flex h-10 w-10 items-center justify-center rounded-xl bg-amber-50 dark:bg-amber-950/30">
              <Lock className="size-5 text-amber-600 dark:text-amber-400" />
            </div>
            <h3 className="text-base font-bold text-slate-900 dark:text-zinc-100">阶段性智能资金锁定</h3>
            <p className="mt-1 text-xs text-slate-500 dark:text-zinc-500 leading-relaxed">
              交易资金进入独立的阶段性隔离锁定。履约方现场完成任务、上传凭证、双端确认后，资金秒级结算
            </p>
            <div className="mt-4 grid grid-cols-3 gap-2">
              {[
                { step: "1", label: "智能托管" },
                { step: "2", label: "履约完成" },
                { step: "3", label: "秒级结算" },
              ].map((p) => (
                <div key={p.step} className="rounded-lg border border-slate-100 bg-white px-2 py-3 text-center dark:border-zinc-800 dark:bg-zinc-900">
                  <p className="text-xs font-bold text-indigo-600 dark:text-indigo-400">{p.step}</p>
                  <p className="mt-0.5 text-[9px] text-slate-500 dark:text-zinc-500">{p.label}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ══════ System Dashboard Metrics ══════ */}
      <section className="border-y border-slate-200/60 bg-white px-4 py-16 dark:border-zinc-800/60 dark:bg-zinc-900">
        <div className="mx-auto max-w-5xl">
          <div className="grid grid-cols-2 gap-px overflow-hidden rounded-2xl border border-slate-200/60 bg-slate-200/60 dark:border-zinc-800/60 dark:bg-zinc-800/60 md:grid-cols-4">
            {STATS.map((s) => (
              <div key={s.sub} className="bg-white px-6 py-8 text-center dark:bg-zinc-900">
                <s.icon className="mx-auto size-5 text-indigo-500/60 dark:text-indigo-400/60" />
                <p className="mt-3 font-mono text-3xl font-semibold tracking-tight text-slate-900 dark:text-zinc-100">
                  {s.value}
                </p>
                <p className="mt-1.5 text-xs leading-relaxed text-slate-500 dark:text-zinc-500">{s.sub}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ══════ Final CTA ══════ */}
      <section className="relative overflow-hidden px-4 py-20 sm:py-28">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_bottom_left,rgba(99,102,241,0.08),transparent_50%)]" />
        <div className="relative mx-auto max-w-3xl text-center">
          <h2 className="text-3xl font-bold tracking-tight text-slate-900 dark:text-zinc-100">
            让你的每一次派单，都具备机器级的严谨与毫秒级的响应
          </h2>
          <p className="mx-auto mt-4 max-w-xl text-sm leading-relaxed text-slate-500 dark:text-zinc-500">
            从自然语言输入到全网广播，再到履约结算，全流程 AI 驱动，实时可追溯。
          </p>
          <div className="mt-8 flex items-center justify-center gap-4">
            <Link href="/demands/new">
              <Button className="rounded-xl bg-indigo-600 px-8 py-7 text-base font-bold text-white shadow-lg shadow-indigo-600/20 transition-all hover:bg-indigo-700">
                立刻发起即时派单控制台 <ArrowRight className="ml-2 size-4" />
              </Button>
            </Link>
          </div>
        </div>
      </section>

      {/* ══════ Footer ══════ */}
      <footer className="border-t border-slate-200/60 bg-white px-4 py-10 dark:border-zinc-800/60 dark:bg-zinc-900">
        <div className="mx-auto max-w-5xl text-center">
          <div className="mx-auto mb-3 inline-flex items-center gap-2">
            <span className="flex h-6 w-6 items-center justify-center rounded-lg bg-indigo-600 text-[8px] font-bold text-white">dp</span>
            <span className="text-sm font-semibold text-slate-900 dark:text-zinc-100">deal<span className="text-indigo-600">-protocol</span></span>
          </div>
          <p className="text-xs text-slate-400 dark:text-zinc-500">企业级智能契约与可信任数字资产托管协议架构</p>
        </div>
      </footer>
    </div>
  )
}
