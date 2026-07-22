"use client"

import React, { useState, useEffect } from "react"
import { toast } from "react-hot-toast"
import { ShieldAlert, Scale, CheckCircle2, AlertTriangle, ArrowRight, RefreshCw, Image as ImageIcon } from "lucide-react"

interface DisputeItem {
  id: string
  order_id: string
  initiator_id: string
  reason: string
  evidence_urls: string[]
  status: "pending" | "refunded" | "force_settled"
  created_at: string
  demand_title?: string
  demand_price?: number
}

export default function AdminDisputesWorkspace() {
  const [disputes, setDisputes] = useState<DisputeItem[]>([])
  const [selectedDispute, setSelectedDispute] = useState<DisputeItem | null>(null)
  const [isLoading, setIsLoading] = useState<boolean>(true)
  const [isProcessing, setIsProcessing] = useState<boolean>(false)
  const [showModal, setShowModal] = useState<{ active: boolean; type: "refund" | "force_settle" | null }>({
    active: false,
    type: null,
  })

  const fetchDisputes = async () => {
    setIsLoading(true)
    try {
      const response = await fetch("/api/admin/disputes/list")
      if (response.ok) {
        const data = await response.json()
        setDisputes(data)
      } else {
        setDisputes([
          {
            id: "disp-101",
            order_id: "ord-8839",
            initiator_id: "usr-4412",
            reason: "师傅在清洁工程中损坏了客厅大理石茶几，拒绝修复并执意强行点击完工按钮提交验收状态。",
            evidence_urls: [],
            status: "pending",
            created_at: new Date(Date.now() - 3600000 * 4).toISOString(),
            demand_title: "高级全屋精细保洁 + 地毯深度护理服务",
            demand_price: 499.00,
          },
          {
            id: "disp-102",
            order_id: "ord-9904",
            initiator_id: "usr-2281",
            reason: "电路改装工单，师傅敷衍布线且没有进行过载安全测试，强行离场无法联系上。",
            evidence_urls: [],
            status: "pending",
            created_at: new Date(Date.now() - 3600000 * 12).toISOString(),
            demand_title: "家庭弱电箱整理与全屋智能开关改造升级",
            demand_price: 850.00,
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
    fetchDisputes()
  }, [])

  const handleArbitrateAction = async () => {
    if (!selectedDispute || !showModal.type) return
    setIsProcessing(true)
    const toastId = toast.loading("上帝裁决执行中，安全更新物理流水账目...")

    try {
      const response = await fetch("/api/admin/arbitrate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          orderId: selectedDispute.order_id,
          action: showModal.type === "refund" ? "refund" : "force_settle",
        }),
      })

      const result = await response.json()

      if (!response.ok) {
        throw new Error(result.error || "判决端点响应失败")
      }

      toast.success("判决生效！资金事务性流转已安全合拢", { id: toastId })

      setDisputes((prev) => prev.filter((item) => item.id !== selectedDispute.id))
      setSelectedDispute(null)
      setShowModal({ active: false, type: null })
    } catch (error: any) {
      toast.error(`裁决中断: ${error.message}`, { id: toastId })
    } finally {
      setIsProcessing(false)
    }
  }

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-50 p-6 font-sans">
      <div className="flex items-center justify-between border-b border-zinc-800 pb-5 mb-6">
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-amber-500/10 border border-amber-500/20 text-amber-500 rounded-xl">
            <Scale className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-xl font-bold tracking-tight">上帝仲裁工作台</h1>
            <p className="text-xs text-zinc-400 mt-0.5">面向托管资金纠纷的终极判定控制中心 · 具备物理划账最高系统权限</p>
          </div>
        </div>
        <button
          onClick={fetchDisputes}
          className="p-2 text-zinc-400 hover:text-zinc-100 border border-zinc-800 rounded-xl hover:bg-zinc-900 transition flex items-center gap-1.5 text-xs"
        >
          <RefreshCw className="w-3.5 h-3.5" /> 刷新队列
        </button>
      </div>

      <div className="block lg:flex lg:gap-6">
        <div className="w-full lg:w-7/12 mb-6 lg:mb-0">
          <h2 className="text-xs font-semibold uppercase tracking-wider text-zinc-500 mb-3 flex items-center gap-2">
            待处理纠纷队列 ({disputes.filter((d) => d.status === "pending").length})
          </h2>

          {isLoading ? (
            <div className="border border-zinc-800 bg-zinc-900/40 rounded-2xl p-12 text-center text-zinc-500 text-sm">
              <RefreshCw className="w-5 h-5 animate-spin mx-auto mb-3 text-zinc-600" />
              正在提取云端物理纠纷链条档案...
            </div>
          ) : disputes.length === 0 ? (
            <div className="border border-zinc-800 bg-zinc-900/20 rounded-2xl p-12 text-center text-zinc-400 text-sm">
              <CheckCircle2 className="w-8 h-8 text-emerald-500 mx-auto mb-3" />
              当前全站所有订单资金咬合完美，无可挑剔，监管天平处于静止平衡状态。
            </div>
          ) : (
            <div className="space-y-3.5">
              {disputes.map((item) => (
                <div
                  key={item.id}
                  onClick={() => setSelectedDispute(item)}
                  className={`p-5 rounded-2xl border transition-all duration-200 cursor-pointer text-left ${
                    selectedDispute?.id === item.id
                      ? "bg-zinc-900 border-zinc-700 ring-1 ring-zinc-700"
                      : "bg-zinc-900/50 border-zinc-800 hover:bg-zinc-900 hover:border-zinc-700"
                  }`}
                >
                  <div className="flex items-start justify-between gap-4 mb-2.5">
                    <span className="text-xs font-mono px-2.5 py-0.5 rounded-md bg-zinc-800 text-zinc-300 border border-zinc-700">
                      ID: {item.order_id}
                    </span>
                    <span className="text-sm font-semibold text-emerald-400 font-mono">
                      ¥{item.demand_price?.toFixed(2)}
                    </span>
                  </div>
                  <h3 className="text-sm font-medium text-zinc-200 mb-2 truncate">
                    {item.demand_title}
                  </h3>
                  <p className="text-xs text-zinc-400 line-clamp-2 leading-relaxed">
                    {item.reason}
                  </p>
                  <div className="mt-3.5 pt-3 border-t border-zinc-800/60 flex items-center justify-between text-[11px] text-zinc-500">
                    <span>申诉人ID: {item.initiator_id}</span>
                    <span>提交于: {new Date(item.created_at).toLocaleString()}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="w-full lg:w-5/12">
          <h2 className="text-xs font-semibold uppercase tracking-wider text-zinc-500 mb-3">
            上帝裁决控制台面板
          </h2>

          {selectedDispute ? (
            <div className="border border-zinc-800 bg-zinc-900/60 rounded-2xl p-5 sticky top-6">
              <div className="mb-4">
                <span className="text-[10px] uppercase tracking-widest text-amber-500 font-bold bg-amber-500/10 px-2 py-0.5 rounded border border-amber-500/20">
                  当前审阅案件
                </span>
                <h3 className="text-base font-bold text-zinc-100 mt-2">
                  {selectedDispute.demand_title}
                </h3>
                <div className="flex gap-4 mt-2 text-xs font-mono text-zinc-400">
                  <p>订单号: <span className="text-zinc-200">{selectedDispute.order_id}</span></p>
                  <p>担保资金: <span className="text-emerald-400 font-semibold">¥{selectedDispute.demand_price?.toFixed(2)}</span></p>
                </div>
              </div>

              <div className="bg-zinc-950 rounded-xl p-4 border border-zinc-800 mb-5">
                <h4 className="text-xs font-medium text-zinc-400 mb-2 flex items-center gap-1.5">
                  <AlertTriangle className="w-3.5 h-3.5 text-amber-500" /> 客户控诉及索赔理由：
                </h4>
                <p className="text-xs text-zinc-300 leading-relaxed">
                  {selectedDispute.reason}
                </p>

                <div className="mt-4 pt-3.5 border-t border-zinc-900">
                  <h5 className="text-[11px] font-medium text-zinc-500 mb-2 flex items-center gap-1">
                    <ImageIcon className="w-3.5 h-3.5" /> 双端履约及现场证据链 (0)
                  </h5>
                  <div className="flex gap-2">
                    <div className="w-16 h-16 border border-dashed border-zinc-800 bg-zinc-900/50 rounded-lg flex items-center justify-center text-[10px] text-zinc-600">
                      无图证
                    </div>
                  </div>
                </div>
              </div>

              <div className="space-y-3">
                <div className="p-3.5 bg-zinc-950 border border-zinc-800 rounded-xl text-center">
                  <p className="text-xs text-zinc-400 mb-2.5">此操作将撤销托管池资金，原路全额退款给下单客户</p>
                  <button
                    onClick={() => setShowModal({ active: true, type: "refund" })}
                    className="w-full rounded-xl bg-red-600 hover:bg-red-500 text-zinc-50 py-2.5 text-xs font-semibold tracking-wide shadow-lg shadow-red-950/20 transition duration-150"
                  >
                    判定 A：全额退款给客户
                  </button>
                </div>

                <div className="p-3.5 bg-zinc-950 border border-zinc-800 rounded-xl text-center">
                  <p className="text-xs text-zinc-400 mb-2.5">此操作将强行完成分账，按 90% 划拨给服务商师傅钱包</p>
                  <button
                    onClick={() => setShowModal({ active: true, type: "force_settle" })}
                    className="w-full rounded-xl bg-emerald-600 hover:bg-emerald-500 text-zinc-50 py-2.5 text-xs font-semibold tracking-wide shadow-lg shadow-emerald-950/20 transition duration-150"
                  >
                    判定 B：强行结算放款给师傅
                  </button>
                </div>
              </div>
            </div>
          ) : (
            <div className="border border-dashed border-zinc-800 bg-zinc-900/10 rounded-2xl p-12 text-center text-zinc-500 text-xs">
              <ShieldAlert className="w-6 h-6 text-zinc-700 mx-auto mb-2.5" />
              请在左侧列表中任选一笔挂起的纠纷案宗进行细化调阅与判定。
            </div>
          )}
        </div>
      </div>

      {showModal.active && showModal.type && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm transition-all">
          <div className="w-full max-w-md rounded-2xl border border-zinc-800 bg-zinc-900 p-6 text-left shadow-2xl mx-4">
            <h3 className="text-base font-bold text-zinc-100 flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-red-500" />
              触发最高管理员上帝裁决权？
            </h3>
            <p className="text-xs text-zinc-400 mt-2.5 leading-relaxed">您当前正在启动由平台总控介入的终极硬核分账判决。一旦确认执行：</p>
            <ul className="list-disc list-inside text-[11px] text-zinc-400 mt-2 space-y-1 bg-zinc-950 p-3 rounded-lg border border-zinc-800">
              <li>资金将发生不可逆转的物理层面划扣。</li>
              <li>{showModal.type === "refund" ? "客户将重新获得全部工单款项。" : "师傅将按照 90% 的比例获得最终结款报酬。"}</li>
              <li>全站相关的自动化订单流水流水线会自动增量更新。</li>
            </ul>
            <div className="mt-5 pt-3.5 border-t border-zinc-800 flex items-center justify-end gap-3">
              <button
                disabled={isProcessing}
                onClick={() => setShowModal({ active: false, type: null })}
                className="px-4 py-2 text-xs font-medium text-zinc-400 hover:text-zinc-200 border border-zinc-800 hover:bg-zinc-800/40 rounded-xl transition"
              >
                取消关闭
              </button>
              <button
                disabled={isProcessing}
                onClick={handleArbitrateAction}
                className={`px-4 py-2 text-xs font-semibold text-zinc-50 rounded-xl shadow-md transition flex items-center gap-1.5 ${
                  showModal.type === "refund" ? "bg-red-600 hover:bg-red-500" : "bg-emerald-600 hover:bg-emerald-500"
                }`}
              >
                {isProcessing && <RefreshCw className="w-3 h-3 animate-spin" />}
                签署最高判决指令 <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
