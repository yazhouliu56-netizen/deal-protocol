"use client";
import { useState } from "react";
import { motion } from "framer-motion";
import { Phone, Timer, ShieldCheck } from "lucide-react";
import { makeDialCode, dialExpiresAt, isDialLive } from "@/lib/dial";

/**
 * 拨号卡片 — after a deal locks, both sides get the SAME one-time virtual
 * landline (deterministic from the wave + both parties). Expires 30min after
 * lock (P5 swaps in real virtual numbers). MVP dial = simulated toast.
 */
export default function DialCard({
  waveId,
  responderId,
  demanderId,
  lockedAt,
}: {
  waveId: string;
  responderId: string;
  demanderId: string;
  lockedAt: number;
}) {
  const [now] = useState(lockedAt);
  const [dialed, setDialed] = useState(false);
  const seed = `${waveId}:${responderId}:${demanderId}`;
  const code = makeDialCode(seed);
  const live = isDialLive(lockedAt, now);
  const mins = Math.max(1, Math.ceil((dialExpiresAt(lockedAt) - now) / 60_000));

  if (!live) {
    return (
      <div className="rounded-2xl bg-white/[0.03] border border-white/10 p-3 flex items-center gap-2.5">
        <span className="w-8 h-8 rounded-xl glass-panel flex items-center justify-center shrink-0">
          <Timer size={13} className="text-white/40" />
        </span>
        <div className="flex-1 min-w-0">
          <p className="text-[10px] font-bold text-white/60">
            虚拟线路已失效（{mins} 分钟前）
          </p>
          <p className="text-[9px] text-white/35">见面通过线下完成，P5 提供真实虚拟号</p>
        </div>
      </div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className="rounded-2xl bg-emerald-400/[0.06] border border-emerald-400/30 p-3"
    >
      <div className="flex items-center justify-between">
        <span className="text-[10.5px] font-extrabold text-emerald-300 flex items-center gap-1.5">
          <Phone size={12} /> 一次性虚拟线路
        </span>
        <span className="text-[9px] text-white/45 flex items-center gap-1">
          <Timer size={9} /> {mins} 分钟后失效
        </span>
      </div>
      <div className="mt-2 flex items-center gap-2">
        <span className="flex-1 tracking-[0.12em] font-mono font-bold text-[15px] text-white/95 bg-black/20 border border-white/10 rounded-xl py-2 px-3 text-center">
          {code}
        </span>
        <button
          onClick={() => setDialed(true)}
          className="px-3.5 py-2 rounded-xl btn-primary text-[10.5px] font-bold glow-cyan flex items-center gap-1 shrink-0"
          aria-label="拨号"
        >
          <Phone size={12} /> 拨号
        </button>
      </div>
      {dialed && (
        <p className="mt-1.5 text-[9.5px] text-emerald-300/80 flex items-center gap-1">
          <ShieldCheck size={10} /> 已模拟拨号 · 双方各自看到的是对方脱敏后的线路
        </p>
      )}
    </motion.div>
  );
}