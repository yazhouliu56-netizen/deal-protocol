"use client";
import { motion } from "framer-motion";
import { ArrowLeft, Check } from "lucide-react";
import type { Booking } from "@/store/useAppStore";

const CATEGORY_EMOJI: Record<string, string> = {
  羽毛球约局: "🏸",
  摄影师约拍: "📷",
  家政保洁: "🧹",
};

export default function OrderDetail({
  booking,
  onBack,
  onReview,
  cancelBooking,
}: {
  booking: Booking;
  onBack: () => void;
  onReview: () => void;
  cancelBooking: (id: string) => void;
}) {
  return (
    <div className="pointer-events-auto flex flex-col gap-4">
      <button
        onClick={onBack}
        className="flex items-center gap-1.5 text-[12px] text-white/88 hover:text-white w-fit"
      >
        <ArrowLeft size={14} /> 返回订单列表
      </button>

      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className="glass-panel rounded-3xl p-4"
      >
        <div className="flex items-center gap-3 mb-3">
          <div className="w-11 h-11 rounded-xl glass-panel flex items-center justify-center text-xl">
            {CATEGORY_EMOJI[booking.category] ?? "🎟️"}
          </div>
          <div className="flex-1 min-w-0">
            <h2 className="text-[14px] font-extrabold truncate">
              {booking.providerName}
            </h2>
            <p className="text-xs text-white/68">{booking.category}</p>
          </div>
          <span
            className={`text-xs px-2 py-1 rounded-full font-semibold shrink-0 ${
              booking.status === "upcoming"
                ? "bg-brandPurple/20 border border-brandPurple/40 text-brandPurple"
                : booking.status === "cancelled"
                  ? "bg-white/10 border border-white/20 text-white/68"
                  : "bg-emerald-400/10 border border-emerald-400/30 text-emerald-400"
            }`}
          >
            {booking.status === "upcoming"
              ? "已预订"
              : booking.status === "cancelled"
                ? "已取消"
                : "已完成"}
          </span>
        </div>

        <div className="flex flex-col gap-2 border-t border-white/10 pt-3 text-[13px]">
          {[
            { k: "服务", v: booking.category },
            { k: "对象", v: booking.providerName },
            { k: "时段", v: booking.time },
            { k: "价格", v: booking.price },
            { k: "订单号", v: booking.id.slice(0, 8).toUpperCase() },
          ].map((line) => (
            <div key={line.k} className="flex gap-2">
              <span className="text-white/68 w-12 shrink-0">{line.k}</span>
              <span className="text-white/95">{line.v}</span>
            </div>
          ))}
        </div>
      </motion.div>

      {booking.status === "cancelled" ? (
        <div className="glass-panel rounded-2xl p-4">
          <h3 className="text-xs font-bold text-white/88 mb-3">履约进度</h3>
          <div className="flex items-center gap-2 text-[13px] text-white/68">
            <span className="w-5 h-5 rounded-full bg-white/10 border border-white/20 flex items-center justify-center text-xs">✕</span>
            订单已取消，工作台对应待接单已同步撤回
          </div>
        </div>
      ) : (
        <div className="glass-panel rounded-2xl p-4">
        <h3 className="text-xs font-bold text-white/88 mb-3">履约进度</h3>
        <div className="flex flex-col gap-3">
          {[
            { label: "AI 撮合完成", done: true },
            { label: "已预订", done: true },
            { label: "线下履约", done: booking.status === "completed" },
            { label: "完成并评价", done: booking.status === "completed" },
          ].map((step, i) => (
            <div key={step.label} className="flex items-center gap-2.5">
              <div
                className={`w-5 h-5 rounded-full flex items-center justify-center shrink-0 ${
                  step.done
                    ? "bg-emerald-400/15 border border-emerald-400/50 text-emerald-400"
                    : "bg-white/[0.06] border border-white/15 text-white/68"
                }`}
              >
                {step.done ? <Check size={11} /> : <span className="text-xs">{i + 1}</span>}
              </div>
              <span
                className={`text-[13px] ${
                  step.done ? "text-white/95" : "text-white/68"
                }`}
              >
                {step.label}
              </span>
              {i < 3 && (
                <div
                  className={`flex-1 h-px ${
                    [true, true, booking.status === "completed", false][i + 1]
                      ? "bg-emerald-400/40"
                      : "bg-white/10"
                  }`}
                />
              )}
            </div>
          ))}
        </div>
      </div>
      )}

      {booking.status === "upcoming" && (
        <button
          onClick={onReview}
          className="w-full py-2.5 rounded-2xl btn-primary text-xs font-bold glow-purple-strong active:scale-[0.99]"
        >
          评价这次服务
        </button>
      )}
      {booking.status === "upcoming" && (
        <button
          onClick={() => {
            cancelBooking(booking.id);
          }}
          className="w-full py-2.5 rounded-2xl glass-panel text-xs font-bold text-white/88 hover:text-red-400 hover:border-red-400/40 transition-colors active:scale-[0.99]"
        >
          取消订单
        </button>
      )}
    </div>
  );
}
