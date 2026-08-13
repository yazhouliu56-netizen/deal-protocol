"use client";
import { motion, AnimatePresence } from "framer-motion";
import { CheckCircle2, Info, XCircle } from "lucide-react";
import { useToastStore, type ToastTone } from "@/base/platform/toast";

const TONE_STYLE: Record<ToastTone, string> = {
  info: "border-brandCyan/40 text-brandCyan",
  success: "border-emerald-400/40 text-emerald-300",
  error: "border-red-400/40 text-red-300",
};

const TONE_ICON: Record<ToastTone, typeof Info> = {
  info: Info,
  success: CheckCircle2,
  error: XCircle,
};

/** 全局 Toast 渲染器：挂载在 layout 根部，任何模块 toast() 即弹出。 */
export default function ToastHost() {
  const items = useToastStore((s) => s.items);
  const dismiss = useToastStore((s) => s.dismiss);

  return (
    <div className="fixed top-4 left-1/2 -translate-x-1/2 z-[100] flex flex-col items-center gap-2 pointer-events-none px-4 w-full max-w-sm">
      <AnimatePresence>
        {items.map((t) => {
          const Icon = TONE_ICON[t.tone];
          return (
            <motion.button
              key={t.id}
              layout
              initial={{ opacity: 0, y: -18, scale: 0.92 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -12, scale: 0.95 }}
              transition={{ type: "spring", stiffness: 380, damping: 28 }}
              onClick={() => dismiss(t.id)}
              className={`pointer-events-auto flex items-center gap-2 px-4 py-2.5 rounded-2xl glass-panel border text-[11px] font-bold shadow-2xl ${TONE_STYLE[t.tone]}`}
            >
              <Icon size={14} className="shrink-0" />
              {t.text}
            </motion.button>
          );
        })}
      </AnimatePresence>
    </div>
  );
}