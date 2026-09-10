"use client";
import DuoButton from "@/components/ui/DuoButton";
import SheetShell, { SheetClose } from "@/components/ui/SheetShell";
import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { CreditCard, Lock } from "lucide-react";
import { FREE_PUBLISH_PER_DAY } from "@/base/money/pay";

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

  // Timer lifecycle lives in an effect (refs are not safe during render).
  // The parent keys <PaySheet> on the payment session, so each open mounts
  // fresh with countdown already at 300 — no reset needed inside the effect.
  useEffect(() => {
    if (!open) return;
    const timer = setInterval(() => {
      setCountdown((c) => (c > 0 ? c - 1 : 0));
    }, 1000);
    return () => clearInterval(timer);
  }, [open]);

  if (!open) return null;

  const mm = String(Math.floor(countdown / 60)).padStart(2, "0");
  const ss = String(countdown % 60).padStart(2, "0");

  return createPortal(
    <SheetShell
      onClose={onCancel}
      maskClassName="fixed inset-0 z-[60] bg-black/60"
      panelClassName="fixed inset-x-3 bottom-8 z-[60] bg-white border-2 border-[var(--color-duo-swan)] border-b-[6px] rounded-3xl p-5"
      motion={{ y: 60, stiffness: 300, damping: 28 }}
    >
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-[13px] font-extrabold flex items-center gap-1.5">
            <CreditCard size={13} className="text-[var(--color-duo-blue)]" /> {title}
          </h3>
          <SheetClose onClose={onCancel} label="取消支付" />
        </div>

        <div className="rounded-2xl bg-[var(--color-duo-polar)] border border-[var(--color-duo-swan)] p-4 mb-3 text-center">
          <p className="text-xs text-[var(--color-duo-wolf)] mb-1">{desc ?? "应付金额"}</p>
          <p className="text-[28px] font-extrabold text-[var(--color-duo-green-ink)] leading-none font-tabular">
            ¥{amount}
          </p>
          {fee > 0 && (
            <p className="text-xs text-[var(--color-duo-wolf)] mt-1.5">
              含发布费 ¥{fee}（超出每日 {FREE_PUBLISH_PER_DAY} 次免费后的固定发布费，一经支付不退） · 单子金额 ¥{amount - fee}
            </p>
          )}
        </div>

        <DuoButton
          onClick={onPaid}
          aria-label={`立即支付 ${amount} 元`}
          variant="primary"
          size="md"
          fullWidth
        >
          立即支付 ¥{amount}（模拟）
        </DuoButton>

        <div className="flex items-center justify-between mt-3 text-xs text-[var(--color-duo-wolf)]">
          <span className="flex items-center gap-1">
            <Lock size={9} /> 随单支付 · 未上线不展示
          </span>
          <span>
            支付锁定剩余 {mm}:{ss} <span className="text-[var(--color-duo-wolf)]">(模拟通道)</span>
          </span>
        </div>
    </SheetShell>,
    document.body
  );
}