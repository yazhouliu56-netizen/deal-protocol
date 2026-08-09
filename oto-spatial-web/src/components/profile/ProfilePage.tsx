"use client";
import { useState } from "react";
import { motion } from "framer-motion";
import {
  ArrowLeft,
  ArrowRightLeft,
  BadgeCheck,
  Check,
  MapPin,
  Star,
} from "lucide-react";
import { useAppStore, type Booking } from "@/store/useAppStore";
import { useIdentityStore } from "@/store/useIdentityStore";
import WorkerWorkbench from "./WorkerWorkbench";
import WalletView from "@/components/waves/WalletView";
import CapabilityPanel from "@/components/waves/CapabilityPanel";
import MyClaims from "@/components/waves/MyClaims";
import FriendList from "@/components/waves/FriendList";

const CATEGORY_EMOJI: Record<string, string> = {
  羽毛球约局: "🏸",
  摄影师约拍: "📷",
  家政保洁: "🧹",
};

/**
 * 个人中心（M3）：资料 + 我的订单列表 → 订单详情 → 星级评价。
 * G-5：未登录即访客本地模式 —— 顶部常驻数据来源说明，本地功能全可用。
 */
export default function ProfilePage({
  onGoHome,
}: { onGoHome?: () => void } = {}) {
  const bookings = useAppStore((s) => s.bookings);
  const reviews = useAppStore((s) => s.reviews);
  const selectedBookingId = useAppStore((s) => s.selectedBookingId);
  const setSelectedBooking = useAppStore((s) => s.setSelectedBooking);
  const cancelBooking = useAppStore((s) => s.cancelBooking);
  const identity = useIdentityStore((s) => s.identity);

  const [showReviewFor, setShowReviewFor] = useState<string | null>(null);
  const [view, setView] = useState<"profile" | "workbench">("profile");

  const selected = bookings.find((b) => b.id === selectedBookingId) ?? null;

  if (view === "workbench") {
    return <WorkerWorkbench onBack={() => setView("profile")} />;
  }
  if (selected && showReviewFor !== selected.id) {
    return (
      <OrderDetail
        booking={selected}
        onBack={() => setSelectedBooking(null)}
        onReview={() => setShowReviewFor(selected.id)}
        cancelBooking={(id) => cancelBooking(id)}
      />
    );
  }
  if (selected && showReviewFor === selected.id) {
    return (
      <ReviewForm
        booking={selected}
        onBack={() => setShowReviewFor(null)}
      />
    );
  }

  const upcoming = bookings.filter((b) => b.status === "upcoming").length;
  const reviewed = reviews.length;

  return (
    <div className="pointer-events-auto flex flex-col gap-4">
      {/* G-5 访客引导：数据来源 + 本地模式入口（登录后提示云端，由数据化替换） */}
      <div className="flex items-center gap-2 px-3 py-2.5 rounded-2xl bg-brandPurple/[0.08] border border-brandPurple/25">
        <span className="text-[11px]">💠</span>
        <p className="flex-1 min-w-0 text-[9.5px] text-white/55">
          访客 · 本地演示身份「{identity.nickname}」 · 数据存本机浏览器
        </p>
        <button
          onClick={() => window.dispatchEvent(new Event("oto:env-info"))}
          aria-label="了解数据模式"
          className="shrink-0 px-2 py-1 rounded-full bg-white/5 border border-white/10 text-[9px] font-bold text-brandPurple-foreground hover:bg-white/10 transition-colors"
        >
          数据模式
        </button>
        {onGoHome && (
          <button
            onClick={onGoHome}
            className="shrink-0 px-2 py-1 rounded-full btn-primary text-[9px] font-bold"
          >
            去雷达
          </button>
        )}
      </div>

      {/* 资料卡 */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
        className="glass-panel rounded-3xl p-4 flex items-center gap-3"
      >
        <div className="w-14 h-14 rounded-2xl btn-primary flex items-center justify-center text-xl font-extrabold shadow-lg glow-purple-strong">
          A
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5">
            <span className="text-[15px] font-extrabold">Alex</span>
            <BadgeCheck size={14} className="text-brandCyan" />
          </div>
          <p className="text-[10px] text-white/50 mt-0.5">
            线下体验玩家 · 已撮合 {bookings.length} 单
          </p>
        </div>
        <span className="text-[9px] px-2 py-1 rounded-full bg-brandPurple/15 border border-brandPurple/30 text-brandPurple font-semibold shrink-0">
          钻石会员
        </span>
      </motion.div>

      {/* 统计 */}
      <div className="grid grid-cols-3 gap-2.5">
        {[
          { label: "总订单", value: bookings.length },
          { label: "待出行", value: upcoming },
          { label: "已评价", value: reviewed },
        ].map((s) => (
          <div
            key={s.label}
            className="glass-panel rounded-2xl py-3 flex flex-col items-center gap-0.5"
          >
            <span className="text-lg font-extrabold bg-clip-text text-transparent bg-linear-to-r from-brandCyan to-brandPurple">
              {s.value}
            </span>
            <span className="text-[10px] text-white/50">{s.label}</span>
          </div>
        ))}
      </div>

      {/* 服务者工作台入口 */}
      <button
        onClick={() => setView("workbench")}
        className="glass-panel rounded-2xl p-3.5 flex items-center gap-3 text-left hover:border-brandPurple/50 transition-colors active:scale-[0.99]"
      >
        <div className="w-10 h-10 rounded-xl btn-primary flex items-center justify-center shrink-0 glow-purple-strong">
          <ArrowRightLeft size={16} />
        </div>
        <div className="flex-1 min-w-0">
          <span className="text-[12.5px] font-bold block">服务者工作台</span>
          <span className="text-[10px] text-white/50 block mt-0.5 truncate">
            切到服务者视角 · 接单 / 履约 / 收益
          </span>
        </div>
        <span className="text-white/30 text-lg shrink-0">›</span>
      </button>

      {/* P2P 钱包与信用前台 */}
      <WalletView />

      {/* 能力声明编辑 */}
      <CapabilityPanel />

      {/* 我的接单（响应者视角） */}
      <MyClaims />

      {/* S3 关系沉淀：好友 + 待确认的转友请求 */}
      <FriendList />

      {/* 我的订单 */}
      <div>
        <h3 className="text-[13px] font-bold mb-2 flex items-center gap-1.5">
          <span className="w-1 h-3.5 rounded-full bg-linear-to-b from-brandCyan to-brandPurple" />
          我的订单
        </h3>
        {bookings.length === 0 ? (
          <div className="glass-panel rounded-2xl p-4 text-center">
            <p className="text-[11px] text-white/40">
              还没有订单——去 AI 助手说句需求，马上撮合
            </p>
          </div>
        ) : (
          <div className="flex flex-col gap-2">
            {bookings.map((b) => (
              <BookingRow
                key={b.id}
                booking={b}
                onClick={() => setSelectedBooking(b.id)}
              />
            ))}
          </div>
        )}
      </div>

      {/* 偏好（静态占位） */}
      <div className="glass-panel rounded-2xl p-3.5">
        <h3 className="text-[11px] font-bold text-white/70 mb-2">
          撮合偏好
        </h3>
        <div className="flex flex-wrap gap-1.5">
          {["活动范围 5 公里内", "预算 ¥50/局", "业余水平", "周末出行"].map(
            (p) => (
              <span
                key={p}
                className="text-[10px] px-2.5 py-1 rounded-full bg-white/[0.06] border border-white/10 text-white/60"
              >
                {p}
              </span>
            )
          )}
        </div>
      </div>
    </div>
  );
}

function BookingRow({
  booking,
  onClick,
}: {
  booking: Booking;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className="w-full glass-panel rounded-2xl p-3 flex items-center gap-3 text-left hover:border-brandPurple/50 transition-colors active:scale-[0.99]"
    >
      <div className="w-10 h-10 rounded-xl glass-panel flex items-center justify-center text-lg shrink-0">
        {CATEGORY_EMOJI[booking.category] ?? "🎟️"}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="text-[12.5px] font-bold truncate">
            {booking.providerName}
          </span>
          <span
            className={`text-[9px] px-1.5 py-px rounded-full font-semibold shrink-0 ${
              booking.status === "upcoming"
                ? "bg-brandPurple/20 border border-brandPurple/40 text-brandPurple"
                : booking.status === "cancelled"
                  ? "bg-white/10 border border-white/20 text-white/50"
                  : "bg-emerald-400/10 border border-emerald-400/30 text-emerald-400"
            }`}
          >
            {booking.status === "upcoming"
              ? "待出行"
              : booking.status === "cancelled"
                ? "已取消"
                : "已完成"}
          </span>
        </div>
        <p className="text-[10px] text-white/50 mt-0.5 truncate">
          {booking.time} · {booking.category}
        </p>
      </div>
      <span className="text-[12px] font-extrabold text-brandCyan shrink-0">
        {booking.price}
      </span>
    </button>
  );
}

function OrderDetail({
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
        className="flex items-center gap-1.5 text-[12px] text-white/60 hover:text-white w-fit"
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
            <p className="text-[10px] text-white/50">{booking.category}</p>
          </div>
          <span
            className={`text-[10px] px-2 py-1 rounded-full font-semibold shrink-0 ${
              booking.status === "upcoming"
                ? "bg-brandPurple/20 border border-brandPurple/40 text-brandPurple"
                : booking.status === "cancelled"
                  ? "bg-white/10 border border-white/20 text-white/50"
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

        <div className="flex flex-col gap-2 border-t border-white/10 pt-3 text-[11.5px]">
          {[
            { k: "服务", v: booking.category },
            { k: "对象", v: booking.providerName },
            { k: "时段", v: booking.time },
            { k: "价格", v: booking.price },
            { k: "订单号", v: booking.id.slice(0, 8).toUpperCase() },
          ].map((line) => (
            <div key={line.k} className="flex gap-2">
              <span className="text-white/40 w-12 shrink-0">{line.k}</span>
              <span className="text-white/85">{line.v}</span>
            </div>
          ))}
        </div>
      </motion.div>

      {/* 履约时间线 */}
      {booking.status === "cancelled" ? (
        <div className="glass-panel rounded-2xl p-4">
          <h3 className="text-[11px] font-bold text-white/70 mb-3">履约进度</h3>
          <div className="flex items-center gap-2 text-[11.5px] text-white/45">
            <span className="w-5 h-5 rounded-full bg-white/10 border border-white/20 flex items-center justify-center text-[9px]">✕</span>
            订单已取消，工作台对应待接单已同步撤回
          </div>
        </div>
      ) : (
        <div className="glass-panel rounded-2xl p-4">
        <h3 className="text-[11px] font-bold text-white/70 mb-3">履约进度</h3>
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
                    : "bg-white/[0.06] border border-white/15 text-white/30"
                }`}
              >
                {step.done ? <Check size={11} /> : <span className="text-[9px]">{i + 1}</span>}
              </div>
              <span
                className={`text-[11.5px] ${
                  step.done ? "text-white/85" : "text-white/35"
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
          className="w-full py-2.5 rounded-2xl glass-panel text-xs font-bold text-white/60 hover:text-red-400 hover:border-red-400/40 transition-colors active:scale-[0.99]"
        >
          取消订单
        </button>
      )}
    </div>
  );
}

function ReviewForm({ booking, onBack }: { booking: Booking; onBack: () => void }) {
  const addReview = useAppStore((s) => s.addReview);
  const updateBookingStatus = useAppStore((s) => s.updateBookingStatus);
  const [rating, setRating] = useState(0);
  const [comment, setComment] = useState("");
  const [submitted, setSubmitted] = useState(false);

  function submit() {
    if (rating === 0) return;
    addReview({
      bookingId: booking.id,
      rating,
      comment: comment.trim(),
      createdAt: Date.now(),
    });
    updateBookingStatus(booking.id, "completed");
    setSubmitted(true);
  }

  if (submitted) {
    return (
      <motion.div
        initial={{ opacity: 0, scale: 0.96 }}
        animate={{ opacity: 1, scale: 1 }}
        className="pointer-events-auto glass-panel rounded-3xl p-6 text-center flex flex-col items-center gap-2"
      >
        <div className="w-12 h-12 rounded-2xl bg-emerald-400/10 border border-emerald-400/40 flex items-center justify-center">
          <Check size={22} className="text-emerald-400" />
        </div>
        <h2 className="text-[15px] font-extrabold">感谢评价！</h2>
        <p className="text-[11px] text-white/50">
          你的反馈会帮助 AI 撮合更准～ 已记录 {rating} 星
        </p>
        <button
          onClick={onBack}
          className="mt-3 px-5 py-2 rounded-full btn-primary text-[11px] font-bold glow-purple-strong"
        >
          完成
        </button>
      </motion.div>
    );
  }

  return (
    <div className="pointer-events-auto flex flex-col gap-4">
      <button
        onClick={onBack}
        className="flex items-center gap-1.5 text-[12px] text-white/60 hover:text-white w-fit"
      >
        <ArrowLeft size={14} /> 返回订单
      </button>
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className="glass-panel rounded-3xl p-4"
      >
        <h2 className="text-[14px] font-extrabold">评价 {booking.providerName}</h2>
        <p className="text-[10px] text-white/50 mt-0.5">{booking.time}</p>

        <div className="flex items-center justify-center gap-2 my-5">
          {[1, 2, 3, 4, 5].map((n) => (
            <button
              key={n}
              onClick={() => setRating(n)}
              aria-label={`${n} 星`}
              className="active:scale-90 transition-transform"
            >
              <Star
                size={30}
                className={
                  n <= rating
                    ? "fill-yellow-400 text-yellow-400 drop-shadow-[0_0_8px_rgba(250,204,21,0.6)]"
                    : "text-white/20"
                }
              />
            </button>
          ))}
        </div>

        <textarea
          value={comment}
          onChange={(e) => setComment(e.target.value)}
          placeholder="说两句吧，比如：场地新、球友很会带节奏……"
          rows={3}
          className="w-full px-3.5 py-2.5 rounded-2xl glass-panel outline-none text-[12px] placeholder:text-white/30 resize-none"
        />
        <button
          onClick={submit}
          disabled={rating === 0}
          className="w-full mt-3 py-2.5 rounded-2xl btn-primary text-xs font-bold glow-purple-strong disabled:opacity-40 disabled:pointer-events-none active:scale-[0.99]"
        >
          {rating === 0 ? "先点星星再提交" : "提交评价"}
        </button>
        <p className="text-[9px] text-white/35 mt-2 text-center flex items-center justify-center gap-1">
          <MapPin size={9} /> AI 会把评价总结进撮合画像
        </p>
      </motion.div>
    </div>
  );
}
