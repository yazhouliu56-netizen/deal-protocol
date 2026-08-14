"use client";
import { useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Radar, Zap, X } from "lucide-react";
import { useWaveStore } from "@/store/useWaveStore";
import { useIdentityStore } from "@/store/useIdentityStore";
import { yuan } from "@/base/money/customPricing";

/**
 * 雷达收件箱 — LLM 聚类推送 for THIS device's identity.
 * Shows best-fit demands the moment they broadcast (Realtime cross-device
 * when Supabase is configured, same-device tabs otherwise). One-tap claim.
 */
export default function RadarInbox() {
  const waves = useWaveStore((s) => s.waves);
  const pushes = useWaveStore((s) => s.pushes);
  const openClaim = useWaveStore((s) => s.openClaim);
  const markPushRead = useWaveStore((s) => s.markPushRead);
  const identity = useIdentityStore((s) => s.identity);
  const [open, setOpen] = useState(false);

  const mine = useMemo(
    () =>
      pushes
        .filter((p) => p.toId === identity.id)
        .sort((a, b) => b.at - a.at),
    [pushes, identity]
  );
  const unread = mine.filter((p) => !p.read).length;
  const waveOf = (waveId: string) =>
    waves.find((w) => w.id === waveId);

  if (mine.length === 0) return null;

  return (
    <div className="mb-3">
      <button
        onClick={() => setOpen(!open)}
        aria-label="雷达推送"
        className="w-full flex items-center justify-between px-3.5 py-2.5 rounded-2xl bg-linear-to-r from-brandPurple/25 to-brandCyan/15 border border-brandPurple/30"
      >
        <span className="flex items-center gap-2 text-[11px] font-bold text-white/85">
          <Radar size={13} className="text-brandCyan animate-pulse" />
          雷达 · {mine.length} 条适配推送
          {unread > 0 && (
            <span className="px-1.5 py-0.5 rounded-full bg-red-400/25 text-red-300 text-[9px] font-extrabold">
              {unread} 未读
            </span>
          )}
        </span>
        <span className="text-[10px] text-white/40">{open ? "收起" : "查看"}</span>
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden"
          >
            <div className="mt-1.5 space-y-1.5">
              {mine.map((p) => {
                const wave = waveOf(p.waveId);
                if (!wave) return null;
                const done = wave.status !== "active";
                return (
                  <div
                    key={p.id}
                    className={`rounded-2xl border p-3 ${
                      p.read
                        ? "bg-white/[0.02] border-white/10"
                        : "bg-brandPurple/10 border-brandPurple/30"
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="text-[10.5px] font-bold text-white/85 truncate">
                          {wave.basics.category} · {wave.basics.time}
                        </p>
                        <p className="text-[9.5px] text-white/45 truncate">
                          {wave.basics.area} · 预算 {yuan(wave.budget)}
                        </p>
                        <p className="text-[9.5px] text-brandCyan/90 mt-1 flex items-center gap-1">
                          <Zap size={9} /> 适配 {Math.round(p.score)} 分 · {p.reason}
                        </p>
                      </div>
                      <button
                        onClick={() => {
                          markPushRead(p.id);
                          if (!done) {
                            openClaim({
                              waveId: wave.id,
                              responderId: identity.id,
                              price: wave.budget,
                              note: "雷达推送 · 一键接单",
                            });
                          }
                        }}
                        className={`shrink-0 px-2.5 py-1.5 rounded-xl text-[10px] font-bold transition-colors ${
                          done
                            ? "bg-white/5 text-white/40"
                            : "bg-brandCyan/20 border border-brandCyan/50 text-brandCyan"
                        }`}
                        aria-label={`接单 ${wave.basics.category}`}
                      >
                        {done ? "已被接" : "一键接单"}
                      </button>
                    </div>
                  </div>
                );
              })}
              <button
                onClick={() => setOpen(false)}
                className="w-full flex items-center justify-center gap-1 py-1.5 text-[9.5px] text-white/35"
              >
                <X size={9} /> 收起
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}