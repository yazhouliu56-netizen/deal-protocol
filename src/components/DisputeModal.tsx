"use client";

import React, { useState } from "react";
import { toast } from "react-hot-toast";
import { AlertTriangle, X, Upload } from "lucide-react";

interface DisputeModalProps {
  isOpen: boolean;
  onClose: () => void;
  orderId: string;
  orderAmount: number;
  onSuccess?: () => void;
}

export default function DisputeModal({ isOpen, onClose, orderId, orderAmount, onSuccess }: DisputeModalProps) {
  const [reason, setReason] = useState<string>("");
  const [refundAmount, setRefundAmount] = useState<number>(orderAmount);
  const [evidenceUrl, setEvidenceUrl] = useState<string>("");
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!reason.trim()) {
      toast.error("请详细填写维权申请原因");
      return;
    }

    if (refundAmount < 0 || refundAmount > orderAmount) {
      toast.error(`退款金额必须介于 ¥0 与订单总额 ¥${orderAmount} 之间`);
      return;
    }

    setIsSubmitting(true);
    const toastId = toast.loading("提交维权申请并冻结资金账户...");

    try {
      const res = await fetch("/api/disputes/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          orderId,
          reason: reason.trim(),
          requestedRefundAmount: refundAmount,
          evidenceUrls: evidenceUrl.trim() ? [evidenceUrl.trim()] : []
        })
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "提交维权申请失败");

      toast.success("维权流程已发起，托管资金保全冻结中", { id: toastId });
      if (onSuccess) onSuccess();
      onClose();
    } catch (err: any) {
      toast.error(`申请失败: ${err.message}`, { id: toastId });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-zinc-900 border border-zinc-800 w-full max-w-lg rounded-2xl p-6 space-y-5 relative shadow-2xl">
        <button onClick={onClose} className="absolute top-4 right-4 text-zinc-500 hover:text-zinc-300">
          <X className="w-4 h-4"/>
        </button>

        <div className="flex items-center gap-3 border-b border-zinc-800 pb-4">
          <div className="p-2 bg-amber-500/10 border border-amber-500/20 rounded-xl text-amber-400">
            <AlertTriangle className="w-5 h-5"/>
          </div>
          <div>
            <h2 className="text-base font-bold text-zinc-100">发起订单维权 / 争议仲裁</h2>
            <p className="text-xs text-zinc-400 mt-0.5">发起后相关托管资金将暂存至平台仲裁池</p>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-zinc-300 mb-1.5">争议原因与说明 *</label>
            <textarea
              rows={4}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="请详述争议事实，如：未按需求交付、存在致命Bug或严重超时等..."
              className="w-full bg-zinc-950 border border-zinc-800 rounded-xl p-3 text-xs text-zinc-100 placeholder-zinc-600 focus:outline-none focus:border-amber-500 transition"
              required
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-zinc-300 mb-1.5">申诉退款金额 (元)</label>
            <div className="relative">
              <span className="absolute left-3 top-3 text-xs font-mono text-zinc-500">¥</span>
              <input
                type="number"
                min="0"
                max={orderAmount}
                step="0.01"
                value={refundAmount}
                onChange={(e) => setRefundAmount(parseFloat(e.target.value) || 0)}
                className="touch-target w-full bg-zinc-950 border border-zinc-800 rounded-xl pl-8 pr-3 py-2.5 text-xs font-mono text-zinc-100 focus:outline-none focus:border-amber-500 transition"
              />
            </div>
            <p className="text-[10px] text-zinc-500 mt-1">最高不可超过总订单额 ¥{orderAmount.toLocaleString()}</p>
          </div>

          <div>
            <label className="block text-xs font-medium text-zinc-300 mb-1.5">举证链接 / 文件地址 (可选)</label>
            <div className="relative">
              <input
                type="url"
                value={evidenceUrl}
                onChange={(e) => setEvidenceUrl(e.target.value)}
                placeholder="https://..."
                className="touch-target w-full bg-zinc-950 border border-zinc-800 rounded-xl pl-9 pr-3 py-2.5 text-xs font-mono text-zinc-100 focus:outline-none focus:border-amber-500 transition"
              />
              <Upload className="w-3.5 h-3.5 text-zinc-500 absolute left-3 top-3.5"/>
            </div>
          </div>

          <div className="p-3 bg-amber-500/5 border border-amber-500/10 rounded-xl text-[11px] text-amber-300/80 leading-relaxed">
            提醒：发起维权后，平台裁决委员会与 AI 逻辑核验器将对双方交互记录、代码库提交记录进行综合评定。
          </div>

          <div className="flex justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="touch-target px-4 py-2.5 bg-zinc-800 hover:bg-zinc-700 active:scale-95 text-zinc-300 text-xs font-medium rounded-xl transition-transform"
            >
              取消
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="touch-target px-4 py-2.5 bg-amber-600 hover:bg-amber-500 active:bg-amber-700 active:scale-95 disabled:bg-amber-600/50 text-white text-xs font-semibold rounded-xl transition-transform shadow-lg shadow-amber-600/10"
            >
              {isSubmitting ? "正在锁定资金..." : "提交维权申诉"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
