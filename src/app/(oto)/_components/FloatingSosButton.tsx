"use client";
import { motion } from "framer-motion";
import { toast } from "@/base/platform/toast";
import { useWaveStore } from "@/store/useWaveStore";

/**
 * 首页悬浮 SOS 安全触点（1:1 图纸收官裁决：顶栏视觉零多余按钮，
 * SOS 逻辑收拢至铃铛抽屉 + 本全局悬浮触点双保险，必选兜底）。
 * 与 StatusCapsule 内 SOS 同源（raiseCrisis level 3 + EPA 三通道 toast）。
 */
export default function FloatingSosButton({ waveId }: { waveId?: string }) {
  const handleSos = () => {
    useWaveStore
      .getState()
      .raiseCrisis({
        level: 3,
        note: "首页悬浮 SOS 一键报警（紧急求助）",
        waveId,
        contacts: [],
      });
    toast("🚨 SOS 已上报 · 已通知紧急联系人/平台值班/警方通道", "success");
  };
  return (
    <motion.button
      initial={{ opacity: 0, scale: 0.8 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ delay: 0.5, duration: 0.3 }}
      type="button"
      onClick={handleSos}
      aria-label="SOS 紧急求助"
      data-testid="floating-sos"
      className="fixed left-4 bottom-28 z-40 flex h-12 w-12 items-center justify-center rounded-full bg-[var(--color-duo-red)] border-b-4 border-[var(--color-duo-red-dark)] text-white text-xs font-black active:translate-y-0.5 active:border-b-2 transition-[transform]"
    >
      SOS
    </motion.button>
  );
}
