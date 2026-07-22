"use client";

import React, { useState } from "react";
import { toast } from "react-hot-toast";
import { Star, X } from "lucide-react";

interface ReviewModalProps {
  isOpen: boolean;
  onClose: () => void;
  orderId: string;
  targetUserId: string;
  onSuccess?: () => void;
}

export default function ReviewModal({ isOpen, onClose, orderId, targetUserId, onSuccess }: ReviewModalProps) {
  const [rating, setRating] = useState<number>(5);
  const [comment, setComment] = useState<string>("");
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    const toastId = toast.loading("submitting review, triggering reputation state machine...");

    try {
      const res = await fetch("/api/reviews/submit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          orderId,
          targetUserId,
          rating,
          comment
        })
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "review submission failed");

      toast.success("review submitted, reputation score updated", { id: toastId });
      if (onSuccess) onSuccess();
      onClose();
    } catch (err: any) {
      toast.error(`submission failed: ${err.message}`, { id: toastId });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-zinc-900 border border-zinc-800 w-full max-w-md rounded-2xl p-6 space-y-5 relative">
        <button onClick={onClose} className="absolute top-4 right-4 text-zinc-500 hover:text-zinc-300">
          <X className="w-4 h-4" />
        </button>

        <div>
          <h2 className="text-base font-bold text-zinc-100">Service Review & Rating</h2>
          <p className="text-xs text-zinc-400 mt-1">rating is computed into provider reputation score matrix in real time</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-zinc-300 mb-2">Service Quality Score</label>
            <div className="flex items-center gap-2">
              {[1, 2, 3, 4, 5].map((star) => (
                <button
                  key={star}
                  type="button"
                  onClick={() => setRating(star)}
                  className="p-1 hover:text-amber-400 transition"
                >
                  <Star className={`w-6 h-6 ${star <= rating ? "fill-amber-400 text-amber-400" : "text-zinc-600"}`} />
                </button>
              ))}
              <span className="text-xs font-mono font-bold text-amber-400 ml-2">{rating}.0 / 5.0</span>
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-zinc-300 mb-1.5">Feedback (optional)</label>
            <textarea
              rows={4}
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              placeholder="please describe your objective assessment of communication, quality and timeliness..."
              className="w-full bg-zinc-950 border border-zinc-800 rounded-xl p-3 text-xs text-zinc-100 placeholder-zinc-600 focus:outline-none focus:border-indigo-500 transition"
            />
          </div>

          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full py-2.5 bg-indigo-600 hover:bg-indigo-500 disabled:bg-indigo-600/50 text-white text-xs font-semibold rounded-xl transition shadow-lg shadow-indigo-600/10"
          >
            {isSubmitting ? "computing weight..." : "submit review & close case"}
          </button>
        </form>
      </div>
    </div>
  );
}
