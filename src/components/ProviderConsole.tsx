"use client"

import { useState, useEffect } from "react"
import Link from "next/link"
import {
  Radio, ShieldAlert, Navigation, ArrowRight, CheckCircle2,
  Upload, CloudLightning, Coins, ArrowLeft, ShieldCheck, Lock, Unlock, IdCard,
} from "lucide-react"
import toast from "react-hot-toast"

interface Demand {
  id: string
  title: string
  status: string
  urgency: string
  budget_range?: number[]
  customer?: { id: string; name: string; creditScore: number }
}

interface Contract {
  id: string
  demand_id: string
  title: string
  fund_status: string
  amount: number
  created_at: string
}

interface ProviderConsoleProps {
  onBackToHome?: () => void
}

export default function ProviderConsole({ onBackToHome }: ProviderConsoleProps) {
  const [activeTab, setActiveTab] = useState<"radar" | "myTasks">("radar")
  const [demands, setDemands] = useState<Demand[]>([])
  const [contracts, setContracts] = useState<Contract[]>([])
  const [selectedDemand, setSelectedDemand] = useState<Demand | null>(null)
  const [loading, setLoading] = useState(true)
  const [claimingId, setClaimingId] = useState<string | null>(null)
  const [uploadStatus, setUploadStatus] = useState<"idle" | "uploading" | "done">("idle")
  const [ipfsHash, setIpfsHash] = useState("")
  const [settlingId, setSettlingId] = useState<string | null>(null)
  const [verificationStatus, setVerificationStatus] = useState<string | undefined>(undefined)

  useEffect(() => {
    loadDemands()
    fetch("/api/profile")
      .then((res) => res.json())
      .then((data) => setVerificationStatus(data.user?.verification_status))
      .catch(() => {})
  }, [])

  useEffect(() => {
    if (activeTab === "myTasks") loadContracts()
  }, [activeTab])

  async function loadDemands() {
    setLoading(true)
    try {
      const res = await fetch("/api/provider/demands")
      const json = await res.json()
      setDemands(json.demands ?? [])
      if (json.demands?.length > 0 && !selectedDemand) {
        setSelectedDemand(json.demands[0])
      }
    } catch {
      toast.error("加载需求列表失败")
    } finally {
      setLoading(false)
    }
  }

  async function loadContracts() {
    try {
      const res = await fetch("/api/orders?role=provider")
      const json = await res.json()
      setContracts(json.orders ?? [])
    } catch {
      toast.error("加载合同列表失败")
    }
  }

  async function handleClaim(demandId: string) {
    if (verificationStatus && verificationStatus !== "approved") {
      toast.error("抢单失败：请先完成实名身份验证！")
      setClaimingId(null)
      return
    }

    setClaimingId(demandId)
    try {
      const res = await fetch(`/api/demands/${demandId}/assign`, { method: "POST" })
      if (!res.ok) {
        const err = await res.json()
        toast.error(err.error || "抢单失败")
        return
      }
      toast.success("契约锁定成功！")
      await loadDemands()
      await loadContracts()
      setActiveTab("myTasks")
    } catch {
      toast.error("网络错误，抢单失败")
    } finally {
      setClaimingId(null)
    }
  }

  async function handleUploadProof(contractId: string) {
    setUploadStatus("uploading")
    try {
      const res = await fetch("/api/provider/upload-proof", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contractId,
          imageData: `proof_photo_${Date.now()}_service_completed`,
          description: "现场完工凭证",
        }),
      })
      const json = await res.json()
      if (!res.ok) {
        toast.error(json.error || "上传失败")
        setUploadStatus("idle")
        return
      }
      setIpfsHash(json.hash)
      setUploadStatus("done")
      toast.success("存证上传成功")
    } catch {
      toast.error("网络错误，上传失败")
      setUploadStatus("idle")
    }
  }

  async function handleSettle(contractId: string) {
    setSettlingId(contractId)
    try {
      const res = await fetch("/api/provider/settle", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ contractId }),
      })
      const json = await res.json()
      if (!res.ok) {
        toast.error(json.error || "结算失败")
        return
      }
      toast.success("结算请求已提交")
      await loadContracts()
    } catch {
      toast.error("网络错误，结算失败")
    } finally {
      setSettlingId(null)
    }
  }

  const myActiveContracts = contracts.filter(c => c.fund_status !== "COMPLETED" && c.fund_status !== "SATISFACTION_HELD")

  return (
    <div className="min-h-screen bg-slate-900 text-slate-100 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-6xl mx-auto space-y-8">

        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-6 pb-6 border-b border-slate-800">
          <div className="flex items-center gap-3">
            {onBackToHome && (
              <button
                onClick={onBackToHome}
                className="p-2 bg-slate-800 hover:bg-slate-700 rounded-lg border border-slate-700 shadow-sm transition-all text-slate-400 hover:text-slate-200 active:scale-95"
                aria-label="返回首页"
              >
                <ArrowLeft className="w-5 h-5" />
              </button>
            )}
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-2xl font-bold tracking-tight text-white">服务商控制台</h1>
                <span className="bg-emerald-500/10 text-emerald-400 text-xs font-semibold px-2.5 py-1 rounded-full border border-emerald-500/20">接单商版</span>
              </div>
              <p className="text-sm text-slate-400 mt-1">{demands.length} 个可用需求</p>
            </div>
          </div>

                <div className="flex bg-slate-800/80 p-1 rounded-xl border border-slate-700 touch-manipulation">
            <button
              onClick={() => setActiveTab("radar")}
              className={`touch-target flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-bold transition-all active:scale-95 ${
                activeTab === "radar"
                  ? "bg-slate-700 text-white shadow-sm"
                  : "text-slate-400 hover:text-slate-200"
              }`}
            >
              <Radio className="w-4 h-4 animate-pulse text-emerald-400" />
              可用需求
            </button>
            <button
              onClick={() => setActiveTab("myTasks")}
              className={`touch-target flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-bold transition-all active:scale-95 relative ${
                activeTab === "myTasks"
                  ? "bg-slate-700 text-white shadow-sm"
                  : "text-slate-400 hover:text-slate-200"
              }`}
            >
              我的承接
              {myActiveContracts.length > 0 && (
                <span className="absolute -top-1 -right-1 flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
                </span>
              )}
            </button>
          </div>
        </div>

        {/* Verification prompt banner */}
        <Link
          href="/verification"
          className="touch-target flex items-center justify-between gap-4 rounded-xl border border-amber-500/20 bg-amber-500/5 px-5 py-3 transition-all hover:bg-amber-500/10 active:scale-[0.99]"
        >
          <div className="flex items-center gap-3">
            <IdCard className="size-5 text-amber-400 shrink-0" />
            <div>
              <p className="text-sm font-semibold text-amber-300">未完成身份验证</p>
              <p className="text-xs text-amber-400/70">验证后获得优先派单与更高接单限额</p>
            </div>
          </div>
          <span className="text-xs text-amber-400 font-medium whitespace-nowrap">
            前往验证 →
          </span>
        </Link>

        {activeTab === "radar" && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">

            <div className="lg:col-span-2 space-y-6">

              <div className="bg-slate-950 rounded-2xl border border-slate-800 p-6 relative overflow-hidden flex flex-col sm:flex-row items-center gap-8 shadow-inner">
                <div className="relative w-44 h-44 rounded-full border border-emerald-500/20 bg-slate-900 flex items-center justify-center shrink-0">
                  <div className="absolute inset-0 rounded-full animate-[spin_4s_linear_infinite] bg-gradient-to-tr from-transparent via-transparent to-emerald-500/20 pointer-events-none" />
                  <div className="absolute w-32 h-32 rounded-full border border-emerald-500/10" />
                  <div className="absolute w-20 h-20 rounded-full border border-emerald-500/5" />
                  <span className="absolute top-10 left-12 h-3 w-3 bg-emerald-400 rounded-full shadow-[0_0_8px_rgba(52,211,153,0.8)] animate-ping" />
                  <span className="absolute bottom-12 right-10 h-2.5 w-2.5 bg-emerald-500 rounded-full shadow-[0_0_6px_rgba(52,211,153,0.6)]" />
                  <Navigation className="w-6 h-6 text-emerald-400 rotate-45" />
                </div>

                <div className="space-y-3 text-center sm:text-left">
                  <h3 className="text-lg font-bold text-white flex items-center justify-center sm:justify-start gap-2">
                    <CloudLightning className="w-5 h-5 text-yellow-400 animate-bounce" />
                    周边需求扫描中
                  </h3>
                  <p className="text-xs text-slate-400 leading-relaxed max-w-sm">
                    平台已为您匹配到 {demands.length} 个可用服务需求。点击下方卡片查看详情并抢单。
                  </p>
                  <div className="inline-flex items-center gap-1.5 bg-slate-900 border border-slate-800 px-3 py-1 rounded-full text-[11px] text-slate-400 font-mono">
                    <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                    已就绪 - {demands.length} 个待接需求
                  </div>
                </div>
              </div>

              <div className="space-y-4">
                <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500">可用需求列表</h4>
                {loading ? (
                  <div className="text-center py-12 text-slate-500">加载中...</div>
                ) : demands.length === 0 ? (
                  <div className="text-center py-12 text-slate-500">暂无可用需求</div>
                ) : (
                  demands.map((demand) => (
                    <div
                      key={demand.id}
                      onClick={() => setSelectedDemand(demand)}
                      className={`p-5 rounded-xl border transition-all duration-200 cursor-pointer touch-feedback active:scale-[0.99] ${
                        selectedDemand?.id === demand.id
                          ? "bg-slate-800/80 border-indigo-500 shadow-lg shadow-indigo-500/5"
                          : "bg-slate-900/50 border-slate-800 hover:border-slate-700 hover:bg-slate-900"
                      }`}
                    >
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                        <div className="space-y-1">
                          <div className="flex items-center gap-2">
                            <span className="text-[10px] bg-amber-500/10 text-amber-400 font-medium px-2 py-0.5 rounded border border-amber-500/20">{demand.urgency}</span>
                            {demand.customer && (
                              <span className="text-[10px] bg-slate-800 text-slate-400 font-mono px-2 py-0.5 rounded border border-slate-700">信用: {demand.customer.creditScore}</span>
                            )}
                          </div>
                          <h5 className="font-semibold text-sm text-slate-100 mt-1.5">{demand.title}</h5>
                        </div>

                        <div className="text-right self-start sm:self-center">
                          <span className="text-xl font-extrabold text-emerald-400 font-mono">¥{demand.budget_range?.[1] ?? '??'}</span>
                          <p className="text-[10px] text-slate-500">预算上限</p>
                        </div>
                      </div>

                      <div className="flex items-center justify-between mt-4 pt-3 border-t border-slate-800/60">
                        <span className="text-xs text-indigo-400 font-medium flex items-center gap-1 touch-target inline-flex">
                          查看详情 <ArrowRight className="w-3 h-3" />
                        </span>
                      </div>
                    </div>
                  ))
                )}
              </div>

            </div>

            <div className="space-y-6">
              {selectedDemand && (
                <div className="bg-slate-950 rounded-2xl border border-slate-800 p-6 space-y-6 shadow-xl relative overflow-hidden">
                  <div className="absolute top-0 right-0 w-24 h-24 bg-indigo-500/5 rounded-full blur-2xl" />

                  <div className="space-y-2">
                    <span className="text-xs font-semibold text-emerald-400 uppercase tracking-wider">当前选中的需求</span>
                    <h3 className="text-lg font-bold text-white">{selectedDemand.title}</h3>
                  </div>

                  <div className="p-4 bg-slate-900/60 border border-slate-800 rounded-xl space-y-3">
                    <div className="flex justify-between text-xs">
                      <span className="text-slate-400">需求发起方:</span>
                      <span className="font-mono text-slate-300">{selectedDemand.customer?.name ?? '匿名'}</span>
                    </div>
                    <div className="flex justify-between text-xs">
                      <span className="text-slate-400">信用评分:</span>
                      <span className="text-emerald-400 font-medium">{selectedDemand.customer?.creditScore ?? '暂无'}</span>
                    </div>
                    <div className="flex justify-between text-xs">
                      <span className="text-slate-400">预算上限:</span>
                      <span className="text-indigo-400 font-medium">¥{selectedDemand.budget_range?.[1] ?? '待商议'}</span>
                    </div>
                  </div>

                  <div className="text-center py-4 border-y border-slate-800">
                    <span className="text-4xl font-extrabold text-white font-mono">¥{selectedDemand.budget_range?.[1] ?? '??'}.00</span>
                    <p className="text-xs text-slate-500 mt-1">履约完成后结算</p>
                  </div>

                  <button
                    onClick={() => handleClaim(selectedDemand.id)}
                    disabled={claimingId === selectedDemand.id}
                    className="touch-target w-full py-3 bg-gradient-to-r from-emerald-500 to-indigo-600 hover:from-emerald-400 hover:to-indigo-500 text-white font-bold rounded-xl text-sm flex items-center justify-center gap-2 shadow-lg transition-transform active:scale-[0.97] disabled:opacity-50"
                  >
                    <Lock className="w-4 h-4" />
                    {claimingId === selectedDemand.id ? '抢单中...' : '立即抢单'}
                  </button>

                </div>
              )}
            </div>

          </div>
        )}

        {activeTab === "myTasks" && (
          <div className="max-w-3xl mx-auto space-y-8">

            {myActiveContracts.length === 0 ? (
              <div className="bg-slate-950 rounded-2xl border border-slate-800 p-12 text-center space-y-4">
                <div className="w-16 h-16 bg-slate-900 rounded-full flex items-center justify-center mx-auto text-slate-600">
                  <ShieldAlert className="w-8 h-8" />
                </div>
                <h3 className="text-lg font-bold text-white">暂无执行中的合同</h3>
                <p className="text-xs text-slate-400 max-w-sm mx-auto leading-relaxed">
                  请先前往【可用需求】选择合适的需求并抢单。
                </p>
                <button
                  onClick={() => setActiveTab("radar")}
                  className="bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold py-2.5 px-4 rounded-xl shadow-lg transition-all"
                >
                  去查看可用需求
                </button>
              </div>
            ) : (
              myActiveContracts.map((contract) => (
                <div key={contract.id} className="space-y-6">

                  <div className="bg-slate-950 rounded-2xl border border-slate-800 p-6 space-y-4 relative overflow-hidden">
                    <div className="absolute top-0 right-0 w-32 h-32 bg-emerald-500/5 rounded-full blur-3xl" />

                    <div className="flex items-center justify-between">
                      <span className="text-xs font-semibold text-indigo-400">已锁定的合同</span>
                      <span className="text-xs px-2.5 py-1 rounded-full font-bold border bg-amber-500/10 text-amber-400 border-amber-500/20 animate-pulse">
                        执行推进中
                      </span>
                    </div>

                    <h3 className="text-xl font-bold text-white">{contract.title}</h3>

                    <div className="flex items-center gap-6 py-4 border-y border-slate-800">
                      <div>
                        <p className="text-xs text-slate-500">合同金额</p>
                        <p className="text-2xl font-bold font-mono text-emerald-400 mt-0.5">¥{contract.amount.toFixed(2)}</p>
                      </div>
                      <div className="w-px h-10 bg-slate-800" />
                      <div>
                        <p className="text-xs text-slate-500">资金状态</p>
                        <p className="text-sm font-semibold font-mono text-slate-300 mt-1">{contract.fund_status}</p>
                      </div>
                    </div>
                  </div>

                  <div className="bg-slate-950 rounded-2xl border border-slate-800 p-6 space-y-6">
                    <h4 className="text-sm font-bold text-white flex items-center gap-2">
                      <Upload className="w-5 h-5 text-indigo-400" />
                      完工存证
                    </h4>

                    {uploadStatus === "idle" && (
                      <div className="p-8 bg-slate-900/40 border border-dashed border-slate-800 rounded-xl text-center space-y-3">
                        <div className="w-12 h-12 bg-slate-800 rounded-full flex items-center justify-center mx-auto text-slate-500">
                          <Upload className="w-6 h-6 animate-bounce" />
                        </div>
                        <div>
                          <p className="text-xs font-bold text-slate-300">上传完工凭证</p>
                          <p className="text-[10px] text-slate-500 mt-1">凭证将被记录到证据链中并生成哈希存证</p>
                        </div>
                        <button
                          onClick={() => handleUploadProof(contract.id)}
                          className="touch-target bg-indigo-600 hover:bg-indigo-700 active:bg-indigo-800 text-white text-xs font-semibold py-2.5 px-5 rounded-lg shadow-md transition-transform active:scale-95"
                        >
                          上传完工凭证
                        </button>
                      </div>
                    )}

                    {uploadStatus === "uploading" && (
                      <div className="p-8 bg-slate-900/40 border border-slate-800 rounded-xl text-center space-y-4">
                        <span className="animate-spin inline-block rounded-full h-8 w-8 border-2 border-indigo-500 border-t-transparent" />
                        <p className="text-xs font-semibold text-slate-300">正在写入证据链...</p>
                      </div>
                    )}

                    {uploadStatus === "done" && (
                      <div className="space-y-4">
                        <div className="flex items-center gap-4 p-4 bg-slate-900 border border-slate-800 rounded-xl">
                          <div className="w-10 h-10 bg-emerald-500/20 text-emerald-400 rounded-full flex items-center justify-center shrink-0">
                            <CheckCircle2 className="w-5 h-5" />
                          </div>
                          <div className="space-y-1.5 flex-1">
                            <span className="text-[10px] bg-emerald-500/10 text-emerald-400 font-bold px-2 py-0.5 rounded border border-emerald-500/20">
                              ✓ 已存证
                            </span>
                            <p className="text-[10px] font-mono text-indigo-400 bg-slate-950 p-2 rounded border border-slate-800 select-all max-w-full overflow-hidden text-ellipsis">
                              {ipfsHash}
                            </p>
                          </div>
                        </div>

                        <button
                          onClick={() => handleSettle(contract.id)}
                          disabled={settlingId === contract.id}
                          className="touch-target w-full bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 text-white font-semibold py-3 px-4 rounded-xl text-xs flex items-center justify-center gap-2 shadow-lg transition-transform active:scale-[0.97] disabled:opacity-50"
                        >
                          <Coins className="w-4 h-4" />
                          {settlingId === contract.id ? '结算中...' : '申请结算'}
                        </button>
                      </div>
                    )}

                  </div>

                </div>
              ))
            )}

          </div>
        )}

      </div>
    </div>
  )
}
