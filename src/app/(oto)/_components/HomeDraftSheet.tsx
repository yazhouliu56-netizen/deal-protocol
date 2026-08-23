"use client";
import { AnimatePresence, motion } from "framer-motion";
import { Sparkles } from "lucide-react";
import DynamicDraftCard from "@/components/waves/DynamicDraftCard";

interface HomeDraftSheetProps {
  /** 当前展开的拟物草稿（null = 收起）。 */
  draft: null | { key: string; label: string };
  onClose: () => void;
  /** 草稿卡「扣动扳机」→ 携品类 label 进入完整发布面板。 */
  onPublish: (label: string) => void;
}

/** 中部拟物卡流动态区：输入/说话/意图气泡 → 原地展开弹药草稿卡。 */
export default function HomeDraftSheet({
  draft,
  onClose,
  onPublish,
}: HomeDraftSheetProps) {
  return (
    <AnimatePresence>
      {draft && (
        <motion.div
          initial={{ opacity: 0, y: 14, scale: 0.985, height: 0 }}
          animate={{ opacity: 1, y: 0, scale: 1, height: "auto" }}
          exit={{ opacity: 0, y: -8, scale: 0.98, height: 0 }}
          transition={{ type: "spring", stiffness: 300, damping: 28 }}
          className="mt-3 overflow-hidden"
          data-testid="draft-sheet"
        >
          <div className="relative rounded-3xl glass-panel p-4">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-[13px] font-extrabold flex items-center gap-1.5">
                <Sparkles size={13} className="text-brandCyan" /> 拟物草稿 ·{" "}
                {draft.label}
              </h3>
              <button
                onClick={onClose}
                aria-label="关闭拟物草稿"
                className="text-white/40 hover:text-white"
              >
                ✕
              </button>
            </div>
            <DynamicDraftCard
              category={draft.key}
              onPublish={() => onPublish(draft.label)}
            />
            <p className="text-xs text-white/40 mt-3 text-center">
              扣动扳机后进入完整发布面板 · 品类 / 时间 / 地点 / 预算齐全后广播
            </p>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
