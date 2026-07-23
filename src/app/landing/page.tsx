"use client"

import { useState, useEffect, useRef } from "react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import toast from "react-hot-toast"
import { Loader2, Sparkles, CheckCircle2, ArrowRight, Camera, Upload } from "lucide-react"

const CATEGORIES = [
  { id: "c1", icon: "🛠", label: "管道疏通", desc: "下水道/马桶/地漏" },
  { id: "c2", icon: "⚡", label: "电路维修", desc: "跳闸/短路/更换开关" },
  { id: "c3", icon: "🔑", label: "门窗解锁", desc: "换锁/门禁/窗户" },
  { id: "c4", icon: "🧹", label: "清洁服务", desc: "深度保洁/开荒" },
  { id: "c5", icon: "📦", label: "搬运输送", desc: "搬家/大件配送" },
  { id: "c6", icon: "❄", label: "家电维修", desc: "空调/冰箱/热水器" },
]

const SEVERITY_LEVELS = [
  { value: 1, label: "轻微", color: "text-emerald-600", bar: "bg-emerald-500" },
  { value: 2, label: "一般", color: "text-amber-600", bar: "bg-amber-500" },
  { value: 3, label: "紧急", color: "text-orange-600", bar: "bg-orange-500" },
  { value: 4, label: "灾难性", color: "text-rose-600", bar: "bg-rose-500" },
]

const PLACEHOLDER_TEXTS = [
  "例如：我家厨房洗菜池反水，有异味...",
  "例如：空调不制冷了，需要加氟，在三里屯",
  "例如：晚上回家发现门锁坏了，进不去门",
]

export default function LandingPage() {
  const [text, setText] = useState("")
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null)
  const [severity, setSeverity] = useState(2)
  const [generating, setGenerating] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [result, setResult] = useState<any>(null)
  const [editing, setEditing] = useState(false)
  const [editedFields, setEditedFields] = useState<Record<string, unknown>>({})
  const [mediaFiles, setMediaFiles] = useState<Array<{ id: string; name: string; progress: number }>>([])
  const [placeholderIdx, setPlaceholderIdx] = useState(0)
  const inputRef = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    const interval = setInterval(() => {
      setPlaceholderIdx((i) => (i + 1) % PLACEHOLDER_TEXTS.length)
    }, 4000)
    return () => clearInterval(interval)
  }, [])

  const handleGenerate = async () => {
    if (!text.trim()) return
    setGenerating(true)
    setResult(null)
    try {
      const res = await fetch("/api/protocols/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: text.trim(), category: selectedCategory }),
      })
      if (!res.ok) throw new Error((await res.json()).error)
      const data = await res.json()
      setResult(data)
      setEditedFields(data.protocol_json)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "协议生成失败，请重试")
    } finally {
      setGenerating(false)
    }
  }

  const handleSubmitDemand = async () => {
    if (!result) return
    setSubmitting(true)
    try {
      await fetch("/api/demands", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: `${result.title}：${result.description}` }),
      })
      setResult(null)
      setText("")
    } catch {
      toast.error("发布需求失败，请重试")
    } finally {
      setSubmitting(false)
    }
  }

  const handleMediaAdd = () => {
    const id = `media_${Date.now()}`
    setMediaFiles((prev) => [...prev, { id, name: "正在上传...", progress: 0 }])
    let progress = 0
    const interval = setInterval(() => {
      progress += Math.floor(Math.random() * 25) + 5
      if (progress >= 100) {
        clearInterval(interval)
        setMediaFiles((prev) =>
          prev.map((m) => (m.id === id ? { ...m, name: "photo.jpg", progress: 100 } : m)),
        )
      } else {
        setMediaFiles((prev) =>
          prev.map((m) => (m.id === id ? { ...m, progress } : m)),
        )
      }
    }, 300)
  }

  const severityColor = SEVERITY_LEVELS[severity - 1]?.color ?? "text-emerald-600"

  return (
    <div className="mx-auto max-w-lg px-4 py-10">
      {/* Header */}
      <div className="mb-8 text-center">
        <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-2xl bg-indigo-600 shadow-sm">
          <Sparkles className="size-7 text-white" />
        </div>
        <h1 className="text-2xl font-bold text-slate-900 dark:text-zinc-100">智能诊断舱</h1>
        <p className="mt-1 text-sm text-slate-500 dark:text-zinc-500">描述故障，AI 自动诊断并生成服务协议</p>
      </div>

      {/* ═══ AI Input Area ═══ */}
      <div
        className={cn(
          "relative mb-6 rounded-2xl border-2 border-dashed bg-white p-6 shadow-sm transition-all dark:bg-zinc-900",
          text.trim()
            ? "border-indigo-500/50 dark:border-indigo-400/40"
            : "border-slate-200 dark:border-zinc-800",
          "focus-within:border-indigo-600 dark:focus-within:border-indigo-400",
        )}
      >
        <textarea
          ref={inputRef}
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder={PLACEHOLDER_TEXTS[placeholderIdx]}
          rows={4}
          className="w-full resize-none bg-transparent text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none dark:text-zinc-100 dark:placeholder:text-zinc-500"
        />
        <div className="mt-3 flex items-center justify-between">
          <div className="flex items-center gap-1.5 rounded-full bg-indigo-50 px-3 py-1 dark:bg-indigo-950/30">
            <Sparkles className={cn("size-3 text-indigo-600 dark:text-indigo-400", generating && "animate-spin")} />
            <span className="text-[10px] font-medium text-indigo-600 dark:text-indigo-400">
              {generating ? "AI 智能解析中..." : "✨ AI 就绪"}
            </span>
          </div>
          <span className="text-[10px] text-slate-400 dark:text-zinc-500">{text.length} 字</span>
        </div>
      </div>

      {/* ═══ Category Cards ═══ */}
      <div className="mb-6">
        <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-slate-400 dark:text-zinc-500">选择故障分类</p>
        <div className="grid grid-cols-3 gap-3">
          {CATEGORIES.map((cat) => {
            const isSelected = selectedCategory === cat.id
            return (
              <button
                key={cat.id}
                type="button"
                onClick={() => setSelectedCategory(cat.id)}
                className={cn(
                  "rounded-xl border px-3 py-3 text-center transition-all",
                  isSelected
                    ? "border-indigo-600 bg-indigo-50 dark:border-indigo-400 dark:bg-indigo-950/40"
                    : "border-slate-200/60 bg-white dark:border-zinc-800/60 dark:bg-zinc-900 hover:border-slate-300 dark:hover:border-zinc-700",
                )}
              >
                <span className="text-xl">{cat.icon}</span>
                <p
                  className={cn(
                    "mt-1 text-xs font-semibold",
                    isSelected ? "text-indigo-600 dark:text-indigo-400" : "text-slate-700 dark:text-zinc-300",
                  )}
                >
                  {cat.label}
                </p>
              </button>
            )
          })}
        </div>
      </div>

      {/* ═══ Severity Slider ═══ */}
      <div className="mb-6 rounded-2xl border border-slate-200/60 bg-white p-5 dark:border-zinc-800/60 dark:bg-zinc-900">
        <div className="flex items-center justify-between mb-4">
          <p className="text-xs font-semibold uppercase tracking-wider text-slate-400 dark:text-zinc-500">严重程度</p>
          <span className={cn("text-sm font-bold", severityColor)}>{SEVERITY_LEVELS[severity - 1].label}</span>
        </div>
        <div className="relative flex h-8 items-center">
          {SEVERITY_LEVELS.map((level, i) => {
            const pos = (i / (SEVERITY_LEVELS.length - 1)) * 100
            const isActive = severity >= level.value
            return (
              <button
                key={level.value}
                type="button"
                onClick={() => setSeverity(level.value)}
                className="absolute flex h-4 w-4 -translate-x-1/2 cursor-pointer items-center justify-center rounded-full transition-all hover:scale-125"
                style={{ left: `${pos}%` }}
              >
                <div
                  className={cn(
                    "h-4 w-4 rounded-full border-2 transition-all",
                    isActive
                      ? `${level.bar} border-transparent scale-125`
                      : "border-slate-300 bg-white dark:border-zinc-600 dark:bg-zinc-800",
                  )}
                />
              </button>
            )
          })}
          {/* Track background */}
          <div className="absolute left-0 right-0 top-1/2 h-1.5 -translate-y-1/2 rounded-full bg-slate-100 dark:bg-zinc-800">
            <div
              className="h-full rounded-full bg-gradient-to-r from-emerald-500 via-amber-500 to-rose-500 transition-all"
              style={{ width: `${((severity - 1) / (SEVERITY_LEVELS.length - 1)) * 100}%` }}
            />
          </div>
        </div>
        <div className="mt-2 flex justify-between px-0.5">
          {SEVERITY_LEVELS.map((level) => (
            <span
              key={level.value}
              className={cn(
                "text-[10px]",
                severity === level.value ? level.color : "text-slate-400 dark:text-zinc-600",
              )}
            >
              {level.label}
            </span>
          ))}
        </div>
      </div>

      {/* ═══ Media Upload ═══ */}
      <div className="mb-6">
        <div className="flex items-center justify-between mb-3">
          <p className="text-xs font-semibold uppercase tracking-wider text-slate-400 dark:text-zinc-500">现场资料</p>
          <button
            type="button"
            onClick={handleMediaAdd}
            className="flex items-center gap-1 rounded-full bg-indigo-50 px-3 py-1.5 text-xs font-medium text-indigo-600 dark:bg-indigo-950/30 dark:text-indigo-400"
          >
            <Camera className="size-3" />
            添加照片
          </button>
        </div>
        <div className="flex gap-3 overflow-x-auto pb-2">
          {mediaFiles.map((file) => (
            <div
              key={file.id}
              className="flex h-24 w-24 shrink-0 flex-col items-center justify-center rounded-xl border border-slate-200/60 bg-slate-50 dark:border-zinc-800/60 dark:bg-zinc-900"
            >
              {file.progress < 100 ? (
                <>
                  <Upload className="size-5 text-slate-400 mb-1" />
                  <div className="h-1 w-12 overflow-hidden rounded-full bg-slate-200 dark:bg-zinc-700">
                    <div
                      className="h-full rounded-full bg-indigo-500 transition-all"
                      style={{ width: `${file.progress}%` }}
                    />
                  </div>
                  <span className="mt-1 text-[9px] text-slate-400">{file.progress}%</span>
                </>
              ) : (
                <>
                  <span className="text-xl">📷</span>
                  <span className="mt-1 text-[9px] text-slate-400">已上传</span>
                </>
              )}
            </div>
          ))}
          {mediaFiles.length === 0 && (
            <div className="flex h-24 w-24 shrink-0 items-center justify-center rounded-xl border-2 border-dashed border-slate-200 dark:border-zinc-700">
              <Camera className="size-5 text-slate-300 dark:text-zinc-600" />
            </div>
          )}
        </div>
      </div>

      {/* ═══ Generate Button ═══ */}
      <Button
        className="w-full rounded-xl py-6 text-base"
        onClick={handleGenerate}
        disabled={generating || !text.trim()}
      >
        {generating ? (
          <><Loader2 className="mr-2 size-4 animate-spin" />AI 诊断中...</>
        ) : (
          <><Sparkles className="mr-2 size-4" />AI 诊断并生成协议</>
        )}
      </Button>

      {/* ═══ Result ═══ */}
      {result && (
        <div className="mt-8 space-y-4">
          <div className="rounded-2xl border border-slate-200/60 bg-white p-5 dark:border-zinc-800/60 dark:bg-zinc-900">
            <div className="flex items-center gap-2 mb-3">
              <CheckCircle2 className="size-5 text-emerald-500" />
              <h2 className="text-lg font-bold text-slate-900 dark:text-zinc-100">{result.title}</h2>
              <Badge
                variant={result.risk_tier === "high" ? "destructive" : result.risk_tier === "medium" ? "default" : "secondary"}
                className="ml-auto"
              >
                {result.risk_tier === "high" ? "高风险" : result.risk_tier === "medium" ? "中风险" : "低风险"}
              </Badge>
            </div>
            <p className="text-sm text-slate-500 dark:text-zinc-400 mb-4">{result.description}</p>
            <div className="flex flex-wrap gap-2">
              {result.category && (
                <Badge variant="outline" className="border-slate-200">{result.category}</Badge>
              )}
              {result.title && (
                <Badge variant="outline" className="border-slate-200">{result.title}</Badge>
              )}
            </div>
          </div>

          <div className="flex gap-3">
            <Button
              variant="outline"
              className="flex-1 rounded-xl"
              onClick={() => setEditing(!editing)}
            >
              {editing ? "完成编辑" : "编辑协议"}
            </Button>
            <Button
              className="flex-1 rounded-xl"
              onClick={handleSubmitDemand}
              disabled={submitting}
            >
              {submitting ? (
                <><Loader2 className="mr-2 size-4 animate-spin" />发布中...</>
              ) : (
                <><ArrowRight className="mr-2 size-4" />发布并匹配</>
              )}
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}
