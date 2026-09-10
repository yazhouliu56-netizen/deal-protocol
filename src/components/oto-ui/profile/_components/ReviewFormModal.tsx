"use client";
import DuoButton from "@/components/ui/DuoButton";
import DuoPill from "@/components/ui/DuoPill";
import { useState } from "react";
import { motion } from "framer-motion";
import { RISE_10 } from "@/components/ui/motion";
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
        className="pointer-events-auto bg-white border border-[var(--color-duo-swan)] rounded-3xl p-6 text-center flex flex-col items-center gap-2"
      >
        <div className="w-12 h-12 rounded-2xl bg-[var(--color-duo-green)]/10 border-2 border-[var(--color-duo-green)]/40 flex items-center justify-center">
          <Check size={22} className="text-[var(--color-duo-green)]" />
        </div>
        <h2 className="text-base font-extrabold">感谢评价！</h2>
        <p className="text-xs text-[var(--color-duo-wolf)]">
          你的反馈会帮助 AI 撮合更准～ 已记录 {rating} 星
        </p>
        <DuoPill
          tone="green"
          variant="solid"
          as="button"
          onClick={onBack}
          className="mt-3 px-5 py-2 border-0 border-b-2"
        >
          完成
        </DuoPill>
      </motion.div>
    );
  }

  return (
    <div className="pointer-events-auto flex flex-col gap-4">
      <button
        onClick={onBack}
        className="flex items-center gap-1.5 text-[12px] text-[var(--color-duo-eel)] hover:text-[var(--color-duo-eel)] w-fit"
      >
        <ArrowLeft size={14} /> 返回订单
      </button>
      <motion.div
        initial={RISE_10.initial}
        animate={RISE_10.animate}
        className="bg-white border border-[var(--color-duo-swan)] rounded-3xl p-4"
      >
        <h2 className="text-[14px] font-extrabold">评价 {booking.providerName}</h2>
        <p className="text-xs text-[var(--color-duo-wolf)] mt-0.5">{booking.time}</p>

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
                    ? "fill-[var(--color-duo-yellow)] text-[var(--color-duo-yellow-dark)]"
                    : "text-[var(--color-duo-swan)]"
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
          className="w-full px-3.5 py-2.5 rounded-2xl bg-white border border-[var(--color-duo-swan)] outline-none text-[12px] placeholder:text-[var(--color-duo-hare)] resize-none"
        />
          <DuoButton
            onClick={submit}
            disabled={rating === 0}
            variant="primary"
            size="sm"
            fullWidth
            className="mt-3"
          >
            {rating === 0 ? "先点星星再提交" : "提交评价"}
          </DuoButton>
        <p className="text-xs text-[var(--color-duo-wolf)] mt-2 text-center flex items-center justify-center gap-1">
          <MapPin size={9} /> AI 会把评价总结进撮合画像
        </p>
      </motion.div>
    </div>
  );
}
