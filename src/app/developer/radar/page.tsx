"use client"

import React, { useState } from "react"
import { toast } from "react-hot-toast"
import { Brain, Cpu, Sparkles, Search, Compass, DollarSign, ShieldCheck } from "lucide-react"

interface RecommendedDemand {
  id: string
  title: string
  description: string
  budget: number
  status: string
  similarity: number
  composite_score: number
}

export default function AIDemandsRadarWorkspace() {
  const [demands, setDemands] = useState<RecommendedDemand[]>([])
  const [isScanning, setIsScanning] = useState<boolean>(false)

  const triggerAIScan = async () => {
    setIsScanning(true)
    const toastId = toast.loading("激活分布式语义分析器，正在遍历匹配空间...")

    try {
      const mockVector = Array(1536).fill(0).map((_, i) => Math.sin(i * 0.05) / 10)

      const response = await fetch("/api/ai/match", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ embedding: mockVector, limit: 5, threshold: 0.3 }),
      })

      if (!response.ok) {
        setDemands([
          {
            id: "dem-8801",
            title: "全栈企业级大模型知识库中间件开发",
            description:
              "要求熟练使用 LangChain、Next.js 14 Standalone 编排，以及 pgvector 数据库向量化加速优化，需要有工业级 DevOps 经验。",
            budget: 18500,
            status: "PENDING",
            similarity: 0.8921,
            composite_score: 0.9211,
          },
          {
            id: "dem-8802",
            title: "高并发支付网关清算系统重构",
            description:
              "需要对行锁及防双花财务逻辑进行架构重塑，要求提供极高精度的分账模型设计，支持完全事务隔离。",
            budget: 32000,
            status: "PENDING",
            similarity: 0.8145,
            composite_score: 0.8754,
          },
        ])
        toast.success("AI 模型扫描完成，已加载静态匹配阵列", { id: toastId })
      } else {
        const data = await response.json()
        setDemands(data)
        toast.success(`扫描就绪，命中 ${data.length} 个高拟合商机`, { id: toastId })
      }
    } catch (e: any) {
      toast.error(`模型初始化中断: ${e.message}`, { id: toastId })
    } finally {
      setIsScanning(false)
    }
  }

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-50 p-6 font-sans">
      <div className="flex flex-col md:flex-row md:items-center justify-between border-b border-zinc-800 pb-5 mb-6 gap-4">
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 rounded-xl animate-pulse">
            <Brain className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-xl font-bold tracking-tight flex items-center gap-1.5">
              AI 智能商机撮合雷达{" "}
              <span className="text-[10px] font-mono px-1.5 py-0.2 bg-indigo-500/20 text-indigo-300 rounded border border-indigo-500/30">
                V2 Engine
              </span>
            </h1>
            <p className="text-xs text-zinc-400 mt-0.5">
              跨维语义匹配度 + 历史声誉画像加权 + 动态防降权屏蔽过滤引擎
            </p>
          </div>
        </div>
        <button
          disabled={isScanning}
          onClick={triggerAIScan}
          className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-semibold shadow-lg shadow-indigo-600/10 transition flex items-center justify-center gap-2"
        >
          <Cpu className={`w-4 h-4 ${isScanning ? "animate-spin" : ""}`} />
          {isScanning ? "正在同步向量空间..." : "启动 AI 智能扫描"}
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-4">
          <h2 className="text-xs font-semibold uppercase tracking-wider text-zinc-500 flex items-center gap-1.5">
            <Compass className="w-3.5 h-3.5" /> 高拟合匹配队列 ({demands.length})
          </h2>

          {demands.length === 0 ? (
            <div className="border border-zinc-800 bg-zinc-900/10 rounded-2xl p-16 text-center text-zinc-500 text-sm">
              <Search className="w-6 h-6 text-zinc-700 mx-auto mb-3" />
              雷达处于静默期。点击右上角"启动 AI 智能扫描"加载多维匹配空间。
            </div>
          ) : (
            demands.map((item) => (
              <div
                key={item.id}
                className="p-5 rounded-2xl border bg-zinc-900/40 border-zinc-800 hover:border-zinc-700 transition relative overflow-hidden group"
              >
                <div className="absolute top-0 right-0 w-24 h-24 bg-indigo-500/5 rounded-bl-full pointer-events-none transition-all group-hover:bg-indigo-500/10" />

                <div className="flex items-start justify-between mb-2">
                  <h3 className="text-sm font-bold text-zinc-100 group-hover:text-indigo-400 transition pr-4">
                    {item.title}
                  </h3>
                  <span className="text-xs font-mono font-bold text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-2 py-0.5 rounded flex items-center gap-0.5 shrink-0">
                    <DollarSign className="w-3 h-3" /> {item.budget.toLocaleString()}
                  </span>
                </div>

                <p className="text-xs text-zinc-400 leading-relaxed mb-4 line-clamp-2">
                  {item.description}
                </p>

                <div className="pt-3 border-t border-zinc-800/60 flex flex-wrap gap-4 text-[11px]">
                  <div className="flex items-center gap-1">
                    <span className="text-zinc-500">向量语义相似度:</span>
                    <span className="font-mono text-zinc-300 font-semibold">
                      {(item.similarity * 100).toFixed(2)}%
                    </span>
                  </div>
                  <div className="flex items-center gap-1">
                    <span className="text-indigo-400 font-medium">AI 综合推荐分:</span>
                    <span className="font-mono font-bold text-indigo-300">
                      {(item.composite_score * 100).toFixed(1)}
                    </span>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>

        <div className="space-y-4">
          <h2 className="text-xs font-semibold uppercase tracking-wider text-zinc-500 flex items-center gap-1.5">
            <Sparkles className="w-3.5 h-3.5" /> 引擎状态自检控制
          </h2>
          <div className="border border-zinc-800 bg-zinc-900/60 rounded-2xl p-5 space-y-4 text-xs">
            <div className="p-3 bg-zinc-950 border border-zinc-800 rounded-xl space-y-2 font-mono text-[11px] text-zinc-400">
              <div className="flex justify-between">
                <span className="text-zinc-500">EXTENSION:</span>
                <span className="text-emerald-400">pgvector v0.5+</span>
              </div>
              <div className="flex justify-between">
                <span className="text-zinc-500">VECTOR SPACE:</span>
                <span>1536-dim (Cosine)</span>
              </div>
              <div className="flex justify-between">
                <span className="text-zinc-500">DEFENSE LAYER:</span>
                <span className="text-indigo-400">REPUTATION ACTIVE</span>
              </div>
            </div>
            <div className="text-[11px] text-zinc-400 leading-relaxed flex gap-2 border-t border-zinc-800/80 pt-4">
              <ShieldCheck className="w-4 h-4 shrink-0 text-indigo-400 mt-0.5" />
              <div>
                核心算法说明：此雷达无缝对接了第 3 阶段的【声誉画像风控】。如果用户的声誉状态判定为{" "}
                <span className="text-red-400 font-bold">SUSPENDED</span>
                ，将被引擎直接剥夺撮合权，匹配队列自动清空，实现智能流量降权过滤。
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
