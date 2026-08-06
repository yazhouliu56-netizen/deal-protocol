"use client";
import { useRef, useState } from "react";
import { createPortal } from "react-dom";
import { motion } from "framer-motion";
import { CreditCard, Lock } from "lucide-react";
import { FREE_PUBLISH_PER_DAY } from "@/lib/pay";

/**
 * PaySheet — 模拟即时支付（随单支付）。
 * 真钱管线（微信支付/支付宝）在 P5；这里用「确认已支付」模拟：
 * 支付成功 → 回调 onPaid → 上层调 store（payWave / payJoin 等）。
 * UX 对齐真实三方收银台：金额 + 支付方式 + 确认按钮 + 倒计时（心理占位）。
 */
export default function PaySheet({
  open,
  amount,
  onCancel,
  onPaid,
  title = "确认支付",
  desc,
  fee = 0,
}: {
  open: boolean;
  amount: number;
  onCancel: () => void;
  onPaid: () => void;
  title?: string;
  desc?: string;
  /** 发布费（独立于单子金额，一经支付不退）— 展示两笔并列。 */
  fee?: number;
}) {
  const [countdown, setCountdown] = useState(300); // 5 分钟占位
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);

  if (!open) {
    if (timer.current) {
      clearInterval(timer.current);
      timer.current = null;
    }
    return null;
  }

  if (!timer.current) {
    timer.current = setInterval(() => {
      setCountdown((c) => (c > 0 ? c - 1 : 0));
    }, 1000);
  }

  const mm = String(Math.floor(countdown / 60)).padStart(2, "0");
  const ss = String(countdown % 60).padStart(2, "0");

  return createPortal(
    <>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-[60] bg-black/60 backdrop-blur-sm"
        onClick={onCancel}
      />
      <motion.div
        initial={{ y: 60, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ type: "spring", stiffness: 300, damping: 28 }}
        className="fixed inset-x-3 bottom-8 z-[60] glass-panel rounded-3xl p-5"
      >
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-[13px] font-extrabold flex items-center gap-1.5">
            <CreditCard size={13} className="text-brandCyan" /> {title}
          </h3>
          <button
            onClick={onCancel}
            aria-label="取消支付"
            className="text-white/40 hover:text-white"
          >
            ✕
          </button>
        </div>

        <div className="rounded-2xl bg-white/[0.05] border border-white/10 p-4 mb-3 text-center">
          <p className="text-[10px] text-white/45 mb-1">{desc ?? "应付金额"}</p>
          <p className="text-[28px] font-extrabold text-brandCyan leading-none">
            ¥{amount}
          </p>
          {fee > 0 && (
            <p className="text-[9.5px] text-white/50 mt-1.5">
              含发布费 ¥{fee}（超出每日 {FREE_PUBLISH_PER_DAY} 次免费后的固定发布费，一经支付不退） · 单子金额 ¥{amount - fee}
            </p>
          )}
        </div>

        <button
          onClick={() => {
            if (timer.current) {
              clearInterval(timer.current);
              timer.current = null;
            }
            onPaid();
          }}
          aria-label={`立即支付 ${amount} 元`}
          className="w-full py-3 rounded-2xl btn-primary font-extrabold text-xs glow-purple-strong hover:brightness-110 active:scale-[0.98] transition-[filter,transform]"
        >
          立即支付 ¥{amount}（模拟）
        </button>

        <div className="flex items-center justify-between mt-3 text-[9px] text-white/40">
          <span className="flex items-center gap-1">
            <Lock size={9} /> 随单支付 · 未上线不展示
          </span>
          <span>
            占位 {mm}:{ss} <span className="text-white/25">(模拟通道)</span>
          </span>
        </div>
      </motion.div>
    </>,
    document.body
  );
}