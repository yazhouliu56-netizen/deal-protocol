"use client";
import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { QrCode, ScanLine, CheckCircle2 } from "lucide-react";
import { useWaveStore } from "@/store/useWaveStore";

/**
 * 扫码识别（本地 demo 模拟）：
 * 上线时接 getUserMedia + 二维码解码；本地先模拟「扫到分享的局」 →
 * 展示局信息 + 「加入拼位」直达（/?wave=xxx&via=scan）。
 */
export default function ScanMockSheet({ onClose }: { onClose: () => void }) {
  // 父层条件渲染（scanOpen && <ScanMockSheet/>）→ 挂载即一次扫码会话。
  const [phase, setPhase] = useState<"scanning" | "result">("scanning");
  const waves = useWaveStore((s) => s.waves);

  const wave = waves.find(
    (w) => w.status === "active" && !w.removed && (w.capacity ?? 1) >= 2
  ) ?? waves.find((w) => w.status === "active" && !w.removed);

  useEffect(() => {
    const t = setTimeout(() => setPhase("result"), 1400);
    return () => clearTimeout(t);
  }, []);

  const join = () => {
    if (!wave) return;
    window.location.href = `/?wave=${wave.id}&via=scan`;
  };

  return (
    <>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-40 bg-black/70 backdrop-blur-sm"
        onClick={onClose}
      />
      <motion.div
        initial={{ scale: 0.96, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ type: "spring", stiffness: 300, damping: 25 }}
        className="fixed inset-x-6 bottom-24 z-50 glass-panel rounded-3xl p-5"
      >
        <div className="flex items-center gap-2 mb-3">
          <QrCode size={14} className="text-brandCyan" />
          <span className="text-[11px] font-bold text-white/80">扫码识别</span>
          <button
            onClick={onClose}
            aria-label="关闭扫码"
            className="ml-auto text-white/40 hover:text-white"
          >
            ✕
          </button>
        </div>

        {phase === "scanning" ? (
          <div className="py-6 flex flex-col items-center gap-3">
            <div className="relative w-24 h-24">
              <div className="absolute inset-0 border-2 border-brandCyan/40 rounded-2xl" />
              <motion.div
                animate={{ y: [2, 80, 2] }}
                transition={{ repeat: Infinity, duration: 2 }}
                className="absolute left-2 right-2 h-0.5 rounded-full bg-brandCyan/80"
              />
              <ScanLine size={30} className="absolute inset-0 m-auto text-brandCyan" />
            </div>
            <p className="text-[11px] text-white/55">
              正在调起摄像头（本地模拟）…
            </p>
          </div>
        ) : (
          <div className="py-2">
            <p className="text-[10px] font-semibold text-emerald-300 flex items-center gap-1">
              <CheckCircle2 size={11} /> 识别成功 · 分享的线下局
            </p>
            {wave ? (
              <div className="mt-3 rounded-2xl border border-white/10 bg-white/[0.04] p-3">
                <p className="text-[12px] font-extrabold text-white/90">
                  {wave.basics.category}
                </p>
                <p className="text-[10px] text-white/50 mt-0.5">
                  {wave.basics.area} · {wave.basics.time}
                  {(wave.capacity ?? 1) >= 2 && ` · 拼位 ${wave.capacity} 人`}
                </p>
                <button
                  onClick={join}
                  className="mt-2.5 w-full py-2.5 rounded-2xl btn-primary font-bold text-[11px] glow-purple-strong"
                >
                  加入拼位
                </button>
              </div>
            ) : (
              <p className="text-[10.5px] text-white/40 mt-3 text-center py-2">
                码内局已结束 —— 先去雷达看看附近新的信号波
              </p>
            )}
            <button
              onClick={onClose}
              className="mt-2 w-full py-2 rounded-xl text-white/40 text-[10px] hover:text-white transition-colors"
            >
              取消
            </button>
          </div>
        )}
      </motion.div>
    </>
  );
}