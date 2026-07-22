"use client"

import { PriceSlider } from "@/components/PriceSlider"
import { MediaPicker } from "@/components/MediaPicker"
import { ClassifyDemandResult, GenerateProtocolResult, CreateDemandResult, ToolSkeleton, FallbackComponent } from "@/lib/chat-component-registry"
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { useState } from "react"
import { MessageSquare, FileText, Zap } from "lucide-react"

export default function DemoPage() {
  const [price, setPrice] = useState(180)

  const protocolResult = {
    schema_json: {
      core_fields: {
        address: { type: "geo", label: "服务地址", required: true },
        scheduled_at: { type: "datetime", label: "期望时间", required: true },
      },
      category_fields: {},
    },
    protocol_json: { address: "朝阳区三里屯SOHO", scheduled_at: "2026-07-10T14:00" },
    risk_tier: "low",
    category: "家政",
    title: "空调加氟",
    description: "空调不制冷了",
  }

  return (
    <div className="min-h-screen bg-slate-50 px-4 py-10 dark:bg-zinc-950">
      <div className="mx-auto max-w-5xl space-y-10">
      <div>
        <h1 className="text-2xl font-bold text-slate-900 dark:text-zinc-100">deal-protocol 组件画廊</h1>
        <p className="text-slate-500 dark:text-zinc-500 text-sm">所有 Generative UI 原子组件一览</p>
      </div>

      {/* Layout concept */}
      <Card className="border-indigo-500/20 rounded-2xl border-slate-200/60 dark:border-zinc-800/60 dark:bg-zinc-900">
        <CardHeader>
          <div className="flex items-center gap-2">
            <div className="flex h-6 w-6 items-center justify-center rounded-md bg-indigo-100 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-400">
              <Zap className="size-3.5" />
            </div>
            <CardTitle className="text-sm">布局概念：分栏模式 (v0/Bolt 风格)</CardTitle>
          </div>
          <CardDescription>左聊天 + 右协议实时生长，AI 协作起草，用户编辑发布</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="overflow-hidden rounded-xl border border-border/60">
            <div className="flex h-56">
              <div className="w-[35%] border-r border-border/60 bg-slate-100 dark:bg-zinc-800/20 p-3">
                <div className="mb-2 flex items-center gap-1.5">
                  <div className="h-2 w-2 rounded-full bg-indigo-500" />
                  <span className="text-[10px] font-medium text-slate-500 dark:text-zinc-500">AI 协议助手</span>
                  <Badge variant="outline" className="ml-auto text-[8px] px-1 py-0">在线</Badge>
                </div>
                <div className="space-y-2">
                  <div className="flex gap-1.5">
                    <div className="mt-0.5 h-4 w-4 shrink-0 rounded-full bg-slate-100 dark:bg-zinc-800" />
                    <div className="rounded-lg bg-slate-100 dark:bg-zinc-800/50 p-1.5 flex-1">
                      <p className="text-[10px] text-slate-900 dark:text-zinc-100">空调不制冷了，需要加氟</p>
                    </div>
                  </div>
                  <div className="flex gap-1.5">
                    <div className="mt-0.5 h-4 w-4 shrink-0 rounded-full bg-indigo-200" />
                    <div className="rounded-lg bg-indigo-100 p-1.5 flex-1 dark:bg-indigo-900/30">
                      <p className="text-[10px] text-indigo-700 dark:text-indigo-400">已识别需求，正在生成协议...</p>
                    </div>
                  </div>
                  <div className="mt-1.5 flex gap-1">
                    {["空调加氟多少钱", "上门时间"].map((t) => (
                      <span key={t} className="rounded-full border border-border/50 bg-background px-1.5 py-0.5 text-[8px] text-slate-500 dark:text-zinc-500">{t}</span>
                    ))}
                  </div>
                </div>
              </div>
              <div className="flex-1 p-3">
                <div className="mb-2 flex items-center gap-1.5">
                  <div className="h-2 w-2 rounded-full bg-emerald-500" />
                  <span className="text-[10px] font-medium text-slate-500 dark:text-zinc-500">智能协议预览</span>
                  <span className="ml-auto rounded bg-emerald-100 px-1.5 py-0.5 text-[8px] font-medium text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400">低风险 · 信用担保</span>
                </div>
                <div className="space-y-1.5">
                  <div className="rounded-lg border border-border/40 bg-card p-2">
                    <div className="flex justify-between text-[10px]"><span className="text-slate-500 dark:text-zinc-500">品类</span><span>家电维修</span></div>
                    <div className="flex justify-between text-[10px] mt-0.5"><span className="text-slate-500 dark:text-zinc-500">预估</span><span>¥80-150</span></div>
                    <div className="flex justify-between text-[10px] mt-0.5"><span className="text-slate-500 dark:text-zinc-500">地址</span><span>朝阳区建国路</span></div>
                    <div className="flex justify-between text-[10px] mt-0.5"><span className="text-slate-500 dark:text-zinc-500">时间</span><span>今天下午</span></div>
                  </div>
                  <div className="h-5 rounded bg-slate-100 dark:bg-zinc-800/50" />
                  <div className="h-5 rounded bg-slate-100 dark:bg-zinc-800/50" />
                  <div className="mt-2 rounded bg-indigo-600 p-1 text-center text-[10px] font-medium text-white">全网发布</div>
                </div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Atomic components */}
      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">PriceSlider · 价格滑块</CardTitle>
            <CardDescription>AI 建议区间 150-220 以绿色高亮</CardDescription>
          </CardHeader>
          <CardContent>
            <PriceSlider value={price} onChange={setPrice} min={0} max={500} step={10} suggestedMin={150} suggestedMax={220} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-sm">MediaPicker · 媒体上传</CardTitle>
            <CardDescription>虚线占位，点击拍照/选图</CardDescription>
          </CardHeader>
          <CardContent>
            <MediaPicker value={[]} onChange={() => {}} />
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-sm">ClassifyDemandResult · 需求理解卡片</CardTitle>
        </CardHeader>
        <CardContent>
          <ClassifyDemandResult result={{ title: "空调加氟", description: "空调不制冷了，需要加氟", category: "维修", budgetMin: 80, budgetMax: 150, urgency: "high", address: "朝阳区建国路" }} />
        </CardContent>
      </Card>

      <GenerateProtocolResult result={protocolResult} />

      <Card>
        <CardHeader>
          <CardTitle className="text-sm">CreateDemandResult · 发布成功</CardTitle>
        </CardHeader>
        <CardContent>
          <CreateDemandResult result={{ demandId: "123", message: "需求发布成功！" }} />
        </CardContent>
      </Card>

      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">ToolSkeleton · 加载状态</CardTitle>
          </CardHeader>
          <CardContent>
            <ToolSkeleton name="classifyDemand" />
            <div className="mt-2"><ToolSkeleton name="generateProtocol" /></div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">FallbackComponent · 未知工具降级</CardTitle>
          </CardHeader>
          <CardContent>
            <FallbackComponent name="unknown_tool" />
          </CardContent>
        </Card>
      </div>
      </div>
    </div>
  )
}
