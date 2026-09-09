"use client";
import SheetShell, { SheetClose } from "@/components/ui/SheetShell";
import DuoPill from "@/components/ui/DuoPill";
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
    <SheetShell
      onClose={onClose}
      panelClassName="fixed inset-x-3 bottom-24 z-50 bg-white border-2 border-[var(--color-duo-swan)] border-b-[6px] rounded-3xl p-4 max-h-[70vh] overflow-y-auto no-scrollbar"
    >
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-[13px] font-extrabold flex items-center gap-1.5">
            <Heart size={13} className="text-[#ff7ab8]" /> 我关注的局 {favs.length > 0 && `（${favs.length}）`}
          </h3>
          <SheetClose onClose={onClose} label="关闭关注列表" />
        </div>

        {favs.length === 0 ? (
          <p className="text-xs text-[var(--color-duo-hare)] text-center py-6">
            还没关注任何局 —— 在雷达里点 ♥ 收藏喜欢的信号波吧
          </p>
        ) : (
          <div className="flex flex-col gap-2">
            {favs.map((w) => {
              const gone = w.status !== "active";
              return (
                <div
                  key={w.id}
                  className="rounded-2xl bg-[var(--color-duo-polar)] border border-[var(--color-duo-swan)] p-3 flex items-center gap-3"
                >
                  <div className="w-9 h-9 rounded-xl bg-[var(--color-duo-green)] border-b-2 border-[var(--color-duo-green-dark)] text-white flex items-center justify-center text-base shrink-0">
                    {CATEGORY_EMOJI(w.basics.category)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-bold text-[var(--color-duo-eel)] truncate">
                      {w.basics.category}
                      {gone && (
                        <DuoPill tone="neutral" className="ml-1.5 border-0">
                          已结束
                        </DuoPill>
                      )}
                    </p>
                    <p className="text-xs text-[var(--color-duo-hare)] flex items-center gap-1 truncate">
                      <MapPin size={9} className="text-[var(--color-duo-blue)] shrink-0" />
                      {w.basics.area} · {w.basics.time} · {yuan(w.budget)}
                    </p>
                    {gone && (
                      <p className="text-xs text-[var(--color-duo-green-ink)] flex items-center gap-1 mt-0.5">
                        <CheckCircle2 size={9} /> 该局已被处理，保持关注可跟踪状态
                      </p>
                    )}
                  </div>
                  <button
                    onClick={() => onToggle(w.id)}
                    aria-label={`取消关注 ${w.basics.category}`}
                    className={`shrink-0 px-2 py-1 rounded-lg text-xs font-bold transition-colors ${
                      gone
                        ? "bg-[var(--color-duo-polar)] text-[var(--color-duo-hare)]"
                        : "bg-[var(--color-duo-polar)] border border-[var(--color-duo-swan)] text-[var(--color-duo-wolf)] hover:text-[var(--color-duo-eel)]"
                    }`}
                  >
                    移除
                  </button>
                </div>
              );
            })}
          </div>
        )}
    </SheetShell>
  );
}