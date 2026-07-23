"use client"

import { useState } from "react"
import {
  ShieldCheck, Lock, Unlock, Eye,
  MapPin, Phone, User, Clock, CheckCircle2, FileText, ArrowLeft, ExternalLink, Coins,
} from "lucide-react"

interface ClientConsoleProps {
  onBackToHome?: () => void
}

export default function ClientConsole({ onBackToHome }: ClientConsoleProps) {
  const [isDecrypted, setIsDecrypted] = useState(false)
  const [isReleased, setIsReleased] = useState(false)
  const [isDecrypting, setIsDecrypting] = useState(false)

  const handleDecrypt = () => {
    setIsDecrypting(true)
    setTimeout(() => {
      setIsDecrypted(true)
      setIsDecrypting(false)
    }, 1500)
  }

  const handleReleaseFunds = () => {
    if (confirm("确认履约无误，并向接单方结算 ¥1,200 资金吗？")) {
      setIsReleased(true)
    }
  }

  return (
    <div className="min-h-screen bg-slate-50/50 text-slate-900 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-6xl mx-auto space-y-8">

        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-6 border-b border-slate-100">
          <div className="flex items-center gap-3">
            {onBackToHome && (
              <button
                onClick={onBackToHome}
                className="p-2 hover:bg-white rounded-lg border border-slate-100 shadow-sm transition-all text-slate-500 hover:text-slate-800 active:scale-95"
                aria-label="返回首页"
              >
                <ArrowLeft className="w-5 h-5" />
              </button>
            )}
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-2xl font-bold tracking-tight text-slate-900">契约派单控制台</h1>
                <span className="bg-indigo-50 text-indigo-700 text-xs font-semibold px-2.5 py-1 rounded-full border border-indigo-100">发单方版</span>
              </div>
              <p className="text-sm text-slate-500 mt-1">
                契约哈希: <span className="font-mono text-slate-400">dp_tx_8c72b9a1e4ff0183</span>
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3 self-start sm:self-center">
            <span className="flex h-2.5 w-2.5 relative">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
              <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500" />
            </span>
            <span className="text-sm font-medium text-slate-600">
              {isReleased ? "契约已安全结算" : "履约执行中 - 资金已锁存"}
            </span>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">

          <div className="lg:col-span-2 space-y-8">

            <div className="bg-white rounded-2xl border border-slate-100 shadow-md shadow-slate-100/50 p-6 relative overflow-hidden">
              <div className="absolute top-0 right-0 w-32 h-32 bg-indigo-50 rounded-full blur-3xl -z-10 opacity-60" />

              <div className="flex items-start justify-between">
                <div className="space-y-1">
                  <span className="text-xs font-semibold text-indigo-600 uppercase tracking-wider">隔离托管中枢</span>
                  <h3 className="text-lg font-bold text-slate-800">阶段性隔离锁定资金</h3>
                </div>
                <Coins className="w-6 h-6 text-indigo-500" />
              </div>

              <div className="mt-6 flex flex-col sm:flex-row items-baseline sm:gap-4 gap-2">
                <span className="text-4xl font-extrabold text-slate-900 font-mono">¥1,200.00</span>
                <span className="text-xs text-slate-400">
                  保障单号: <span className="font-mono">ESCROW-7729-A</span>
                </span>
              </div>

              <div className="mt-6 p-4 rounded-xl bg-slate-50 border border-slate-100 flex items-center gap-3">
                {isReleased ? (
                  <Unlock className="w-5 h-5 text-emerald-500 shrink-0" />
                ) : (
                  <Lock className="w-5 h-5 text-indigo-500 shrink-0 animate-pulse" />
                )}
                <div className="text-xs text-slate-600 leading-relaxed">
                  {isReleased ? (
                    <span className="text-emerald-700 font-medium">资金已成功解密并安全结算给服务商，履约闭环完成。</span>
                  ) : (
                    <span>交易资金已进入独立的阶段性隔离锁定。未经您允许，平台与任何第三方均无权调用，直到您点击验收。</span>
                  )}
                </div>
              </div>

              {!isReleased && (
                <div className="mt-6 flex gap-3">
                  <button
                    onClick={handleReleaseFunds}
                    className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white font-medium py-3 px-4 rounded-xl shadow-lg shadow-emerald-600/15 transition-all text-sm active:scale-[0.98]"
                  >
                    确认履约无误，一键解锁资金
                  </button>
                </div>
              )}
            </div>

            <div className="bg-white rounded-2xl border border-slate-100 shadow-md shadow-slate-100/50 p-6">
              <h3 className="text-lg font-bold text-slate-800 mb-6 flex items-center gap-2">
                <FileText className="w-5 h-5 text-indigo-500" />
                履约进度跟踪 (杭州滨江展台搭建)
              </h3>

              <div className="flow-root">
                <ul className="-mb-8">
                  <li>
                    <div className="relative pb-8">
                      <span className="absolute top-4 left-4 -ml-px h-full w-0.5 bg-indigo-200" aria-hidden="true" />
                      <div className="relative flex space-x-3">
                        <div>
                          <span className="h-8 w-8 rounded-full bg-indigo-50 border border-indigo-200 flex items-center justify-center ring-8 ring-white">
                            <CheckCircle2 className="w-5 h-5 text-indigo-600" />
                          </span>
                        </div>
                        <div className="flex-1 min-w-0 pt-1.5">
                          <p className="text-sm font-semibold text-slate-800">全网隐私脱敏广播</p>
                          <p className="text-xs text-slate-500 mt-0.5">大模型深度解析，1.2km 时空脱敏大纲已发布并完成撮合</p>
                          <span className="text-[10px] font-mono text-slate-400">已于 2026-07-16 12:00 完成</span>
                        </div>
                      </div>
                    </div>
                  </li>

                  <li>
                    <div className="relative pb-8">
                      <span className="absolute top-4 left-4 -ml-px h-full w-0.5 bg-indigo-200" aria-hidden="true" />
                      <div className="relative flex space-x-3">
                        <div>
                          <span className="h-8 w-8 rounded-full bg-indigo-50 border border-indigo-200 flex items-center justify-center ring-8 ring-white">
                            <Lock className="w-4 h-4 text-indigo-600" />
                          </span>
                        </div>
                        <div className="flex-1 min-w-0 pt-1.5">
                          <p className="text-sm font-semibold text-slate-800">交易资金进入独立的阶段性隔离锁定</p>
                          <p className="text-xs text-slate-500 mt-0.5">安全锁存 ¥1,200.00，系统启动一键单向解密通道</p>
                          <span className="text-[10px] font-mono text-slate-400">已于 2026-07-16 12:02 完成</span>
                        </div>
                      </div>
                    </div>
                  </li>

                  <li>
                    <div className="relative pb-8">
                      <span className="absolute top-4 left-4 -ml-px h-full w-0.5 bg-slate-200" aria-hidden="true" />
                      <div className="relative flex space-x-3">
                        <div>
                          <span className={`h-8 w-8 rounded-full flex items-center justify-center ring-8 ring-white ${
                            isReleased ? "bg-indigo-50 border border-indigo-200" : "bg-indigo-500 text-white animate-pulse"
                          }`}>
                            <Clock className={`w-4 h-4 ${isReleased ? "text-indigo-600" : "text-white"}`} />
                          </span>
                        </div>
                        <div className="flex-1 min-w-0 pt-1.5">
                          <p className="text-sm font-semibold text-slate-800">服务商进行现场执行交付</p>
                          <p className="text-xs text-slate-500 mt-0.5">履约方正前往杭州滨江展馆现场搭建中，准备上传实拍存证</p>
                          {!isReleased && (
                            <div className="mt-3 p-3 bg-slate-50 border border-dashed border-slate-200 rounded-lg flex items-center justify-between">
                              <span className="text-xs text-slate-500">待履约方上传"现场完工存证照"...</span>
                              <span className="text-[10px] bg-slate-100 px-2 py-0.5 rounded text-slate-500">等待中</span>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  </li>

                  <li>
                    <div className="relative pb-2">
                      <div className="relative flex space-x-3">
                        <div>
                          <span className={`h-8 w-8 rounded-full flex items-center justify-center ring-8 ring-white ${
                            isReleased ? "bg-emerald-50 border border-emerald-200 text-emerald-600" : "bg-slate-100 text-slate-400 border border-slate-200"
                          }`}>
                            <ShieldCheck className="w-5 h-5" />
                          </span>
                        </div>
                        <div className="flex-1 min-w-0 pt-1.5">
                          <p className={`text-sm font-semibold ${isReleased ? "text-slate-800" : "text-slate-400"}`}>验收解密与资金清结算</p>
                          <p className="text-xs text-slate-400 mt-0.5">双端完成评价，交付历史永久固化留档</p>
                        </div>
                      </div>
                    </div>
                  </li>
                </ul>
              </div>
            </div>

          </div>

          <div className="space-y-8">

            <div className="bg-white rounded-2xl border border-slate-100 shadow-md shadow-slate-100/50 p-6 relative overflow-hidden">
              <h3 className="text-lg font-bold text-slate-800 mb-6 flex items-center gap-2">
                <User className="w-5 h-5 text-indigo-500" />
                接单履约方信息
              </h3>

              <div className="space-y-5">
                <div className="flex items-center gap-4 p-3 bg-slate-50/50 rounded-xl border border-slate-100">
                  <div className="w-12 h-12 bg-indigo-600 text-white flex items-center justify-center font-bold text-lg rounded-xl shadow-md shadow-indigo-600/10">
                    筑
                  </div>
                  <div>
                    <h4 className="font-bold text-slate-800 text-sm">浙江筑梦会展服务队</h4>
                    <div className="flex items-center gap-1.5 mt-0.5">
                      <span className="text-[10px] bg-emerald-50 text-emerald-700 px-1.5 py-0.5 rounded font-medium">信用分 99.8%</span>
                      <span className="text-[10px] bg-slate-100 text-slate-500 px-1.5 py-0.5 rounded">距您 1.2km</span>
                    </div>
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-slate-400 flex items-center gap-1">
                    <MapPin className="w-3.5 h-3.5" /> 精准交付地址 (匹配后解密)
                  </label>
                  <div className="relative">
                    <div className={`p-3 rounded-xl border transition-all duration-300 text-sm font-medium ${
                      isDecrypted
                        ? "bg-slate-50 border-slate-100 text-slate-800"
                        : "bg-slate-100/30 border-slate-100/50 text-slate-400 select-none"
                    }`}>
                      <span className={isDecrypted ? "" : "blur-sm"}>
                        {isDecrypted ? "杭州滨江国际会展中心 3 号门展台 C-12" : "杭州市滨江区江虹路xxxxxxxxxx"}
                      </span>
                    </div>
                    {!isDecrypted && (
                      <div className="absolute right-3 top-1/2 -translate-y-1/2">
                        <Lock className="w-4 h-4 text-slate-400" />
                      </div>
                    )}
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-slate-400 flex items-center gap-1">
                    <Phone className="w-3.5 h-3.5" /> 履约方直连热线 (加密保护)
                  </label>
                  <div className="relative">
                    <div className={`p-3 rounded-xl border transition-all duration-300 text-sm font-medium ${
                      isDecrypted
                        ? "bg-slate-50 border-slate-100 text-slate-800"
                        : "bg-slate-100/30 border-slate-100/50 text-slate-400 select-none"
                    }`}>
                      <span className={isDecrypted ? "" : "blur-sm font-mono"}>
                        {isDecrypted ? "138-5800-1122 (张队)" : "138-xxxx-xxxx"}
                      </span>
                    </div>
                    {!isDecrypted && (
                      <div className="absolute right-3 top-1/2 -translate-y-1/2">
                        <Lock className="w-4 h-4 text-slate-400" />
                      </div>
                    )}
                  </div>
                </div>

                {!isDecrypted ? (
                  <button
                    onClick={handleDecrypt}
                    disabled={isDecrypting}
                    className="w-full mt-2 bg-slate-900 hover:bg-slate-800 disabled:bg-slate-700 text-white font-medium py-3 px-4 rounded-xl shadow-lg transition-all text-xs flex items-center justify-center gap-2 active:scale-[0.98]"
                  >
                    {isDecrypting ? (
                      <>
                        <span className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent" />
                        <span>正在通过多方密钥安全解密中...</span>
                      </>
                    ) : (
                      <>
                        <Eye className="w-4 h-4" />
                        <span>🔑 安全单向解密 (Decrypt Contact)</span>
                      </>
                    )}
                  </button>
                ) : (
                  <div className="p-3 bg-emerald-50 border border-emerald-100 rounded-xl flex items-center gap-2 text-xs text-emerald-800">
                    <ShieldCheck className="w-4 h-4 text-emerald-600 shrink-0" />
                    <span>单向隐私安全解密成功！此通话及精确时空数据已单向在您与接单方之间建立对等加密通道。</span>
                  </div>
                )}
              </div>
            </div>

            <div className="bg-white rounded-2xl border border-slate-100 shadow-md shadow-slate-100/50 p-6">
              <h3 className="text-sm font-bold text-slate-800 mb-4 flex items-center justify-between">
                <span>现场执行存证凭证</span>
                <span className="text-[10px] font-mono font-normal text-slate-400 flex items-center gap-1">
                  IPFS 存证 <ExternalLink className="w-2.5 h-2.5" />
                </span>
              </h3>

              <div className="p-4 bg-slate-50 border border-dashed border-slate-200 rounded-xl text-center space-y-2">
                <div className="w-10 h-10 bg-slate-100 rounded-full flex items-center justify-center mx-auto text-slate-400">
                  <FileText className="w-5 h-5" />
                </div>
                <p className="text-xs text-slate-500">待履约团队到达杭州滨江展馆现场后</p>
                <p className="text-[10px] text-slate-400">其实拍的"物料现场照"与"GPS签到日志"将自动在此处生成并脱敏上链</p>
              </div>
            </div>

          </div>

        </div>

      </div>
    </div>
  )
}
