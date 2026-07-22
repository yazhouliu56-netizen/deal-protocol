"use client"

import { useState, useMemo, useEffect } from "react"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { MediaPicker } from "@/components/MediaPicker"
import { PriceSlider } from "@/components/PriceSlider"
import { cn } from "@/lib/utils"
import {
  Shield, Sparkles, CheckCircle2, ArrowRight,
  Clock, MapPin, AlertCircle, Loader2, Camera,
  Crown,
} from "lucide-react"

interface SchemaField {
  type: string
  label: string
  required?: boolean
  min?: number
  max?: number
  options?: string[]
  items?: { type: string }
}

interface SchemaDefinition {
  core_fields?: Record<string, SchemaField>
  category_fields?: Record<string, SchemaField>
}

interface CreditInfo {
  score: number
  level: string
}

interface SmartProtocolCardProps {
  title: string
  description: string
  category: string
  riskTier: "low" | "medium" | "high"
  budgetMin?: number
  budgetMax?: number
  urgency?: string
  address?: string
  schema: SchemaDefinition
  protocolFields: Record<string, unknown>
  onProtocolFieldsChange: (fields: Record<string, unknown>) => void
  price: number
  onPriceChange: (price: number) => void
  media: Array<{ url: string; name: string; type: "image" | "video" }>
  onMediaChange: (media: Array<{ url: string; name: string; type: "image" | "video" }>) => void
  onPublish: () => void
  publishing?: boolean
  publishedId?: string | null
  onAdjust?: () => void
  creditInfo?: CreditInfo
  suggestedMin?: number
  suggestedMax?: number
  mode?: "edit" | "view"
}

function FieldRenderer({
  field, value, onChange, id, missing,
}: {
  field: SchemaField
  value: unknown
  onChange: (v: unknown) => void
  id: string
  missing?: boolean
}) {
  const pulseClass = missing
    ? "animate-[breathing_2s_ease-in-out_infinite] ring-2 ring-indigo-400/30 shadow-lg shadow-indigo-500/10"
    : ""

  if (field.type === "enum" && field.options) {
    return (
      <div className={cn(
        "rounded-lg border border-slate-200/60 p-3 transition-all dark:border-zinc-800/60",
        missing && "border-indigo-300/60 bg-indigo-50/30 dark:border-indigo-700/30 dark:bg-indigo-950/10",
      )}>
        <label htmlFor={id} className="mb-2 flex items-center gap-1.5 text-sm font-medium text-slate-700 dark:text-zinc-300">
          {field.label}
          {field.required && <span className="text-red-500">*</span>}
          {missing && (
            <span className="inline-flex items-center gap-1 rounded-full bg-indigo-100 px-2 py-0.5 text-[10px] text-indigo-600 animate-pulse dark:bg-indigo-900/30 dark:text-indigo-400">
              点击补充
            </span>
          )}
        </label>
        <div className="flex flex-wrap gap-2">
              {field.options.map((opt) => (
                <button
                  key={opt}
                  type="button"
                  onClick={() => onChange(opt)}
                  className={cn(
                    "touch-target inline-flex items-center justify-center rounded-full px-4 py-2 text-xs font-medium transition-all active:scale-95",
                    value === opt
                      ? "bg-indigo-600 text-white shadow-sm"
                      : "bg-slate-100 text-slate-600 hover:bg-indigo-50 hover:text-indigo-600 dark:bg-zinc-800 dark:text-zinc-400 dark:hover:bg-indigo-950/30 dark:hover:text-indigo-400",
                  )}
                >
                  {opt}
                </button>
              ))}
        </div>
      </div>
    )
  }

  if (field.type === "text") {
    return (
      <div className={cn(
        "rounded-lg border border-slate-200/60 p-3 dark:border-zinc-800/60",
        missing && "border-indigo-300/60 bg-indigo-50/30",
      )}>
        <label htmlFor={id} className="mb-1.5 flex items-center gap-1.5 text-sm font-medium text-slate-700 dark:text-zinc-300">
          {field.label}
          {field.required && <span className="text-red-500">*</span>}
          {missing && (
            <span className="inline-flex items-center gap-1 rounded-full bg-indigo-100 px-2 py-0.5 text-[10px] text-indigo-600 animate-pulse dark:bg-indigo-900/30 dark:text-indigo-400">
              填写描述
            </span>
          )}
        </label>
        <Textarea
          id={id}
          value={(value as string) ?? ""}
          onChange={(e) => onChange(e.target.value)}
          className={cn("min-h-[60px] resize-none text-sm", pulseClass)}
          placeholder={`输入${field.label}`}
        />
      </div>
    )
  }

  if (field.type === "geo") {
    return (
      <div className={cn(
        "rounded-lg border border-slate-200/60 p-3 dark:border-zinc-800/60",
        missing && "border-indigo-300/60 bg-indigo-50/30",
      )}>
        <label htmlFor={id} className="mb-1.5 flex items-center gap-1.5 text-sm font-medium text-slate-700 dark:text-zinc-300">
          <MapPin className="size-3.5 text-slate-400" />
          {field.label}
          {field.required && <span className="text-red-500">*</span>}
          {missing && (
            <span className="inline-flex items-center gap-1 rounded-full bg-indigo-100 px-2 py-0.5 text-[10px] text-indigo-600 animate-pulse dark:bg-indigo-900/30 dark:text-indigo-400">
              填写地址
            </span>
          )}
        </label>
        <Input
          id={id}
          value={(value as string) ?? ""}
          onChange={(e) => onChange(e.target.value)}
          className={cn("text-sm", pulseClass)}
          placeholder="输入地址"
        />
      </div>
    )
  }

  if (field.type === "datetime") {
    return (
      <div className={cn(
        "rounded-lg border border-slate-200/60 p-3 dark:border-zinc-800/60",
        missing && "border-indigo-300/60 bg-indigo-50/30",
      )}>
        <label htmlFor={id} className="mb-1.5 flex items-center gap-1.5 text-sm font-medium text-slate-700 dark:text-zinc-300">
          <Clock className="size-3.5 text-slate-400" />
          {field.label}
          {field.required && <span className="text-red-500">*</span>}
          {missing && (
            <span className="inline-flex items-center gap-1 rounded-full bg-indigo-100 px-2 py-0.5 text-[10px] text-indigo-600 animate-pulse dark:bg-indigo-900/30 dark:text-indigo-400">
              选择时间
            </span>
          )}
        </label>
        <Input
          id={id}
          type="datetime-local"
          value={(value as string) ?? ""}
          onChange={(e) => onChange(e.target.value)}
          className={cn("text-sm", pulseClass)}
        />
      </div>
    )
  }

  if (field.type === "boolean") {
    return (
      <div className={cn(
        "rounded-lg border border-slate-200/60 p-3 dark:border-zinc-800/60",
        missing && "border-indigo-300/60 bg-indigo-50/30",
      )}>
        <label className="flex cursor-pointer items-center gap-3">
          <input
            id={id}
            type="checkbox"
            checked={!!value}
            onChange={(e) => onChange(e.target.checked)}
            className="h-4 w-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500/30 dark:border-zinc-600"
          />
          <span className="flex items-center gap-1.5 text-sm font-medium text-slate-700 dark:text-zinc-300">
            {field.label}
            {field.required && <span className="text-red-500">*</span>}
            {missing && (
              <span className="inline-flex items-center gap-1 rounded-full bg-indigo-100 px-2 py-0.5 text-[10px] text-indigo-600 animate-pulse dark:bg-indigo-900/30 dark:text-indigo-400">
                请确认
              </span>
            )}
          </span>
        </label>
      </div>
    )
  }

  if (field.type === "int_array" || field.type === "number") {
    return (
      <div className={cn(
        "rounded-lg border border-slate-200/60 p-3 dark:border-zinc-800/60",
        missing && "border-indigo-300/60 bg-indigo-50/30",
      )}>
        <label htmlFor={id} className="mb-1.5 flex items-center gap-1.5 text-sm font-medium text-slate-700 dark:text-zinc-300">
          {field.label}
          {field.required && <span className="text-red-500">*</span>}
          {missing && (
            <span className="inline-flex items-center gap-1 rounded-full bg-indigo-100 px-2 py-0.5 text-[10px] text-indigo-600 animate-pulse dark:bg-indigo-900/30 dark:text-indigo-400">
              输入数值
            </span>
          )}
        </label>
        <Input
          id={id}
          type="number"
          value={(value as number) ?? ""}
          onChange={(e) => onChange(Number(e.target.value))}
          className={cn("text-sm", pulseClass)}
          min={field.min}
          max={field.max}
          placeholder={`${field.min ?? 0} - ${field.max ?? 999}`}
        />
      </div>
    )
  }

  return (
    <div className={cn(
      "rounded-lg border border-slate-200/60 p-3 dark:border-zinc-800/60",
      missing && "border-indigo-300/60 bg-indigo-50/30",
    )}>
      <label htmlFor={id} className="mb-1.5 flex items-center gap-1.5 text-sm font-medium text-slate-700 dark:text-zinc-300">
        {field.label}
        {field.required && <span className="text-red-500">*</span>}
        {missing && (
          <span className="inline-flex items-center gap-1 rounded-full bg-indigo-100 px-2 py-0.5 text-[10px] text-indigo-600 animate-pulse dark:bg-indigo-900/30 dark:text-indigo-400">
            填写
          </span>
        )}
      </label>
      <Input
        id={id}
        value={(value as string) ?? ""}
        onChange={(e) => onChange(e.target.value)}
        className={cn("text-sm", pulseClass)}
        placeholder={`输入${field.label}`}
      />
    </div>
  )
}

export default function SmartProtocolCard({
  title, description, category, riskTier,
  budgetMin, budgetMax, urgency, address,
  schema, protocolFields, onProtocolFieldsChange,
  price, onPriceChange,
  media, onMediaChange,
  onPublish, publishing, publishedId, onAdjust,
  creditInfo,
  suggestedMin, suggestedMax,
  mode = "edit",
}: SmartProtocolCardProps) {
  const [showMedia, setShowMedia] = useState(false)

  const isView = mode === "view"

  const allFields: [string, SchemaField][] = useMemo(() => [
    ...Object.entries(schema.core_fields ?? {}),
    ...Object.entries(schema.category_fields ?? {}),
  ], [schema])

  const missingRequired = useMemo(() => {
    return allFields.filter(([key, field]) => field.required && !protocolFields[key])
  }, [allFields, protocolFields])

  const updateField = (key: string, val: unknown) => {
    onProtocolFieldsChange({ ...protocolFields, [key]: val })
  }

  if (publishedId) {
    return (
      <div className="rounded-2xl border border-emerald-200/60 bg-white shadow-sm dark:border-emerald-800/60 dark:bg-zinc-900">
        <div className="flex flex-col items-center px-6 py-10 text-center">
          <div className="flex h-16 w-16 items-center justify-center rounded-full bg-emerald-50 dark:bg-emerald-950/30">
            <CheckCircle2 className="size-8 text-emerald-600" />
          </div>
          <h3 className="mt-4 text-lg font-bold text-slate-900 dark:text-zinc-100">需求已发布！</h3>
          <p className="mt-1 text-sm text-slate-500 dark:text-zinc-500">
            协议 ID: <code className="rounded bg-slate-100 px-2 py-0.5 font-mono text-xs dark:bg-zinc-800">{publishedId}</code>
          </p>
          <p className="mt-0.5 text-xs text-slate-400">服务者将主动联系您</p>
        </div>
      </div>
    )
  }

  return (
    <div className="rounded-2xl border border-slate-200/60 bg-white shadow-sm transition-shadow hover:shadow-md dark:border-zinc-800/60 dark:bg-zinc-900">
      {/* ── Header ── */}
      <div className="border-b border-slate-200/60 px-5 py-4 dark:border-zinc-800/60">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <span className="flex h-6 w-6 items-center justify-center rounded-lg bg-indigo-50 dark:bg-indigo-950/30">
                <Sparkles className="size-3.5 text-indigo-600 dark:text-indigo-400" />
              </span>
              <span className="text-xs font-semibold uppercase tracking-wider text-indigo-600 dark:text-indigo-400">AI 协议预览</span>
              <Badge variant="secondary" className="px-2 py-0 text-[10px]">{category}</Badge>
            </div>
            <h3 className="mt-2 text-base font-bold leading-tight text-slate-900 dark:text-zinc-100">{title}</h3>
            <p className="mt-0.5 text-sm text-slate-500 dark:text-zinc-500">{description}</p>
          </div>

          <div className="flex shrink-0 flex-col items-end gap-2">
            {/* ── Credit Badge ── */}
            {creditInfo && (
              <div className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700 dark:bg-emerald-950/30 dark:text-emerald-400">
                <Crown className="size-3.5" />
                <span>{creditInfo.level}</span>
                <span className="text-emerald-400">|</span>
                <span className="tabular-nums">{creditInfo.score}分</span>
              </div>
            )}

            {/* ── Risk Badge ── */}
            <Badge
              className={cn(
                "border-0 px-3 py-1 text-xs",
                riskTier === "high"
                  ? "bg-rose-50 text-rose-700 dark:bg-rose-950/30 dark:text-rose-400"
                  : riskTier === "medium"
                  ? "bg-amber-50 text-amber-700 dark:bg-amber-950/30 dark:text-amber-400"
                  : "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/30 dark:text-emerald-400",
              )}
            >
              <Shield className="mr-1 inline-block size-3" />
              {riskTier === "high" ? "高风险 · 押金担保" : riskTier === "medium" ? "中风险 · 信用担保" : "低风险 · 信用担保"}
            </Badge>
          </div>
        </div>

        {(budgetMin != null || budgetMax != null || urgency || address) && (
          <div className="mt-3 flex flex-wrap gap-2 text-xs text-slate-500 dark:text-zinc-500">
            {budgetMin != null && (
              <span className="inline-flex items-center gap-1 rounded-md bg-slate-100 px-2 py-1 dark:bg-zinc-800">
                ¥{budgetMin}{budgetMax ? `-${budgetMax}` : ""}
              </span>
            )}
            {urgency && (
              <span className="inline-flex items-center gap-1 rounded-md bg-slate-100 px-2 py-1 dark:bg-zinc-800">
                <Clock className="size-3" />
                {urgency === "high" ? "紧急" : urgency === "medium" ? "适中" : "不着急"}
              </span>
            )}
            {address && (
              <span className="inline-flex items-center gap-1 rounded-md bg-slate-100 px-2 py-1 dark:bg-zinc-800">
                <MapPin className="size-3" />
                {address}
              </span>
            )}
          </div>
        )}
      </div>

      {/* ── Body ── */}
      <div className="space-y-4 px-5 py-4">
        {/* Missing required fields reminder */}
        {!isView && missingRequired.length > 0 && (
          <div className="flex items-center gap-2 rounded-xl bg-indigo-50 px-4 py-3 text-sm text-indigo-700 dark:bg-indigo-950/20 dark:text-indigo-400">
            <AlertCircle className="size-4 shrink-0" />
            <span>请完善以下 <strong>{missingRequired.length}</strong> 个必填项：{missingRequired.map(([k]) => k).join("、")}</span>
          </div>
        )}

        {/* Protocol fields */}
        {allFields.length > 0 && (
          <div className="space-y-3">
            <p className="text-xs font-semibold uppercase tracking-wider text-slate-400 dark:text-zinc-500">协议内容</p>
            {allFields.map(([key, field]) => {
              const isMissing = !isView && field.required && !protocolFields[key]
              return (
                <div key={key} className={cn(isMissing && "animate-[breathing_2s_ease-in-out_infinite]")}>
                  <FieldRenderer
                    field={field}
                    value={protocolFields[key]}
                    onChange={(v) => updateField(key, v)}
                    id={`proto-${key}`}
                    missing={isMissing}
                  />
                </div>
              )
            })}
          </div>
        )}

        {/* AI Price Slider (edit mode only) */}
        {!isView && (
          <div className="space-y-2">
            <p className="text-xs font-semibold uppercase tracking-wider text-slate-400 dark:text-zinc-500">服务价格</p>
            <div className="rounded-xl border border-slate-200/60 bg-white p-4 dark:border-zinc-800/60 dark:bg-zinc-900/50">
              <PriceSlider
                value={price}
                onChange={onPriceChange}
                min={0}
                max={2000}
                step={10}
                suggestedMin={suggestedMin ?? budgetMin ?? undefined}
                suggestedMax={suggestedMax ?? budgetMax ?? undefined}
              />
            </div>
          </div>
        )}

        {/* Media upload (edit mode only) */}
        {!isView && (
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <p className="text-xs font-semibold uppercase tracking-wider text-slate-400 dark:text-zinc-500">现场照片 / 视频</p>
              <button
                type="button"
                onClick={() => setShowMedia(!showMedia)}
                className="flex items-center gap-1 text-xs text-indigo-600 transition-colors hover:text-indigo-700 dark:text-indigo-400"
              >
                <Camera className="size-3.5" />
                {media.length > 0 ? `已选 ${media.length} 个` : "添加"}
              </button>
            </div>
            {showMedia && (
              <div className="rounded-xl border border-slate-200/60 bg-white p-4 dark:border-zinc-800/60 dark:bg-zinc-900/50">
                <MediaPicker value={media} onChange={onMediaChange} />
              </div>
            )}
          </div>
        )}

        {/* View mode: display static price */}
        {isView && (
          <div className="space-y-2">
            <p className="text-xs font-semibold uppercase tracking-wider text-slate-400 dark:text-zinc-500">服务价格</p>
            <div className="rounded-xl border border-slate-200/60 bg-slate-50 px-4 py-3 dark:border-zinc-800/60 dark:bg-zinc-900/50">
              <span className="text-2xl font-bold tabular-nums text-slate-900 dark:text-zinc-100">¥{price.toLocaleString()}</span>
              {suggestedMin != null && suggestedMax != null && (
                <span className="ml-3 text-xs text-emerald-600 dark:text-emerald-400">
                  AI 建议区间 ¥{suggestedMin} - ¥{suggestedMax}
                </span>
              )}
            </div>
          </div>
        )}

        {/* Risk tier note */}
        {riskTier === "high" && (
          <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 dark:border-rose-900/30 dark:bg-rose-950/20">
            <p className="text-xs font-medium text-rose-700 dark:text-rose-400">
              <AlertCircle className="mr-1 inline-block size-3.5" />
              高风险协议：建议在协议中包含押金担保条款，并核实服务方身份后再付款。
            </p>
          </div>
        )}
      </div>

      {/* ── Footer CTA (edit mode only) ── */}
      {!isView && (
        <div className="border-t border-slate-200/60 px-5 py-4 dark:border-zinc-800/60">
          <div className="flex gap-3">
            <button
              type="button"
              onClick={onPublish}
              disabled={publishing}
              className="touch-target flex flex-1 items-center justify-center gap-2 rounded-xl bg-indigo-600 px-5 py-3 text-sm font-bold text-white shadow-sm transition-all hover:scale-[1.01] hover:bg-indigo-700 active:scale-[0.97] disabled:opacity-60 disabled:hover:scale-100"
            >
              {publishing ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <ArrowRight className="size-4" />
              )}
              {publishing ? "全网发布中..." : "确认并全网发布"}
            </button>
            {onAdjust && (
              <button
                type="button"
                onClick={onAdjust}
                disabled={publishing}
                className="touch-target flex items-center justify-center gap-2 rounded-xl border border-slate-200/60 px-5 py-3 text-sm font-medium text-slate-600 transition-all hover:bg-slate-50 active:scale-[0.97] dark:border-zinc-700/60 dark:text-zinc-400 dark:hover:bg-zinc-800"
              >
                再调整
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
