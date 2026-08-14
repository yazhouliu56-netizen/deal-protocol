"use client";
import { useState } from "react";
import { motion } from "framer-motion";
import { Star, Send, ShieldCheck } from "lucide-react";
import { useWaveStore } from "@/store/useWaveStore";
import {
  REVIEW_EXPLANATION_THRESHOLD,
  createReview,
  decayLabel,
  explanationRequired,
  meanScore,
  type ReviewDimensions,
} from "@/base/trust/review";
import type { Claim, Wave } from "@/base/order/wave";
import FriendKit from "./FriendKit";

/**
 * 互评入口 — shown on a fulfilled claim (72h window). Structured 3-dim
 * score + stars + comment; masked on the receiving side. Idempotent per
 * reviewer per claim.
 */
export default function ReviewSection({
  claim,
  myId,
  peerId,
}: {
  claim: Claim;
  wave: Wave;
  myId: string;
  peerId: string;
}) {
  const reviews = useWaveStore((s) => s.reviews);
  const addReview = useWaveStore((s) => s.addReview);
  const [open, setOpen] = useState(false);
  const [score, setScore] = useState(5);
  const [comment, setComment] = useState("");
  const [explainError, setExplainError] = useState(false);
  const [now] = useState(() => Date.now());
  const [dims, setDims] = useState<ReviewDimensions>({
    punctual: 5,
    attitude: 5,
    professional: 5,
  });

  const mine = reviews.find(
    (r) => r.claimId === claim.id && r.fromId === myId
  );
  const theirs = reviews.find(
    (r) => r.claimId === claim.id && r.fromId === peerId
  );
  if (!claim.fulfilledAt) return null;

  /** 入库评分 = 三维均值（与 createReview 一致）；低分强制解释按此判据。 */
  const finalScore = Math.round(meanScore(dims) * 10) / 10;
  const lowScore = finalScore <= REVIEW_EXPLANATION_THRESHOLD;

  function submit() {
    if (explanationRequired(finalScore, comment)) {
      setExplainError(true);
      return;
    }
    addReview(
      createReview({
        id: `review-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`,
        claimId: claim.id,
        fromId: myId,
        toId: peerId,
        dimensions: dims,
        comment: comment.trim() || undefined,
        at: Date.now(),
      })
    );
    setOpen(false);
  }

  const dimRow = (
    key: keyof ReviewDimensions,
    label: string
  ) => (
    <div className="flex items-center justify-between">
      <span className="text-[10px] text-white/60">{label}</span>
      <div className="flex gap-0.5">
        {[1, 2, 3, 4, 5].map((v) => (
          <button
            key={v}
            onClick={() => setDims((d) => ({ ...d, [key]: v }))}
            className={`w-6 h-6 rounded-full text-[10px] font-bold ${
              dims[key] >= v
                ? "bg-amber-400/25 text-amber-300 border border-amber-400/50"
                : "bg-white/[0.05] text-white/30 border border-white/10"
            }`}
            aria-label={`${label}${v}分`}
          >
            {v}
          </button>
        ))}
      </div>
    </div>
  );

  return (
    <div className="space-y-1.5">
      {/* 对方给我的评价（脱敏 + 时间衰减） */}
      {theirs && (
        <p className="text-[9.5px] font-bold px-2.5 py-1.5 rounded-xl bg-emerald-400/[0.07] border border-emerald-400/25 text-emerald-200/90 flex items-start gap-1.5">
          <ShieldCheck size={10} className="mt-0.5 shrink-0" />
          <span>
            对方评价 ★{theirs.score} · {decayLabel(theirs.at, now)}
            {theirs.comment && ` · ${theirs.comment.slice(0, 24)}`}
            <span className="text-emerald-300/50 ml-1">（脱敏）</span>
          </span>
        </p>
      )}

      {/* 我的评价 / 评价入口 */}
      {mine ? (
        <p className="text-[9.5px] font-bold px-2.5 py-1.5 rounded-xl bg-white/[0.04] border border-white/10 text-white/70">
          ✅ 已评价 ★{mine.score} · {decayLabel(mine.at, now)}
        </p>
      ) : (
        <button
          onClick={() => setOpen(true)}
          className="w-full py-2 rounded-xl bg-brandCyan/10 border border-brandCyan/30 text-brandCyan text-[10px] font-bold"
        >
          ⭐ 评价对方（72 小时内）
        </button>
      )}

      {open && (
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          className="rounded-2xl bg-white/[0.05] border border-white/15 p-3 space-y-2"
        >
          <p className="text-[10.5px] font-bold text-white/85">给对方打分</p>
          <div className="flex gap-1">
            {[1, 2, 3, 4, 5].map((v) => (
              <button
                key={v}
                onClick={() => setScore(v)}
                aria-label={`总分${v}星`}
                className={`text-lg transition-transform ${v <= score ? "scale-110" : ""}`}
              >
                <Star
                  size={18}
                  className={v <= score ? "text-amber-300 fill-amber-300" : "text-white/20"}
                />
              </button>
            ))}
          </div>
          <div className="space-y-1">
            {dimRow("punctual", "准时")}
            {dimRow("attitude", "态度")}
            {dimRow("professional", "专业度")}
          </div>
          <textarea
            value={comment}
            onChange={(e) => {
              setComment(e.target.value);
              if (e.target.value.trim()) setExplainError(false);
            }}
            placeholder={
              lowScore
                ? `必填：${finalScore} 分评价需说明理由（防恶意差评）`
                : "说两句（脱敏展示）"
            }
            aria-label="评价留言"
            rows={2}
            className={`w-full rounded-xl bg-white/[0.05] border px-2.5 py-2 text-[10.5px] placeholder:text-white/25 text-white/90 outline-none focus:border-brandPurple/50 resize-none ${
              explainError ? "border-red-400/70" : "border-white/10"
            }`}
          />
          {explainError && (
            <p className="text-[9px] font-bold text-red-300">
              ⚠️ {REVIEW_EXPLANATION_THRESHOLD} 星及以下的低分评价必须填写理由
            </p>
          )}
          <button
            onClick={submit}
            className="w-full py-2 rounded-xl btn-primary text-[10px] font-bold glow-purple-strong flex items-center justify-center gap-1"
          >
            <Send size={11} /> 提交评价
          </button>
        </motion.div>
      )}

      {/* S3 关系沉淀：一次成功后，双方可自愿转友（72h 未确认自动撤回） */}
      <FriendKit claim={claim} myId={myId} peerId={peerId} />
    </div>
  );
}