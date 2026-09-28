"use client";
import { motion } from "framer-motion";
import { DUO_SETTLE } from "@/lib/duo-motion";
import { toast } from "@/base/platform/toast";
import { useRecording } from "@/hooks/useRecording";

/**
 * 首页悬浮一键录音（R-0928-10：左下，与搬右下的 SOS 对称）。
 * B 档自保语义：单击开，再击上传封存；麦克风拒绝降级文字＋拍照。
 * 与 FloatingSosButton 同 hidden 规则（有在途单时隐藏，座舱内由 GuardStrip 承接）。
 */
export default function FloatingRecordButton({ demandId, hidden }: { demandId?: string | null; hidden?: boolean }) {
  const r = useRecording({ tier: "B", demandId: demandId ?? null });
  if (hidden) return null;
  const recording = r.phase === "recording" || r.phase === "uploading";

  const onClick = () => {
    if (r.phase === "idle" || r.phase === "sealed" || r.phase === "error") {
      void r.start().then((ok) => {
        if (!ok) toast("录音不可用，已降级", "error");
      });
    } else {
      void r.stop().then((ok) => {
        if (ok) toast("🔒 录音已封存上传", "success");
      });
    }
  };

  return (
    <motion.button
      initial={{ opacity: 0, scale: 0.8 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ ...DUO_SETTLE, delay: 0.6 }}
      type="button"
      onClick={onClick}
      aria-label={recording ? `录音中 ${r.seconds} 秒，点击停止上传` : "一键录音自保"}
      data-testid="floating-record"
      data-recording={recording}
      className="fixed left-4 bottom-28 z-40 flex h-12 w-12 items-center justify-center rounded-full bg-white border-2 border-[var(--color-duo-red)] border-b-4 text-[var(--color-duo-red)] text-xs font-black active:translate-y-0.5 active:border-b-2 transition-[transform]"
    >
      {recording ? `${r.seconds}s` : "录音"}
    </motion.button>
  );
}
