"use client";
import { motion } from "framer-motion";
import DuoPill from "@/components/ui/DuoPill";
import { ShieldCheck, Clock3 } from "lucide-react";
import { SleepyBeast } from "@/components/oto-ui/MascotStates";
import { maskName } from "@/base/trust/reputation";

export interface BlindRevealData {
  nickname: string;
  creditTier: number;
  verified: boolean;
  responseTime: string;
  meta: string;
}

/**
 * 接单身份确认 — an anonymous card flips to reveal the masked identity
 * of the claimer. Visual layer only, never threaded through core logic.
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
        <div className="[transform:rotateY(180deg)] [backface-visibility:hidden] bg-white border-2 border-[var(--color-duo-blue)]/40 border-b-4 p-4 rounded-3xl">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-2xl bg-[var(--color-duo-green)] border-b-2 border-[var(--color-duo-green-dark)] text-white flex items-center justify-center text-lg shrink-0">
              {data.nickname.slice(0, 1)}
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-1.5">
                <span className="text-[13px] font-extrabold text-[var(--color-duo-eel)]">
                  {maskName(data.nickname)}
                </span>
                <DuoPill tone="yellow">
                  Lv.{data.creditTier}
                </DuoPill>
                {data.verified && (
                  <ShieldCheck size={13} className="text-[var(--color-duo-green)] shrink-0" />
                )}
              </div>
              <span className="text-xs text-[var(--color-duo-hare)] block truncate mt-0.5">
                {data.meta}
              </span>
            </div>
            <span className="flex items-center gap-1 text-xs text-[var(--color-duo-blue-ink)] font-semibold shrink-0">
              <Clock3 size={11} /> {data.responseTime}
            </span>
          </div>
        </div>

        {/* 正面（翻转前：悬念卡）—— 平头哥报喜：对方接单了 */}
        <div className="absolute inset-0 [backface-visibility:hidden] bg-white border-2 border-[var(--color-duo-swan)] border-b-4 p-4 rounded-3xl flex flex-col items-center justify-center gap-1.5">
          <SleepyBeast mood="cheering" interactive={false} />
          <span className="text-xs font-extrabold text-[var(--color-duo-eel)]">
            有人接单了！
          </span>
          <span className="text-xs text-[var(--color-duo-hare)]">身份确认中…</span>
        </div>
      </motion.div>
    </div>
  );
}