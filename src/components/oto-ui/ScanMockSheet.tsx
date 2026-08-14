"use client";
import { useEffect, useRef, useState } from "react";
import { motion } from "framer-motion";
import { QrCode, ScanLine, CheckCircle2 } from "lucide-react";
import jsQR from "jsqr";
import { useWaveStore } from "@/store/useWaveStore";
import { parseWaveUrl } from "@/lib/scan";

type Phase = "requesting" | "scanning" | "mock" | "result";

/**
 * 扫码识别：
 * 真摄像头（getUserMedia 环境后置）+ jsQR 逐帧解码 → 识别 ShareKit 分享链接
 * → 展示局信息 + 「加入拼位」直达（/?wave=xxx&via=scan）。
 * 降级链：无摄像头 / 无权限 / 解码库异常 → 回退本地模拟扫码（演示可用）。
 */
export default function ScanMockSheet({ onClose }: { onClose: () => void }) {
  const [phase, setPhase] = useState<Phase>("requesting");
  const [scannedId, setScannedId] = useState<string | null>(null);
  const waves = useWaveStore((s) => s.waves);

  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const rafRef = useRef<number | null>(null);

  // 模拟兜底：约 1.4s 后「扫到」一个活跃开放局。
  useEffect(() => {
    if (phase !== "mock") return;
    const t = setTimeout(() => setPhase("result"), 1400);
    return () => clearTimeout(t);
  }, [phase]);

  useEffect(() => {
    let alive = true;
    let stream: MediaStream | null = null;

    const decodeLoop = () => {
      const v = videoRef.current;
      const c = canvasRef.current;
      if (!v || !c || v.readyState < 2) {
        rafRef.current = requestAnimationFrame(decodeLoop);
        return;
      }
      const ctx = c.getContext("2d", { willReadFrequently: true });
      if (!ctx) return;
      c.width = v.videoWidth;
      c.height = v.videoHeight;
      ctx.drawImage(v, 0, 0);
      const img = ctx.getImageData(0, 0, c.width, c.height);
      const code = jsQR(img.data, img.width, img.height, {
        inversionAttempts: "dontInvert",
      });
      if (code?.data) {
        const id = parseWaveUrl(code.data);
        if (id) {
          setPhase("result");
          setScannedId(id);
          return;
        }
      }
      rafRef.current = requestAnimationFrame(decodeLoop);
    };

    const start = async () => {
      if (!navigator.mediaDevices?.getUserMedia) {
        if (alive) setPhase("mock");
        return;
      }
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: "environment" },
          audio: false,
        });
        if (!alive) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }
        streamRef.current = stream;
        const v = videoRef.current;
        if (v) {
          v.srcObject = stream;
          await v.play().catch(() => {});
        }
        if (alive) {
          setPhase("scanning");
          rafRef.current = requestAnimationFrame(decodeLoop);
        }
      } catch {
        if (alive) setPhase("mock");
      }
    };

    start();
    return () => {
      alive = false;
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
      streamRef.current?.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    };
  }, []);

  // 真扫码命中的局（不在本地 store 时回退到没有任何局 → 显示「码内局已结束」）。
  const wave = scannedId
    ? (waves.find((w) => w.id === scannedId) ?? null)
    : (waves.find(
        (w) => w.status === "active" && !w.removed && (w.capacity ?? 1) >= 2
      ) ?? waves.find((w) => w.status === "active" && !w.removed));

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

        {phase === "requesting" ? (
          <div className="py-6 flex flex-col items-center gap-3">
            <div className="relative w-24 h-24">
              <div className="absolute inset-0 border-2 border-brandCyan/40 rounded-2xl" />
              <ScanLine
                size={30}
                className="absolute inset-0 m-auto text-brandCyan animate-pulse"
              />
            </div>
            <p className="text-[11px] text-white/55">正在调起摄像头…</p>
          </div>
        ) : phase === "scanning" ? (
          <div className="relative overflow-hidden rounded-2xl border border-brandCyan/40 aspect-[4/3] bg-black">
            {/* 后置摄像头预览（镜像翻转，对准即扫） */}
            <video
              ref={videoRef}
              playsInline
              muted
              className="w-full h-full object-cover -scale-x-100"
            />
            <div className="absolute inset-x-5 inset-y-[20%] border-2 border-brandCyan/50 rounded-xl pointer-events-none">
              <motion.div
                animate={{ y: [0, "calc(100%)", 0] }}
                transition={{ repeat: Infinity, duration: 1.8, ease: "easeInOut" }}
                className="absolute left-0 right-0 h-0.5 rounded-full bg-brandCyan/80"
              />
            </div>
            <p className="absolute bottom-2.5 inset-x-0 text-center text-[10px] text-white/60">
              对准对方屏幕上的二维码，自动识别
            </p>
          </div>
        ) : phase === "mock" ? (
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
            <p className="text-[9.5px] text-white/30">
              摄像头不可用，已回退模拟演示
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