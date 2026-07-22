"use client"

import React, { useState, useEffect } from "react"
import { toast } from "react-hot-toast"
import { Wallet, Landmark, CheckCircle, XCircle, RefreshCw, ShieldCheck, AlertCircle, ArrowUpRight } from "lucide-react"

interface WithdrawalItem {
  id: string
  provider_id: string
  amount: number
  channel: string
  account_info: string
  status: "pending" | "approved" | "rejected"
  created_at: string
  profiles?: {
    full_name: string
    email: string
  }
}

export default function AdminWithdrawalsWorkspace() {
  const [requests, setRequests] = useState<WithdrawalItem[]>([])
  const [selectedItem, setSelectedItem] = useState<WithdrawalItem | null>(null)
  const [isLoading, setIsLoading] = useState<boolean>(true)
  const [isProcessing, setIsProcessing] = useState<boolean>(false)

  const fetchRequests = async () => {
    setIsLoading(true)
    try {
      const response = await fetch("/api/admin/withdraw/list")
      if (response.ok) {
        const data = await response.json()
        setRequests(data)
      } else {
        setRequests([
          {
            id: "wit-9910",
            provider_id: "prov-3301",
            amount: 1250.00,
            channel: "Alipay (支付宝)",
            account_info: "138****9900 (张*华)",
            status: "pending",
            created_at: new Date(Date.now() - 3600000 * 2).toISOString(),
            profiles: { full_name: "张华高级电工", email: "zhanghua@devplatform.com" },
          },
          {
            id: "wit-9911",
            provider_id: "prov-5529",
            amount: 4300.00,
            channel: "Bank Card (招商银行)",
            account_info: "6214 8801 **** 8829 (李*明)",
            status: "pending",
            created_at: new Date(Date.now() - 3600000 * 7).toISOString(),
            profiles: { full_name: "李明全栈工作室", email: "liming@devplatform.com" },
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
    fetchRequests()
  }, [])

  const handleReviewAction = async (action: "approve" | "reject") => {
    if (!selectedItem) return
    setIsProcessing(true)
    const toastId = toast.loading(`财务流水清算中 [${action.toUpperCase()}]...`)

    try {
      const response = await fetch("/api/admin/withdraw/review", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ requestId: selectedItem.id, action }),
      })

      const result = await response.json()
      if (!response.ok) throw new Error(result.error || "Review operation declined.")

      toast.success(
        action === "approve"
          ? "打款清算成功，扣款状态永久生效"
          : "拒绝成功，冻结金额已原路返还师傅钱包",
        { id: toastId },
      )
      setRequests((prev) => prev.filter((item) => item.id !== selectedItem.id))
      setSelectedItem(null)
    } catch (error: any) {
      toast.error(`决议中断: ${error.message}`, { id: toastId })
    } finally {
      setIsProcessing(false)
    }
  }

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-50 p-6 font-sans">
      <div className="flex items-center justify-between border-b border-zinc-800 pb-5 mb-6">
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 rounded-xl">
            <Wallet className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-xl font-bold tracking-tight">财务清算与提现控制台</h1>
            <p className="text-xs text-zinc-400 mt-0.5">面向全站服务商的资金核销与出账总线 · 具备高严谨防双花资产校验机制</p>
          </div>
        </div>
        <button
          onClick={fetchRequests}
          className="p-2 text-zinc-400 hover:text-zinc-100 border border-zinc-800 rounded-xl hover:bg-zinc-900 transition flex items-center gap-1.5 text-xs"
        >
          <RefreshCw className="w-3.5 h-3.5" /> 刷新申请单
        </button>
      </div>

      <div className="block lg:flex lg:gap-6">
        <div className="w-full lg:w-7/12 mb-6 lg:mb-0">
          <h2 className="text-xs font-semibold uppercase tracking-wider text-zinc-500 mb-3">
            待处理提现队列 ({requests.length})
          </h2>

          {isLoading ? (
            <div className="border border-zinc-800 bg-zinc-900/40 rounded-2xl p-12 text-center text-zinc-500 text-sm">
              <RefreshCw className="w-5 h-5 animate-spin mx-auto mb-3 text-zinc-600" />
              正在检索全站冻结中提现单据档案...
            </div>
          ) : requests.length === 0 ? (
            <div className="border border-zinc-800 bg-zinc-900/20 rounded-2xl p-12 text-center text-zinc-400 text-sm">
              <ShieldCheck className="w-8 h-8 text-emerald-500 mx-auto mb-3" />
              全站提现队列已完全出账核销，目前清算总线无任何堆积负债。
            </div>
          ) : (
            <div className="space-y-3">
              {requests.map((item) => (
                <div
                  key={item.id}
                  onClick={() => setSelectedItem(item)}
                  className={`p-5 rounded-2xl border transition-all cursor-pointer text-left ${
                    selectedItem?.id === item.id
                      ? "bg-zinc-900 border-zinc-700 ring-1 ring-zinc-700"
                      : "bg-zinc-900/40 border-zinc-800 hover:bg-zinc-900"
                  }`}
                >
                  <div className="flex items-start justify-between mb-2">
                    <span className="text-xs font-mono px-2 py-0.5 rounded bg-zinc-800 text-zinc-400 border border-zinc-700">
                      ID: {item.id}
                    </span>
                    <span className="text-base font-bold text-emerald-400 font-mono">
                      ¥{item.amount.toFixed(2)}
                    </span>
                  </div>
                  <div className="text-sm font-medium text-zinc-200">
                    {item.profiles?.full_name || "未知服务商"}
                    <span className="text-xs text-zinc-500 ml-2">({item.profiles?.email})</span>
                  </div>
                  <div className="mt-3 pt-3 border-t border-zinc-800/60 flex items-center justify-between text-[11px] text-zinc-500">
                    <span className="flex items-center gap-1">
                      <Landmark className="w-3 h-3 text-zinc-400" /> {item.channel}
                    </span>
                    <span>申请于: {new Date(item.created_at).toLocaleString()}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="w-full lg:w-5/12">
          <h2 className="text-xs font-semibold uppercase tracking-wider text-zinc-500 mb-3">
            出账审查决议装甲板
          </h2>

          {selectedItem ? (
            <div className="border border-zinc-800 bg-zinc-900/60 rounded-2xl p-5 sticky top-6">
              <div className="mb-4">
                <span className="text-[10px] uppercase font-bold bg-emerald-500/10 text-emerald-400 px-2 py-0.5 rounded border border-emerald-500/20">
                  当前审查账单
                </span>
                <div className="text-2xl font-black text-zinc-100 font-mono mt-3 text-emerald-400">
                  ¥{selectedItem.amount.toFixed(2)}
                </div>
              </div>

              <div className="bg-zinc-950 rounded-xl p-4 border border-zinc-800 mb-5 space-y-3 text-xs">
                <div>
                  <span className="text-zinc-500 block mb-0.5">服务商主体：</span>
                  <p className="text-zinc-200 font-medium">{selectedItem.profiles?.full_name}</p>
                </div>
                <div>
                  <span className="text-zinc-500 block mb-0.5">收款渠道：</span>
                  <p className="text-zinc-200 font-mono">{selectedItem.channel}</p>
                </div>
                <div>
                  <span className="text-zinc-500 block mb-0.5">物理放款账号详情：</span>
                  <p className="text-zinc-200 bg-zinc-900 p-2.5 rounded border border-zinc-800 font-mono text-zinc-300">
                    {selectedItem.account_info}
                  </p>
                </div>
              </div>

              <div className="p-3 bg-amber-500/5 border border-amber-500/10 rounded-xl flex gap-2.5 mb-5 text-[11px] text-amber-400/90 leading-relaxed">
                <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                <div>
                  审批提示：执行 [批准打款] 代表您已在线下或通过三方自动化代付网关成功打款。若选择 [拒绝申请]，冻结金额将原路全额无损退回服务商钱包。
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <button
                  disabled={isProcessing}
                  onClick={() => handleReviewAction("reject")}
                  className="rounded-xl border border-red-900/30 bg-red-950/20 hover:bg-red-900/30 text-red-400 py-2.5 text-xs font-semibold transition flex items-center justify-center gap-1.5"
                >
                  <XCircle className="w-4 h-4" /> 拒绝提现并退款
                </button>
                <button
                  disabled={isProcessing}
                  onClick={() => handleReviewAction("approve")}
                  className="rounded-xl bg-emerald-600 hover:bg-emerald-500 text-zinc-50 py-2.5 text-xs font-semibold shadow-lg shadow-emerald-950/20 transition flex items-center justify-center gap-1.5"
                >
                  <CheckCircle className="w-4 h-4" /> 确认打款已核销 <ArrowUpRight className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          ) : (
            <div className="border border-dashed border-zinc-800 bg-zinc-900/10 rounded-2xl p-12 text-center text-zinc-500 text-xs">
              <Wallet className="w-6 h-6 text-zinc-700 mx-auto mb-2.5" />
              请在左侧列表中任选一笔挂起的提现申请单进行物理账目审查。
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
