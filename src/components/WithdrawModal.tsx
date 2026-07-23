"use client";

import React, { useState } from "react";
import { toast } from "react-hot-toast";
import { Wallet, X, CreditCard, Building, ArrowRight } from "lucide-react";

interface WithdrawModalProps {
  isOpen: boolean;
  onClose: () => void;
  availableBalance: number;
  onSuccess?: () => void;
}

export default function WithdrawModal({ isOpen, onClose, availableBalance, onSuccess }: WithdrawModalProps) {
  const [amount, setAmount] = useState<number>(availableBalance);
  const [payoutMethod, setPayoutMethod] = useState<string>("ALIPAY");
  const [accountInfo, setAccountInfo] = useState<string>("");
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (amount <= 0 || amount > availableBalance) {
      toast.error(`有效提现金额需介于 ¥1 与可用余额 ¥${availableBalance.toLocaleString()} 之间`);
      return;
    }

    if (!accountInfo.trim()) {
      toast.error("请输入提现收款账号信息");
      return;
    }

    setIsSubmitting(true);
    const toastId = toast.loading("正在发起提现审核与资金划转指令...");

    try {
      const res = await fetch("/api/finance/withdraw", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          amount,
          payoutMethod,
          accountInfo: accountInfo.trim()
        })
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "提现申请提交失败");

      toast.success("提现申请已提交，预计 1-2 个工作日内到账", { id: toastId });
      if (onSuccess) onSuccess();
      onClose();
    } catch (err: any) {
      toast.error(`提现失败: ${err.message}`, { id: toastId });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-zinc-900 border border-zinc-800 w-full max-w-md rounded-2xl p-6 space-y-5 relative shadow-2xl">
        <button onClick={onClose} className="absolute top-4 right-4 text-zinc-500 hover:text-zinc-300" aria-label="关闭提现弹窗">
          <X className="w-4 h-4"/>
        </button>

        <div className="flex items-center gap-3 border-b border-zinc-800 pb-4">
          <div className="p-2.5 bg-emerald-500/10 border border-emerald-500/20 rounded-xl text-emerald-400">
            <Wallet className="w-5 h-5"/>
          </div>
          <div>
            <h2 className="text-base font-bold text-zinc-100">发起收益提现</h2>
            <p className="text-xs text-zinc-400 mt-0.5">当前实时可用余额: <span className="font-mono text-emerald-400 font-bold">¥{availableBalance.toLocaleString()}</span></p>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-zinc-300 mb-1.5">选择收款方式</label>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setPayoutMethod("ALIPAY")}
                className={`flex items-center gap-2 p-3 rounded-xl border text-xs font-medium transition ${
                  payoutMethod === "ALIPAY"
                    ? "bg-indigo-500/10 border-indigo-500 text-indigo-300"
                    : "bg-zinc-950 border-zinc-800 text-zinc-400 hover:border-zinc-700"
                }`}
              >
                <CreditCard className="w-4 h-4 text-indigo-400"/> 支付宝账号
              </button>
              <button
                type="button"
                onClick={() => setPayoutMethod("BANK")}
                className={`flex items-center gap-2 p-3 rounded-xl border text-xs font-medium transition ${
                  payoutMethod === "BANK"
                    ? "bg-indigo-500/10 border-indigo-500 text-indigo-300"
                    : "bg-zinc-950 border-zinc-800 text-zinc-400 hover:border-zinc-700"
                }`}
              >
                <Building className="w-4 h-4 text-emerald-400"/> 银行卡转账
              </button>
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-zinc-300 mb-1.5">提现金额 (元)</label>
            <div className="relative">
              <span className="absolute left-3 top-2.5 text-xs font-mono text-zinc-500">¥</span>
              <input
                type="number"
                min="1"
                max={availableBalance}
                step="0.01"
                value={amount}
                onChange={(e) => setAmount(parseFloat(e.target.value) || 0)}
                className="w-full bg-zinc-950 border border-zinc-800 rounded-xl pl-8 pr-16 py-2 text-xs font-mono text-zinc-100 focus:outline-none focus:border-indigo-500 transition"
              />
              <button
                type="button"
                onClick={() => setAmount(availableBalance)}
                className="absolute right-2 top-2 text-[10px] font-mono text-indigo-400 hover:text-indigo-300 bg-indigo-500/10 px-2 py-0.5 rounded"
              >
                全部提现
              </button>
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-zinc-300 mb-1.5">
              {payoutMethod === "ALIPAY" ? "支付宝账号 / 手机号" : "开户行及银行卡号"}
            </label>
            <input
              type="text"
              value={accountInfo}
              onChange={(e) => setAccountInfo(e.target.value)}
              placeholder={payoutMethod === "ALIPAY" ? "如 user@example.com 或 13800000000" : "招商银行 621483******1234"}
              className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3 py-2 text-xs text-zinc-100 placeholder-zinc-600 focus:outline-none focus:border-indigo-500 transition"
              required
            />
          </div>

          <div className="p-3 bg-zinc-950 border border-zinc-800 rounded-xl text-[11px] text-zinc-400 space-y-1">
            <div className="flex justify-between">
              <span>提现手续费 (0%)</span>
              <span className="font-mono text-emerald-400">¥0.00</span>
            </div>
            <div className="flex justify-between font-semibold text-zinc-200 pt-1 border-t border-zinc-800">
              <span>预计实际到账</span>
              <span className="font-mono text-indigo-400">¥{amount.toLocaleString()}</span>
            </div>
          </div>

          <div className="flex justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-xs font-medium rounded-xl transition"
            >
              取消
            </button>
            <button
              type="submit"
              disabled={isSubmitting || amount <= 0}
              className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 disabled:bg-indigo-600/50 text-white text-xs font-semibold rounded-xl transition shadow-lg shadow-indigo-600/10 flex items-center gap-1.5"
            >
              {isSubmitting ? "正在处理..." : <>确认提现 <ArrowRight className="w-3.5 h-3.5"/></>}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
