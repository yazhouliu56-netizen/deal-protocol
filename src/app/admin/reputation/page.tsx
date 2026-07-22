"use client"

import React, { useState, useEffect } from "react"
import { toast } from "react-hot-toast"
import { ShieldAlert, Award, UserX, CheckCircle, RefreshCw, AlertTriangle, UserCheck } from "lucide-react"

interface AnomalyProfile {
  id: string
  full_name: string
  email: string
  role: string
  reputation_score: number
  compliance_status: "NORMAL" | "WARNED" | "SUSPENDED"
}

export default function AdminReputationWorkspace() {
  const [profiles, setProfiles] = useState<AnomalyProfile[]>([])
  const [selectedProfile, setSelectedProfile] = useState<AnomalyProfile | null>(null)
  const [isLoading, setIsLoading] = useState<boolean>(true)
  const [isProcessing, setIsProcessing] = useState<boolean>(false)

  const fetchAnomalies = async () => {
    setIsLoading(true)
    try {
      const response = await fetch("/api/admin/reputation/list")
      if (response.ok) {
        const data = await response.json()
        setProfiles(data)
      } else {
        setProfiles([
          {
            id: "usr-9901",
            full_name: "赵四粗暴家政组",
            email: "zhaosi@devplatform.com",
            role: "provider",
            reputation_score: 2.80,
            compliance_status: "SUSPENDED",
          },
          {
            id: "usr-9902",
            full_name: "钱七高频爽约工作室",
            email: "qianqi@devplatform.com",
            role: "provider",
            reputation_score: 3.95,
            compliance_status: "WARNED",
          },
        ])
      }
    } catch (e) {
      console.error(e)
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    fetchAnomalies()
  }, [])

  const handleAmnesty = async () => {
    if (!selectedProfile) return
    setIsProcessing(true)
    const toastId = toast.loading("发布官方最高特赦令，正在重写声誉参数...")

    try {
      const response = await fetch("/api/admin/reputation/amnesty", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ targetUserId: selectedProfile.id }),
      })

      const result = await response.json()
      if (!response.ok) throw new Error(result.error || "Amnesty request declined.")

      toast.success("特赦洗白成功，该服务商抢单准入限制已全面解除", { id: toastId })
      setProfiles((prev) => prev.filter((p) => p.id !== selectedProfile.id))
      setSelectedProfile(null)
    } catch (error: any) {
      toast.error(`特赦中断: ${error.message}`, { id: toastId })
    } finally {
      setIsProcessing(false)
    }
  }

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-50 p-6 font-sans">
      <div className="flex items-center justify-between border-b border-zinc-800 pb-5 mb-6">
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-red-500/10 border border-red-500/20 text-red-400 rounded-xl">
            <ShieldAlert className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-xl font-bold tracking-tight">声誉防御与画像风控工作台</h1>
            <p className="text-xs text-zinc-400 mt-0.5">面向全站服务主体的信任链分析沙盒 · 自动熔断降权及高阶清洗控制中心</p>
          </div>
        </div>
        <button
          onClick={fetchAnomalies}
          className="p-2 text-zinc-400 hover:text-zinc-100 border border-zinc-800 rounded-xl hover:bg-zinc-900 transition flex items-center gap-1.5 text-xs"
        >
          <RefreshCw className="w-3.5 h-3.5" /> 刷新风控名单
        </button>
      </div>

      <div className="block lg:flex lg:gap-6">
        <div className="w-full lg:w-7/12 mb-6 lg:mb-0">
          <h2 className="text-xs font-semibold uppercase tracking-wider text-zinc-500 mb-3">
            异常声誉预警队列 ({profiles.length})
          </h2>

          {isLoading ? (
            <div className="border border-zinc-800 bg-zinc-900/40 rounded-2xl p-12 text-center text-zinc-500 text-sm">
              <RefreshCw className="w-5 h-5 animate-spin mx-auto mb-3 text-zinc-600" />
              正在提取信誉链污染源档案...
            </div>
          ) : profiles.length === 0 ? (
            <div className="border border-zinc-800 bg-zinc-900/20 rounded-2xl p-12 text-center text-zinc-400 text-sm">
              <CheckCircle className="w-8 h-8 text-emerald-500 mx-auto mb-3" />
              全站主体信誉表现极其优异，没有任何服务商触发降权熔断阈值。
            </div>
          ) : (
            <div className="space-y-3">
              {profiles.map((item) => (
                <div
                  key={item.id}
                  onClick={() => setSelectedProfile(item)}
                  className={`p-5 rounded-2xl border transition-all cursor-pointer text-left ${
                    selectedProfile?.id === item.id
                      ? "bg-zinc-900 border-zinc-700 ring-1 ring-zinc-700"
                      : "bg-zinc-900/40 border-zinc-800 hover:bg-zinc-900"
                  }`}
                >
                  <div className="flex items-start justify-between mb-2">
                    <span className="text-xs font-mono px-2 py-0.5 rounded bg-zinc-800 text-zinc-400 border border-zinc-700">
                      UID: {item.id}
                    </span>
                    <span
                      className={`text-xs font-bold px-2.5 py-0.5 rounded ${
                        item.compliance_status === "SUSPENDED"
                          ? "bg-red-500/10 text-red-400 border border-red-500/20"
                          : "bg-amber-500/10 text-amber-400 border border-amber-500/20"
                      }`}
                    >
                      {item.compliance_status}
                    </span>
                  </div>
                  <div className="text-sm font-medium text-zinc-200">
                    {item.full_name}
                    <span className="text-xs text-zinc-500 ml-2">({item.email})</span>
                  </div>
                  <div className="mt-3 pt-3 border-t border-zinc-800/60 flex items-center justify-between text-[11px] text-zinc-500">
                    <span className="flex items-center gap-1 font-semibold text-zinc-400">
                      综合信誉分:
                      <span
                        className={
                          item.reputation_score < 3.5 ? "text-red-400" : "text-amber-400"
                        }
                      >
                        {item.reputation_score.toFixed(2)}
                      </span>
                    </span>
                    <span className="capitalize">角色: {item.role}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="w-full lg:w-5/12">
          <h2 className="text-xs font-semibold uppercase tracking-wider text-zinc-500 mb-3">
            声誉清洗及干预决策板
          </h2>

          {selectedProfile ? (
            <div className="border border-zinc-800 bg-zinc-900/60 rounded-2xl p-5 sticky top-6">
              <div className="mb-4">
                <span className="text-[10px] uppercase font-bold bg-red-500/10 text-red-400 px-2 py-0.5 rounded border border-red-500/20">
                  当前锁定的制裁对象
                </span>
                <div className="text-lg font-bold text-zinc-100 mt-3">
                  {selectedProfile.full_name}
                </div>
                <p className="text-xs text-zinc-400 font-mono mt-0.5">{selectedProfile.email}</p>
              </div>

              <div className="bg-zinc-950 rounded-xl p-4 border border-zinc-800 mb-5 space-y-3 text-xs">
                <div className="flex justify-between items-center">
                  <span className="text-zinc-500">当前计算得分：</span>
                  <span className="font-mono font-bold text-zinc-200 text-sm">
                    {selectedProfile.reputation_score.toFixed(2)} / 5.00
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-zinc-500">市场准入限制：</span>
                  <span
                    className={`font-bold ${
                      selectedProfile.compliance_status === "SUSPENDED"
                        ? "text-red-400"
                        : "text-amber-400"
                    }`}
                  >
                    {selectedProfile.compliance_status === "SUSPENDED"
                      ? "全面熔断，剥夺抢单准入权"
                      : "黄牌警告，大厅权重降低降权"}
                  </span>
                </div>
              </div>

              <div className="p-3 bg-zinc-950 border border-zinc-800 rounded-xl flex gap-2.5 mb-5 text-[11px] text-zinc-400 leading-relaxed">
                <AlertTriangle className="w-4 h-4 shrink-0 text-amber-500 mt-0.5" />
                <div>
                  风控介入法则：此控制台专用于应对由于不可抗力或客户恶意刷差评导致的优质服务商被"误伤"锁定的特赦修复通道。
                </div>
              </div>

              <button
                disabled={isProcessing}
                onClick={handleAmnesty}
                className="w-full rounded-xl bg-zinc-100 hover:bg-zinc-200 text-zinc-950 py-2.5 text-xs font-bold shadow-lg transition flex items-center justify-center gap-1.5"
              >
                <UserCheck className="w-4 h-4" /> 签发最高特赦令并清白复权
              </button>
            </div>
          ) : (
            <div className="border border-dashed border-zinc-800 bg-zinc-900/10 rounded-2xl p-12 text-center text-zinc-500 text-xs">
              <UserX className="w-6 h-6 text-zinc-700 mx-auto mb-2.5" />
              请在左侧风险队列中点选主体，执行特赦或者降权状态校验。
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
