"use client"

import { useChat } from "@ai-sdk/react"
import { useRef, useEffect, useMemo, useState, useCallback, type ChangeEvent } from "react"
import { useRouter } from "next/navigation"
import toast from "react-hot-toast"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import VoiceMicButton from "@/components/VoiceMicButton"
import {
  SendHorizonal, User, Bot, Loader2,
  CheckCircle2, PanelRightOpen,
  Cpu, Radio, ShieldCheck,
} from "lucide-react"
import { cn } from "@/lib/utils"

const quickReplies = [
  "空调不制冷了，需要加氟，在朝阳区",
  "腰疼想做个按摩，上门服务",
  "厨房深度保洁，200-300块",
]

type DemoState = "idle" | "parsing" | "broadcasting" | "matched"

interface Session {
  id: string
  email?: string
  name?: string
  role?: string
}

const DEMO_LOGS: Record<Exclude<DemoState, "idle">, string[]> = {
  parsing: [
    "[LLM] 正在解析自然语言输入...",
    "[NLP] 实体抽取完成 → 时间: \"明天上午 10:00\"",
    "[NLP] 实体抽取完成 → 地点: \"杭州滨江国际博览中心\"",
    "[NLP] 实体抽取完成 → 任务: \"展台搭建 + 物料搬运\"",
    "[NLP] 实体抽取完成 → 预算: \"¥1,200\"",
    "[CORE] 协议结构化完毕 ✓",
  ],
  broadcasting: [
    "[ROUTE] 启动全网隐私脱敏广播...",
    "[DISPATCH] 匹配到 3 名认证履约方 (半径 2.5km)",
    "[PUSH] 已推送至履约方终端",
    "[PUSH] 履约方 A 正在查看协议...",
    "[PUSH] 履约方 B 已确认意向",
    "[PUSH] 履约方 C 已确认意向",
  ],
  matched: [
    "[MATCH] 最优匹配确认: 履约方 C",
    "[CRYPTO] 发起双端密钥协商...",
    "[CRYPTO] 客户公钥已锁定",
    "[CRYPTO] 履约方公钥已锁定",
    "[DECRYPT] 双端单向解密通道建立",
    "[FUND] 交易资金进入阶段性隔离锁定 ✓",
    "[DONE] 协议已签订，等待履约",
  ],
}

export default function SplitDemandView({ session }: { session?: Session | null }) {
  const router = useRouter()
  const scrollRef = useRef<HTMLDivElement>(null)
  const formRef = useRef<HTMLFormElement>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [publishedId, setPublishedId] = useState<string | null>(null)
  const [demoState, setDemoState] = useState<DemoState>("idle")
  const [logFeed, setLogFeed] = useState<string[]>([])
  const [logIndex, setLogIndex] = useState(0)

  const [media, setMedia] = useState<Array<{ url: string; name: string; type: "image" | "video" }>>([])

  interface ExtractedProtocol {
    category?: string
    budget?: number | string
    pricing_type?: string
    service_time?: string
    address_hint?: string
    duration_minutes?: number
    therapist_preference?: string
    health_declaration?: string[]
    special_requirements?: string[]
    compliance_clauses?: string[]
  }

  const [extractedProtocol, setExtractedProtocol] = useState<ExtractedProtocol | null>(null)
  const [createdDemandId, setCreatedDemandId] = useState<string | null>(null)

  const userContext = session
    ? { name: session.name, creditScore: 780, level: "信用极佳", address: "朝阳区（历史常用地址）", role: session.role }
    : { name: "Demo用户", creditScore: 650, level: "信用良好", address: "朝阳区建国路88号", role: "CUSTOMER" }

  const [input, setInput] = useState("")

  const { messages, sendMessage, status } = useChat({
    api: "/api/chat",
    body: { userContext },
    onError: (err) => console.error("Chat error:", err),
  } as Parameters<typeof useChat>[0])

  const isLoading = status === "submitted" || status === "streaming"

  const handleInputChange = useCallback((e: ChangeEvent<HTMLTextAreaElement>) => {
    setInput(e.target.value)
  }, [])

  const handleFormSubmit = useCallback(
    (e: React.FormEvent) => {
      e.preventDefault()
      if (!input.trim() || isLoading || demoState !== "idle") return
      sendMessage({ text: input })
      setInput("")
    },
    [input, isLoading, sendMessage, demoState],
  )

  const handleDemoStart = useCallback(() => {
    if (!input.trim() || demoState !== "idle") return
    setDemoState("parsing")
    setLogFeed([])
    setLogIndex(0)
  }, [input, demoState])

  // ── Shadow interceptor: extract protocol JSON from AI response ──
  useEffect(() => {
    const lastMsg = messages[messages.length - 1]
    if (lastMsg?.role !== "assistant") return
    const text = (lastMsg as any).content || lastMsg.parts?.filter((p: any) => p.type === 'text').map((p: any) => p.text).join('') || ''
    const match = text.match(/\[PROTOCOL_JSON\]([\s\S]*?)\[\/PROTOCOL_JSON\]/)
    if (match) {
      try {
        const parsed = JSON.parse(match[1])
        setExtractedProtocol(parsed)
        console.log("[Shadow Interceptor] Protocol extracted:", parsed)
      } catch (e) {
        console.warn("[Shadow Interceptor] JSON parse failed (incomplete stream?)", e)
      }
    }
  }, [messages])

  const renderBubbleContent = useCallback((content: string) => {
    const idx = content.indexOf('[PROTOCOL_JSON]')
    if (idx !== -1) {
      return content.substring(0, idx).trim()
    }
    return content
  }, [])

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight
    }
  }, [messages])

  useEffect(() => {
    if (createdDemandId) {
      setPublishedId(createdDemandId)
    }
  }, [createdDemandId])

  useEffect(() => {
    if (demoState === "idle") return
    const logs = DEMO_LOGS[demoState]
    if (logIndex < logs.length) {
      const timer = setTimeout(() => {
        setLogFeed(prev => [...prev, logs[logIndex]])
        setLogIndex(i => i + 1)
      }, 350 + Math.random() * 250)
      return () => clearTimeout(timer)
    }
    const nextMap: Record<DemoState, DemoState | null> = {
      parsing: "broadcasting",
      broadcasting: "matched",
      matched: null,
      idle: null,
    }
    const next = nextMap[demoState]
    if (next) {
      const timer = setTimeout(() => {
        setDemoState(next)
        setLogIndex(0)
        setLogFeed([])
      }, 600)
      return () => clearTimeout(timer)
    }
  }, [demoState, logIndex])

  const handleQuickReply = (text: string) => {
    sendMessage({ text })
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey && !isLoading) {
      e.preventDefault()
      handleFormSubmit(e as any)
    }
  }

  const handleBroadcast = useCallback(async () => {
    if (!extractedProtocol) return
    setIsSubmitting(true)
    try {
      const rawBudget = extractedProtocol.budget
      const cleanBudget = typeof rawBudget === 'number'
        ? rawBudget
        : parseFloat(String(rawBudget ?? '').replace(/[^\d.]/g, '')) || 0

      const body = {
        title: String(extractedProtocol.category || '服务需求').slice(0, 100),
        description: [
          extractedProtocol.address_hint && `📍 ${extractedProtocol.address_hint}`,
          extractedProtocol.service_time && `服务时间：${extractedProtocol.service_time}`,
          extractedProtocol.therapist_preference && `技师偏好：${extractedProtocol.therapist_preference}`,
          extractedProtocol.duration_minutes && `服务时长：${extractedProtocol.duration_minutes}分钟`,
          extractedProtocol.health_declaration?.length && `健康声明：${extractedProtocol.health_declaration!.join('；')}`,
          extractedProtocol.special_requirements?.length && `特殊要求：${extractedProtocol.special_requirements!.join('；')}`,
        ].filter(Boolean).join(' | ') || '无额外说明',
        category: String(extractedProtocol.category || '').slice(0, 50),
        budgetMin: cleanBudget > 0 ? cleanBudget : null,
        budgetMax: cleanBudget > 0 ? cleanBudget : null,
        urgency: 'medium',
      }
      const res = await fetch("/api/demands", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      })
      if (!res.ok) {
        const errData = await res.json().catch(() => null)
        toast.error(`广播失败: ${errData?.error || errData?.message || '未知错误'}`)
        return
      }
      const data = await res.json()
      setPublishedId(data.id)
      toast.success('数字化协议广播成功！已发布至需求大厅。')
    } catch (err) {
      console.error("Broadcast error:", err)
      toast.error('网络异常，协议广播失败。')
    } finally {
      setIsSubmitting(false)
    }
  }, [extractedProtocol])

  const hasMessages = messages.length > 1
  const isComplete = !!publishedId

  return (
    <div className="flex flex-col lg:flex-row w-full min-h-screen bg-zinc-950 touch-manipulation">

      {/* 1. Left: Protocol Canvas (45% on desktop, full-width on mobile) */}
      <div className="w-full lg:w-[45%] h-auto lg:h-screen border-b lg:border-b-0 lg:border-r border-zinc-800 bg-zinc-900 p-6 overflow-y-auto dark:bg-zinc-900">
        <h2 className="text-xl font-bold mb-4 text-zinc-100">📋 数字化服务意向协议</h2>

        {extractedProtocol ? (
          <div className="space-y-4">
            <div className="p-4 bg-blue-950/30 rounded-lg border border-blue-900/50">
              <div className="text-sm text-blue-400 font-medium">意向品类</div>
              <div className="text-xl font-bold text-blue-300">{extractedProtocol.category}</div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="p-3 bg-zinc-800/50 rounded border border-zinc-700">
                <div className="text-xs text-zinc-400">服务方式</div>
                <div className="font-semibold text-zinc-100">{extractedProtocol.pricing_type || '一口价'}</div>
              </div>
              <div className="p-3 bg-zinc-800/50 rounded border border-zinc-700">
                <div className="text-xs text-zinc-400">预估预算</div>
                <div className="font-semibold text-zinc-100">¥ {extractedProtocol.budget}</div>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="p-3 bg-zinc-800/50 rounded border border-zinc-700">
                <div className="text-xs text-zinc-400">服务时间</div>
                <div className="font-semibold text-zinc-100">{extractedProtocol.service_time}</div>
              </div>
              <div className="p-3 bg-zinc-800/50 rounded border border-zinc-700">
                <div className="text-xs text-zinc-400">地点线索</div>
                <div className="font-semibold text-zinc-100">{extractedProtocol.address_hint}</div>
              </div>
            </div>

            {/* Massage-specific: duration_minutes */}
            {extractedProtocol.duration_minutes && (
              <div className="p-3 bg-zinc-800/50 rounded border border-zinc-700">
                <div className="text-xs text-zinc-400">服务时长</div>
                <div className="font-semibold text-zinc-100">{extractedProtocol.duration_minutes} 分钟</div>
              </div>
            )}

            {/* Massage-specific: therapist preference */}
            {extractedProtocol.therapist_preference && (
              <div className="p-3 bg-zinc-800/50 rounded border border-zinc-700">
                <div className="text-xs text-zinc-400">技师偏好</div>
                <div className="font-semibold text-zinc-100">{extractedProtocol.therapist_preference}</div>
              </div>
            )}

            {/* Massage-specific: health declaration */}
            {extractedProtocol.health_declaration && extractedProtocol.health_declaration.length > 0 && (
              <div className="p-3 bg-red-950/30 rounded border border-red-900/50">
                <div className="text-xs text-red-400 font-medium">健康与风险自述声明</div>
                <ul className="list-disc list-inside text-sm text-red-300 mt-1">
                  {extractedProtocol.health_declaration.map((h: string, i: number) => (
                    <li key={i}>{h}</li>
                  ))}
                </ul>
              </div>
            )}

            {/* Special requirements */}
            {extractedProtocol.special_requirements && extractedProtocol.special_requirements.length > 0 && (
              <div className="p-3 bg-zinc-800/50 rounded border border-zinc-700">
                <div className="text-xs text-zinc-400">个性化要求</div>
                <ul className="list-disc list-inside text-sm text-zinc-300 mt-1">
                  {extractedProtocol.special_requirements.map((r: string, i: number) => (
                    <li key={i}>{r}</li>
                  ))}
                </ul>
              </div>
            )}

            {/* Core compliance clauses */}
            <div className="mt-6 border-t border-zinc-700 pt-4">
              <div className="text-xs text-zinc-500 font-bold uppercase mb-2">平台合规与免责条款</div>
              <div className="space-y-2">
                {extractedProtocol.compliance_clauses?.map((clause: string, index: number) => (
                  <p key={index} className="text-xs text-zinc-400 leading-relaxed bg-zinc-800/50 p-2.5 rounded">
                    {clause}
                  </p>
                ))}
              </div>
            </div>

            {/* Publish button */}
            <button
              onClick={handleBroadcast}
              disabled={isSubmitting}
              className={`w-full mt-6 text-white py-3 rounded-xl font-medium transition shadow-sm ${
                isSubmitting
                  ? 'bg-purple-400 cursor-not-allowed'
                  : 'bg-purple-600 hover:bg-purple-700 active:scale-[0.98]'
              }`}
            >
              {isSubmitting ? '正在广播协议沙盒...' : '确认无误，广播数字协议'}
            </button>

            {publishedId && (
              <div className="flex flex-col items-center py-8 text-center">
                <div className="flex h-14 w-14 items-center justify-center rounded-full bg-emerald-950/30">
                  <CheckCircle2 className="size-7 text-emerald-400" />
                </div>
                <h3 className="mt-3 text-lg font-bold text-zinc-100">需求已发布！</h3>
                <p className="mt-0.5 text-sm text-zinc-400">ID: {publishedId}</p>
                <button
                  className="mt-4 w-full border border-zinc-700 hover:bg-zinc-800 text-zinc-300 py-2.5 rounded-xl font-medium transition"
                  onClick={() => router.push("/dashboard")}
                >
                  查看订单
                </button>
              </div>
            )}
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center h-64 text-zinc-500">
            <span className="text-4xl mb-2">⚡</span>
            <p className="text-sm">协议待生成</p>
            <p className="text-xs text-zinc-500">在右侧输入需求，AI 将在此处流式点亮协议</p>
          </div>
        )}
      </div>

      {/* 2. Right: Pure Chat Area (remaining width) */}
      <div className="flex-1 h-auto lg:h-screen flex flex-col bg-zinc-950">
        {/* Header bar */}
        <div className="flex items-center gap-3 border-b border-slate-200/60 bg-white px-6 py-3 dark:border-zinc-800/60 dark:bg-zinc-950">
          <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-indigo-50 text-indigo-600 dark:bg-indigo-950/30 dark:text-indigo-400">
            <Bot className="size-4" />
          </div>
          <div className="flex-1">
            <p className="text-sm font-medium text-slate-900 dark:text-zinc-100">AI 协议助手</p>
            <p className="text-xs text-slate-500 dark:text-zinc-500">描述需求，协议实时生成</p>
          </div>
          <Badge
            variant="outline"
            className={cn(
              "border-0 text-xs px-3 py-1",
              isLoading
                ? "bg-amber-50 text-amber-700 dark:bg-amber-950/30 dark:text-amber-400"
                : "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/30 dark:text-emerald-400",
            )}
          >
            <span className={cn(
              "mr-1.5 inline-block h-1.5 w-1.5 rounded-full",
              isLoading ? "bg-amber-500 animate-pulse" : "bg-emerald-500",
            )} />
            {isLoading ? "思考中..." : "在线"}
          </Badge>
        </div>

        {/* Scrollable Content */}
        <div className="flex-1 overflow-y-auto bg-slate-50/50 dark:bg-zinc-950/50" ref={scrollRef}>
          <div className="mx-auto max-w-2xl p-6 space-y-6">
            {/* Demo state panel */}
            {demoState !== "idle" && (
              <div className="space-y-5">
                <div className="text-center">
                  {demoState === "parsing" && (
                    <div className="relative inline-flex">
                      <div className="flex h-20 w-20 items-center justify-center rounded-2xl bg-indigo-50 dark:bg-indigo-950/30">
                        <Cpu className="size-9 text-indigo-600 dark:text-indigo-400" />
                      </div>
                      <span className="absolute -top-1 -right-1 flex h-5 w-5">
                        <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-indigo-400 opacity-75" />
                        <span className="relative inline-flex h-5 w-5 rounded-full bg-indigo-500" />
                      </span>
                    </div>
                  )}
                  {demoState === "broadcasting" && (
                    <div className="relative inline-flex">
                      <div className="flex h-20 w-20 items-center justify-center rounded-2xl bg-emerald-50 dark:bg-emerald-950/30">
                        <Radio className="size-9 text-emerald-600 dark:text-emerald-400" />
                      </div>
                      <span className="absolute inset-0 flex items-center justify-center">
                        <span className="h-28 w-28 rounded-full border-2 border-emerald-300 animate-ping opacity-25" />
                      </span>
                    </div>
                  )}
                  {demoState === "matched" && (
                    <div className="relative inline-flex">
                      <div className="flex h-20 w-20 items-center justify-center rounded-2xl bg-emerald-50 dark:bg-emerald-950/30">
                        <ShieldCheck className="size-9 text-emerald-600 dark:text-emerald-400" />
                      </div>
                    </div>
                  )}
                </div>

                <div className="text-center">
                  <h3 className="text-lg font-bold text-slate-900 dark:text-zinc-100">
                    {demoState === "parsing" && "AI 语义解析结构化中..."}
                    {demoState === "broadcasting" && "全网隐私脱敏广播中..."}
                    {demoState === "matched" && "匹配成功 · 双端解密通道已建立"}
                  </h3>
                  <p className="mt-1 text-sm text-slate-500 dark:text-zinc-500">
                    {demoState === "parsing" && "大模型实时抽取时间、地点、任务、预算"}
                    {demoState === "broadcasting" && "向周边认证履约方推送协议"}
                    {demoState === "matched" && "资金已锁定，等待现场履约"}
                  </p>
                </div>

                <div className="rounded-xl border border-slate-200/60 bg-slate-900 p-4 font-mono text-xs leading-relaxed dark:border-zinc-700/60">
                  {logFeed.map((line, i) => (
                    <p key={i} className="text-emerald-400">
                      <span className="text-slate-500">[{String(i + 1).padStart(2, "0")}]</span> {line}
                    </p>
                  ))}
                  {logFeed.length < DEMO_LOGS[demoState].length && (
                    <p className="text-slate-500 animate-pulse mt-1">
                      <span className="text-slate-600">[--]</span> _
                    </p>
                  )}
                </div>

                {demoState === "parsing" && logFeed.length >= 5 && (
                  <div className="rounded-xl border border-indigo-100 bg-indigo-50/50 p-4 dark:border-indigo-900/30 dark:bg-indigo-950/10">
                    <div className="grid grid-cols-2 gap-3 text-sm">
                      <div><span className="text-slate-400">📍 位置</span><p className="font-medium text-slate-900 dark:text-zinc-100">杭州滨江国际博览中心</p></div>
                      <div><span className="text-slate-400">⏱ 时段</span><p className="font-medium text-slate-900 dark:text-zinc-100">明天 10:00 - 18:00</p></div>
                      <div><span className="text-slate-400">📋 任务</span><p className="font-medium text-slate-900 dark:text-zinc-100">展台搭建 + 物料搬运</p></div>
                      <div><span className="text-slate-400">💰 预算</span><p className="font-medium text-amber-600">¥1,200</p></div>
                    </div>
                  </div>
                )}

                {demoState === "broadcasting" && logFeed.length >= 3 && (
                  <div className="space-y-2">
                    {["履约方 A", "履约方 B", "履约方 C"].map((name, i) => (
                      <div key={name} className={cn(
                        "rounded-xl border p-3 transition-all",
                        logFeed.length > 4 + i
                          ? "border-emerald-200 bg-emerald-50/50 dark:border-emerald-900/30 dark:bg-emerald-950/10"
                          : "border-slate-200/60 bg-white dark:border-zinc-800/60 dark:bg-zinc-900",
                      )}>
                        <div className="flex items-center justify-between">
                          <span className="text-sm font-medium text-slate-900 dark:text-zinc-100">{name}</span>
                          {logFeed.length > 4 + i ? (
                            <Badge className="border-0 bg-emerald-100 text-[10px] text-emerald-700 dark:bg-emerald-950/30 dark:text-emerald-400">已确认 ✓</Badge>
                          ) : (
                            <Badge className="border-0 bg-amber-50 text-[10px] text-amber-600 dark:bg-amber-950/30 dark:text-amber-400 animate-pulse">待确认</Badge>
                          )}
                        </div>
                        <p className="mt-0.5 text-[10px] text-slate-400">信用评分 780 · 距离 1.2km</p>
                      </div>
                    ))}
                  </div>
                )}

                {demoState === "matched" && logFeed.length >= DEMO_LOGS.matched.length && (
                  <div className="flex flex-col items-center py-6 text-center">
                    <div className="flex h-14 w-14 items-center justify-center rounded-full bg-emerald-50 dark:bg-emerald-950/30">
                      <CheckCircle2 className="size-7 text-emerald-600" />
                    </div>
                    <h3 className="mt-3 text-lg font-bold text-slate-900 dark:text-zinc-100">协议已签订，全网广播完成</h3>
                    <p className="mt-1 text-sm text-slate-500 dark:text-zinc-500">履约方 C 将在 30 分钟内到达现场</p>
                    <div className="mt-4 flex gap-3">
                      <Button variant="outline" onClick={() => router.push("/orders")}>查看订单</Button>
                      <Button variant="outline" onClick={() => router.push("/?view=console")}>进入控制台</Button>
                      <Button onClick={() => { setDemoState("idle"); setLogFeed([]); setLogIndex(0) }}>再发一笔</Button>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Quick replies (empty state) */}
            {!hasMessages && !isLoading && demoState === "idle" && (
              <div className="space-y-4">
                <div className="flex flex-col items-center justify-center py-16 text-center">
                  <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-indigo-50 dark:bg-indigo-950/30">
                    <PanelRightOpen className="size-7 text-indigo-600 dark:text-indigo-400" />
                  </div>
                  <h2 className="mt-5 text-xl font-bold text-slate-900 dark:text-zinc-100">开始发布需求</h2>
                  <p className="mt-2 max-w-sm text-sm text-slate-500 dark:text-zinc-500 leading-relaxed">
                    在下方描述您的需求，AI 将自动生成协议，您可以直接编辑并发布。
                  </p>
                </div>
                <div className="flex flex-wrap justify-center gap-2">
                  {quickReplies.map((reply) => (
                    <button
                      key={reply}
                      type="button"
                      onClick={() => handleQuickReply(reply)}
                      className="rounded-full border border-slate-200/60 bg-white px-4 py-2 text-sm text-slate-600 transition-colors hover:border-indigo-300 hover:text-indigo-600 hover:bg-indigo-50 dark:border-zinc-700/60 dark:bg-zinc-900 dark:text-zinc-400 dark:hover:border-indigo-700 dark:hover:text-indigo-400 dark:hover:bg-indigo-950/30"
                    >
                      {reply}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Chat messages */}
            {hasMessages && demoState === "idle" && (
              <div className="space-y-4">
                {messages.map((msg) => (
                  <div key={msg.id} className="flex gap-3">
                    {msg.role === "assistant" ? (
                      <div className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-xl bg-indigo-50 text-indigo-600 dark:bg-indigo-950/30 dark:text-indigo-400">
                        <Bot className="size-3.5" />
                      </div>
                    ) : (
                      <div className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-xl bg-slate-100 text-slate-500 dark:bg-zinc-800 dark:text-zinc-400">
                        <User className="size-3.5" />
                      </div>
                    )}
                    <div className="flex-1 space-y-2 min-w-0">
                      {(() => {
                        const rawText = (msg as any).content || msg.parts?.filter((p: any) => p.type === 'text').map((p: any) => p.text).join('') || ''
                        const displayText = msg.role === "assistant" ? renderBubbleContent(rawText) : rawText
                        return displayText ? (
                          <div className={cn(
                            "rounded-xl px-4 py-2.5 text-sm leading-relaxed",
                            msg.role === "assistant"
                              ? "bg-white text-slate-700 border border-slate-200/60 shadow-sm dark:bg-zinc-900 dark:text-zinc-300 dark:border-zinc-800/60"
                              : "bg-indigo-600 text-white shadow-sm",
                          )}>
                            <p className="whitespace-pre-wrap">{displayText}</p>
                          </div>
                        ) : null
                      })()}
                    </div>
                  </div>
                ))}

                {/* Published state */}
                {isComplete && (
                  <div className="flex flex-col items-center py-8 text-center">
                    <div className="flex h-14 w-14 items-center justify-center rounded-full bg-emerald-50 dark:bg-emerald-950/30">
                      <CheckCircle2 className="size-7 text-emerald-600" />
                    </div>
                    <h2 className="mt-3 text-lg font-bold text-slate-900 dark:text-zinc-100">需求已发布！</h2>
                    <p className="mt-0.5 text-sm text-slate-500 dark:text-zinc-500">ID: {publishedId}</p>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Input area (fixed bottom) */}
        <div className="border-t border-slate-200/60 bg-white px-6 py-4 dark:border-zinc-800/60 dark:bg-zinc-950">
          <form ref={formRef} onSubmit={handleFormSubmit} className="mx-auto flex max-w-2xl gap-3">
            <div className="relative flex-1">
              <textarea
                value={input}
                onChange={handleInputChange}
                onKeyDown={handleKeyDown}
                placeholder={isComplete ? "需求已发布！" : "描述您的需求，如：空调不制冷了，需要加氟..."}
                className="w-full rounded-xl border border-slate-200/60 bg-slate-50 px-4 py-3 pr-12 text-sm placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-500/50 resize-none dark:border-zinc-700/60 dark:bg-zinc-900 dark:text-zinc-100 dark:placeholder:text-zinc-500 dark:focus:ring-indigo-500/20"
                rows={1}
                disabled={isLoading || isComplete || demoState !== "idle"}
              />
              <div className="absolute bottom-1.5 right-1.5">
                <VoiceMicButton
                  onTranscript={(text) => setInput((prev) => prev + text)}
                />
              </div>
            </div>
            <div className="flex gap-2 self-end">
              <Button
                type="submit"
                size="icon"
                disabled={isLoading || !input.trim() || isComplete || demoState !== "idle"}
                className="h-11 w-11 rounded-xl bg-white text-slate-600 border border-slate-200/60 hover:bg-slate-50 hover:text-indigo-600 disabled:opacity-40 dark:border-zinc-700/60 dark:bg-zinc-900 dark:text-zinc-400 dark:hover:text-indigo-400"
                aria-label="发送消息"
              >
                {isLoading ? <Loader2 className="size-4 animate-spin" /> : <SendHorizonal className="size-4" />}
              </Button>
              <Button
                type="button"
                onClick={handleDemoStart}
                disabled={isLoading || !input.trim() || isComplete || demoState !== "idle"}
                className="h-11 rounded-xl bg-indigo-600 px-4 text-sm font-bold text-white shadow-sm hover:bg-indigo-700 disabled:opacity-40"
              >
                {demoState !== "idle" ? (
                  <Loader2 className="size-4 animate-spin mr-1.5" />
                ) : (
                  <Radio className="size-4 mr-1.5" />
                )}
                广播协议
              </Button>
            </div>
          </form>
        </div>
      </div>
    </div>
  )
}
