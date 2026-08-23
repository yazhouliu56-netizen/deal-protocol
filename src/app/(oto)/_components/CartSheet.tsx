"use client";
import { AnimatePresence, motion } from "framer-motion";
import { ChevronRight, ShoppingBag, Trash2 } from "lucide-react";
import { otoExperiences } from "@/ammo/experience-catalog";
import type { OTOExperience } from "@/types/oto-experience";
import { CATEGORY_EMOJI } from "./categoryEmoji";

interface CartSheetProps {
  open: boolean;
  cart: string[];
  onClose: () => void;
  onToggleCartItem: (id: string) => void;
  onClearCart: () => void;
  /** 点击心愿单项 → AR 预览该体验并收起面板。 */
  onPreviewExperience: (exp: OTOExperience) => void;
  /** 「全部让 AI 撮合」→ 携收藏标题串进入首页发单。 */
  onAiMatchAll: (titles: string) => void;
}

/** 心愿单面板：底部弹层（收藏列表 / 清空 / 一键 AI 撮合）。 */
export default function CartSheet({
  open,
  cart,
  onClose,
  onToggleCartItem,
  onClearCart,
  onPreviewExperience,
  onAiMatchAll,
}: CartSheetProps) {
  return (
    <AnimatePresence>
      {open && (
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
            className="fixed inset-x-3 bottom-24 z-50 glass-panel rounded-3xl p-4"
          >
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-[13px] font-extrabold flex items-center gap-1.5">
                <ShoppingBag size={13} className="text-brandCyan" /> 我的心愿单
              </h3>
              <button
                onClick={onClose}
                aria-label="关闭心愿单"
                className="text-white/40 hover:text-white"
              >
                <ChevronRight size={16} className="rotate-180" />
              </button>
            </div>
            {cart.length === 0 ? (
              <p className="text-xs text-white/40 text-center py-6">
                还没有收藏——打开任意目的地卡片收藏起来吧 ♥
              </p>
            ) : (
              <>
                <div className="flex flex-col gap-2 max-h-64 overflow-y-auto no-scrollbar">
                  {cart.map((id) => {
                    const exp = otoExperiences.find((x) => x.id === id);
                    if (!exp) return null;
                    return (
                      <div
                        key={id}
                        className="flex items-center gap-2.5 rounded-2xl bg-white/[0.05] border border-white/10 p-2"
                      >
                        <button
                          onClick={() => onPreviewExperience(exp)}
                          aria-label={`在 AR 预览 ${exp.title}`}
                          className="flex items-center gap-2.5 flex-1 min-w-0 text-left"
                        >
                          <div className="w-8 h-8 rounded-xl bg-brandPurple/20 flex items-center justify-center text-sm shrink-0">
                            {CATEGORY_EMOJI[exp.category] ?? "📍"}
                          </div>
                          <div className="flex-1 min-w-0">
                            <span className="text-xs font-bold text-white/90 block truncate">
                              {exp.title}
                            </span>
                            <span className="text-xs text-white/45 block truncate">
                              {exp.location} · {exp.rating} 分
                            </span>
                          </div>
                        </button>
                        <button
                          onClick={() => onToggleCartItem(id)}
                          aria-label={`移除 ${exp.title}`}
                          className="text-white/35 hover:text-red-400 transition-colors shrink-0"
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    );
                  })}
                </div>
                <div className="flex gap-2 mt-3">
                  <button
                    onClick={onClearCart}
                    className="flex-1 py-2 rounded-xl glass-panel text-xs font-bold text-white/50 hover:text-white transition-colors"
                  >
                    清空
                  </button>
                  <button
                    onClick={() => {
                      const titles = cart
                        .map((id) => otoExperiences.find((x) => x.id === id)?.title)
                        .filter(Boolean)
                        .join("、");
                      onAiMatchAll(titles);
                    }}
                    className="flex-1 py-2 rounded-xl btn-primary text-xs font-bold glow-purple-strong"
                  >
                    ✨ 全部让 AI 撮合
                  </button>
                </div>
              </>
            )}
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
