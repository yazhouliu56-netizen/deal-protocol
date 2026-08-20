"use client";
import { motion } from "framer-motion";
import { ShieldCheck, Clock3 } from "lucide-react";
import { maskName } from "@/base/trust/reputation";

export interface BlindRevealData {
  nickname: string;
  creditTier: number;
  verified: boolean;
  responseTime: string;
  meta: string;
}

/**
 * 盲盒揭晓 — the one moment of blind-box theatre: an anonymous card flips
 * to reveal the masked identity of the claimer. Visual layer only, never
 * threaded through the core logic.
 */
export default function BlindReveal({ data }: { data: BlindRevealData }) {
  return (
    <div className="[perspective:1200px]">
      <motion.div
        initial={{ rotateY: 0 }}
        animate={{ rotateY: 180 }}
        transition={{ duration: 0.9, ease: [0.16, 1, 0.3, 1] }}
        className="relative [transform-style:preserve-3d]"
      >
        {/* 背面（揭晓内容）—— rotateY 180 后朝前 */}
        <div className="[transform:rotateY(180deg)] [backface-visibility:hidden] glass-panel p-4 rounded-3xl border-brandCyan/40 glow-cyan">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-2xl btn-primary glow-purple-strong flex items-center justify-center text-lg shrink-0">
              {data.nickname.slice(0, 1)}
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-1.5">
                <span className="text-[13px] font-extrabold text-white/95">
                  {maskName(data.nickname)}
                </span>
                <span className="text-xs font-bold px-1.5 py-0.5 rounded-full bg-brandPurple/25 border border-brandPurple/40 text-brandPurple">
                  Lv.{data.creditTier}
                </span>
                {data.verified && (
                  <ShieldCheck size={13} className="text-emerald-400 shrink-0" />
                )}
              </div>
              <span className="text-xs text-white/50 block truncate mt-0.5">
                {data.meta}
              </span>
            </div>
            <span className="flex items-center gap-1 text-xs text-brandCyan font-semibold shrink-0">
              <Clock3 size={11} /> {data.responseTime}
            </span>
          </div>
        </div>

        {/* 正面（翻转前：悬念卡） */}
        <div className="absolute inset-0 [backface-visibility:hidden] glass-panel p-4 rounded-3xl flex flex-col items-center justify-center gap-1.5">
          <motion.span
            animate={{ scale: [1, 1.15, 1] }}
            transition={{ repeat: Infinity, duration: 1.4 }}
            className="text-2xl"
          >
            🎁
          </motion.span>
          <span className="text-xs font-bold text-white/85">
            有人接单了！
          </span>
          <span className="text-xs text-white/40">盲盒揭晓中…</span>
        </div>
      </motion.div>
    </div>
  );
}