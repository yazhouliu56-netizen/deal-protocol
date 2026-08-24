"use client";
import { useState } from "react";
import { motion } from "framer-motion";
import { ArrowLeft, Check, MapPin, Star } from "lucide-react";
import { useAppStore, type Booking } from "@/store/useAppStore";

export default function ReviewForm({ booking, onBack }: { booking: Booking; onBack: () => void }) {
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
        <p className="text-xs text-white/68">
          你的反馈会帮助 AI 撮合更准～ 已记录 {rating} 星
        </p>
        <button
          onClick={onBack}
          className="mt-3 px-5 py-2 rounded-full btn-primary text-xs font-bold glow-purple-strong"
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
        className="flex items-center gap-1.5 text-[12px] text-white/88 hover:text-white w-fit"
      >
        <ArrowLeft size={14} /> 返回订单
      </button>
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className="glass-panel rounded-3xl p-4"
      >
        <h2 className="text-[14px] font-extrabold">评价 {booking.providerName}</h2>
        <p className="text-xs text-white/68 mt-0.5">{booking.time}</p>

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
          className="w-full px-3.5 py-2.5 rounded-2xl glass-panel outline-none text-[12px] placeholder:text-white/68 resize-none"
        />
        <button
          onClick={submit}
          disabled={rating === 0}
          className="w-full mt-3 py-2.5 rounded-2xl btn-primary text-xs font-bold glow-purple-strong disabled:opacity-40 disabled:pointer-events-none active:scale-[0.99]"
        >
          {rating === 0 ? "先点星星再提交" : "提交评价"}
        </button>
        <p className="text-xs text-white/68 mt-2 text-center flex items-center justify-center gap-1">
          <MapPin size={9} /> AI 会把评价总结进撮合画像
        </p>
      </motion.div>
    </div>
  );
}
