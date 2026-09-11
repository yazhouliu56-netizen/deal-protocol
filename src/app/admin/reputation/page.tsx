"use client"

import React, { useState, useEffect, useCallback } from "react"
import { toast, updateToast } from "@/base/platform/toast";
import { ShieldAlert, UserX, CheckCircle, RefreshCw, AlertTriangle, UserCheck } from "lucide-react"

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
  const [loadError, setLoadError] = useState<string | null>(null)
  const [isProcessing, setIsProcessing] = useState<boolean>(false)

  const fetchAnomalies = useCallback(async () => {
    setIsLoading(true)
    setLoadError(null)
    try {
      const response = await fetch("/api/admin/reputation/list")
      if (response.ok) {
        const data = await response.json()
        setProfiles(data)
      } else {
        // 后端异常必须如实暴露：空态 + 错误重试，严禁注入假用户掩盖故障。
        setProfiles([])
        setLoadError(`声誉队列加载失败（${response.status}），请重试`)
      }
    } catch (e) {
      console.error(e)
      setProfiles([])
      setLoadError("网络错误，声誉队列加载失败，请重试")
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => {
    const init = async () => {
      await fetchAnomalies()
    }
    init()
  }, [fetchAnomalies])

  const handleAmnesty = async () => {
    if (!selectedProfile) return
    setIsProcessing(true)
    const toastId = toast("发布官方最高特赦令，正在重写声誉参数...", "info")

    try {
      const response = await fetch("/api/admin/reputation/amnesty", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ targetUserId: selectedProfile.id }),
      })

      const result = await response.json()
      if (!response.ok) throw new Error(result.error || "Amnesty request declined.")

      updateToast(toastId, "特赦洗白成功，该服务商抢单准入限制已全面解除", "success")
      setProfiles((prev) => prev.filter((p) => p.id !== selectedProfile.id))
      setSelectedProfile(null)
    } catch (error: unknown) {
      updateToast(toastId, `特赦中断: ${error instanceof Error ? error.message : String(error)}`, "error")
    } finally {
      setIsProcessing(false)
    }
  }

  return (
    <div className="space-y-4 font-sans">
      <div className="flex items-center justify-between border-b border-[var(--color-duo-swan)] pb-5 mb-6">
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-red-500/10 border border-red-500/20 text-red-400 rounded-xl">
            <ShieldAlert className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-xl font-bold tracking-tight">声誉防御与画像风控工作台</h1>
            <p className="text-xs text-[var(--color-duo-wolf)] mt-0.5">面向全站服务主体的信任链分析沙盒 · 自动熔断降权及高阶清洗控制中心</p>
          </div>
        </div>
        <button
          onClick={fetchAnomalies}
          className="p-2 text-[var(--color-duo-wolf)] hover:text-[var(--color-duo-eel)] border border-[var(--color-duo-swan)] rounded-xl hover:bg-[var(--color-duo-polar)] transition flex items-center gap-1.5 text-xs"
        >
          <RefreshCw className="w-3.5 h-3.5" /> 刷新风控名单
        </button>
      </div>

      <div className="block lg:flex lg:gap-6">
        <div className="w-full lg:w-7/12 mb-6 lg:mb-0">
          <h2 className="text-xs font-semibold uppercase tracking-wider text-[var(--color-duo-wolf)] mb-3">
            异常声誉预警队列 ({profiles.length})
          </h2>

          {isLoading ? (
            <div className="border border-[var(--color-duo-swan)] bg-white rounded-2xl p-12 text-center text-[var(--color-duo-wolf)] text-sm">
              <RefreshCw className="w-5 h-5 animate-spin mx-auto mb-3 text-[var(--color-duo-hare)]" />
              正在提取信誉链污染源档案...
            </div>
          ) : loadError ? (
            <div className="border border-rose-200 bg-rose-50 rounded-2xl p-12 text-center text-sm">
              <p className="text-rose-700">{loadError}</p>
              <button
                type="button"
                onClick={fetchAnomalies}
                className="mt-4 rounded-xl bg-rose-600 px-4 py-2 text-sm font-bold text-white hover:bg-rose-500"
              >
                重新加载
              </button>
            </div>
          ) : profiles.length === 0 ? (
            <div className="border border-[var(--color-duo-swan)] bg-white rounded-2xl p-12 text-center text-[var(--color-duo-wolf)] text-sm">
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
                      ? "bg-white border-[var(--color-duo-swan)] ring-1 ring-[var(--color-duo-swan)]"
                      : "bg-white border-[var(--color-duo-swan)] hover:bg-[var(--color-duo-polar)]"
                  }`}
                >
                  <div className="flex items-start justify-between mb-2">
                    <span className="text-xs font-mono px-2 py-0.5 rounded bg-[var(--color-duo-swan)] text-[var(--color-duo-wolf)] border border-[var(--color-duo-swan)]">
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
                  <div className="text-sm font-medium text-[var(--color-duo-eel)]">
                    {item.full_name}
                    <span className="text-xs text-[var(--color-duo-wolf)] ml-2">({item.email})</span>
                  </div>
                  <div className="mt-3 pt-3 border-t border-[var(--color-duo-swan)] flex items-center justify-between text-xs text-[var(--color-duo-wolf)]">
                    <span className="flex items-center gap-1 font-semibold text-[var(--color-duo-wolf)]">
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
          <h2 className="text-xs font-semibold uppercase tracking-wider text-[var(--color-duo-wolf)] mb-3">
            声誉清洗及干预决策板
          </h2>

          {selectedProfile ? (
            <div className="border border-[var(--color-duo-swan)] bg-white rounded-2xl p-5 sticky top-6">
              <div className="mb-4">
                <span className="text-xs uppercase font-bold bg-red-500/10 text-red-400 px-2 py-0.5 rounded border border-red-500/20">
                  当前锁定的制裁对象
                </span>
                <div className="text-lg font-bold text-[var(--color-duo-eel)] mt-3">
                  {selectedProfile.full_name}
                </div>
                <p className="text-xs text-[var(--color-duo-wolf)] font-mono mt-0.5">{selectedProfile.email}</p>
              </div>

              <div className="bg-[var(--color-duo-polar)] rounded-xl p-4 border border-[var(--color-duo-swan)] mb-5 space-y-3 text-xs">
                <div className="flex justify-between items-center">
                  <span className="text-[var(--color-duo-wolf)]">当前计算得分：</span>
                  <span className="font-mono font-bold text-[var(--color-duo-eel)] text-sm">
                    {selectedProfile.reputation_score.toFixed(2)} / 5.00
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-[var(--color-duo-wolf)]">市场准入限制：</span>
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

              <div className="p-3 bg-[var(--color-duo-polar)] border border-[var(--color-duo-swan)] rounded-xl flex gap-2.5 mb-5 text-xs text-[var(--color-duo-wolf)] leading-relaxed">
                <AlertTriangle className="w-4 h-4 shrink-0 text-amber-600 mt-0.5" />
                <div>
                  风控介入法则：此控制台专用于应对由于不可抗力或客户恶意刷差评导致的优质服务商被{"\u201C"}误伤{"\u201D"}锁定的特赦修复通道。
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
            <div className="border border-dashed border-[var(--color-duo-swan)] bg-[var(--color-duo-polar)] rounded-2xl p-12 text-center text-[var(--color-duo-wolf)] text-xs">
              <UserX className="w-6 h-6 text-[var(--color-duo-hare)] mx-auto mb-2.5" />
              请在左侧风险队列中点选主体，执行特赦或者降权状态校验。
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
