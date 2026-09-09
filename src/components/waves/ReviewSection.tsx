"use client";
import DuoButton from "@/components/ui/DuoButton";
import { useState } from "react";
import { useMountedNow } from "@/lib/use-mounted-now";
import { motion } from "framer-motion";
import { RISE_8 } from "@/components/ui/motion";
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
  // SSR/首帧同构探针（page.tsx 同款 idiom）：首帧 now=0 两端一致防 Hydration Mismatch，
  const now = useMountedNow();
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
      <span className="text-xs text-[var(--color-duo-wolf)]">{label}</span>
      <div className="flex gap-0.5">
        {[1, 2, 3, 4, 5].map((v) => (
          <button
            key={v}
            onClick={() => setDims((d) => ({ ...d, [key]: v }))}
            className={`w-6 h-6 rounded-full text-xs font-bold border-2 ${
              dims[key] >= v
                ? "bg-[var(--color-duo-yellow)]/15 text-[var(--color-duo-yellow-ink)] border-[var(--color-duo-yellow-dark)]/60"
                : "bg-white text-[var(--color-duo-hare)] border-[var(--color-duo-swan)]"
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
        <p className="text-xs font-bold px-2.5 py-1.5 rounded-xl bg-[var(--color-duo-green)]/10 border-2 border-[var(--color-duo-green)]/40 text-[var(--color-duo-green-ink)] flex items-start gap-1.5">
          <ShieldCheck size={10} className="mt-0.5 shrink-0" />
          <span>
            对方评价 ★{theirs.score} · {decayLabel(theirs.at, now)}
            {theirs.comment && ` · ${theirs.comment.slice(0, 24)}`}
            <span className="text-[var(--color-duo-hare)] ml-1">（脱敏）</span>
          </span>
        </p>
      )}

      {/* 我的评价 / 评价入口 */}
      {mine ? (
        <p className="text-xs font-bold px-2.5 py-1.5 rounded-xl bg-[var(--color-duo-polar)] border-2 border-[var(--color-duo-swan)] text-[var(--color-duo-wolf)]">
          ✅ 已评价 ★{mine.score} · {decayLabel(mine.at, now)}
        </p>
      ) : (
        <DuoButton variant="outline" size="sm" sound="click" fullWidth onClick={() => setOpen(true)}>
          ⭐ 评价对方（72 小时内）
        </DuoButton>
      )}

      {open && (
        <motion.div
          initial={RISE_8.initial}
          animate={RISE_8.animate}
          className="rounded-2xl bg-white border-2 border-[var(--color-duo-swan)] border-b-4 p-3 space-y-2"
        >
          <p className="text-xs font-extrabold text-[var(--color-duo-eel)]">给对方打分</p>
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
                  className={v <= score ? "text-[var(--color-duo-yellow)] fill-[var(--color-duo-yellow)]" : "text-[var(--color-duo-swan)]"}
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
            className={`w-full rounded-xl bg-white border-2 px-2.5 py-2 text-xs placeholder:text-[var(--color-duo-hare)] text-[var(--color-duo-eel)] outline-none focus:border-[var(--color-duo-blue)] resize-none ${
              explainError ? "border-[var(--color-duo-red)]" : "border-[var(--color-duo-swan)]"
            }`}
          />
          {explainError && (
            <p className="text-xs font-bold text-[var(--color-duo-red)]">
              ⚠️ {REVIEW_EXPLANATION_THRESHOLD} 星及以下的低分评价必须填写理由
            </p>
          )}
          <DuoButton
            onClick={submit}
            variant="primary"
            size="sm"
            fullWidth
          >
            <Send size={11} /> 提交评价
          </DuoButton>
        </motion.div>
      )}

      {/* S3 关系沉淀：一次成功后，双方可自愿转友（72h 未确认自动撤回） */}
      <FriendKit claim={claim} myId={myId} peerId={peerId} />
    </div>
  );
}