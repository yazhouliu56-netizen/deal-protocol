"use client";
import { motion } from "framer-motion";
import { Heart, MapPin, CheckCircle2 } from "lucide-react";
import { yuan } from "@/base/money/customPricing";
import type { Wave } from "@/base/order/wave";
import { CATEGORY_EMOJI } from "./WaveCard";

/**
 * 我关注的局（雷达心愿单）— 从 feed 里点 ♥ 收藏，集中跟踪下次再来。
 * 收局后自动失效置灰、可随时取消关注。
 */
export default function FavoritesSheet({
  open,
  onClose,
  waves,
  favoriteIds,
  onToggle,
}: {
  open: boolean;
  onClose: () => void;
  waves: Wave[];
  favoriteIds: string[];
  onToggle: (waveId: string) => void;
}) {
  if (!open) return null;
  const favs = favoriteIds
    .map((id) => waves.find((w) => w.id === id))
    .filter((w): w is Wave => Boolean(w));

  return (
    <>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-40 bg-black/50 backdrop-blur-sm"
        onClick={onClose}
      />
      <motion.div
        initial={{ y: 40, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        exit={{ y: 40, opacity: 0 }}
        transition={{ type: "spring", stiffness: 320, damping: 28 }}
        className="fixed inset-x-3 bottom-24 z-50 glass-panel rounded-3xl p-4 max-h-[70vh] overflow-y-auto no-scrollbar"
      >
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-[13px] font-extrabold flex items-center gap-1.5">
            <Heart size={13} className="text-brandCyan" /> 我关注的局 {favs.length > 0 && `（${favs.length}）`}
          </h3>
          <button
            onClick={onClose}
            aria-label="关闭关注列表"
            className="text-white/40 hover:text-white"
          >
            ✕
          </button>
        </div>

        {favs.length === 0 ? (
          <p className="text-[11px] text-white/40 text-center py-6">
            还没关注任何局 —— 在雷达里点 ♥ 收藏喜欢的信号波吧
          </p>
        ) : (
          <div className="flex flex-col gap-2">
            {favs.map((w) => {
              const gone = w.status !== "active";
              return (
                <div
                  key={w.id}
                  className="rounded-2xl bg-white/[0.05] border border-white/10 p-3 flex items-center gap-3"
                >
                  <div className="w-9 h-9 rounded-xl btn-primary glow-purple-strong flex items-center justify-center text-base shrink-0">
                    {CATEGORY_EMOJI(w.basics.category)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-[11.5px] font-bold text-white/90 truncate">
                      {w.basics.category}
                      {gone && (
                        <span className="ml-1.5 text-[8.5px] font-bold px-1.5 py-0.5 rounded-full bg-white/10 text-white/40">
                          已结束
                        </span>
                      )}
                    </p>
                    <p className="text-[9.5px] text-white/45 flex items-center gap-1 truncate">
                      <MapPin size={9} className="text-brandCyan shrink-0" />
                      {w.basics.area} · {w.basics.time} · {yuan(w.budget)}
                    </p>
                    {gone && (
                      <p className="text-[9px] text-emerald-300/80 flex items-center gap-1 mt-0.5">
                        <CheckCircle2 size={9} /> 该局已被处理，保持关注可跟踪状态
                      </p>
                    )}
                  </div>
                  <button
                    onClick={() => onToggle(w.id)}
                    aria-label={`取消关注 ${w.basics.category}`}
                    className={`shrink-0 px-2 py-1 rounded-lg text-[9.5px] font-bold transition-colors ${
                      gone
                        ? "bg-white/5 text-white/40"
                        : "bg-white/5 border border-white/15 text-white/55 hover:text-white"
                    }`}
                  >
                    移除
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </motion.div>
    </>
  );
}