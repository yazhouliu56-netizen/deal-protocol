"use client";
import DuoButton from "@/components/ui/DuoButton";
import { useCallback, useEffect, useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { WifiOff, HardDrive, Download, Info } from "lucide-react";

interface InstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

/**
 * 数据源徽章 + 安装引导（G-4）。
 * 顶部常驻徽章说明当前数据模式（本地沙盒 / 在线 / 离线缓存）；
 * 可安装 PWA 时提供一键「安装到主屏」动作（beforeinstallprompt）。
 */
export default function EnvBadge() {
  const [online, setOnline] = useState(true);
  const [installEvt, setInstallEvt] = useState<InstallPromptEvent | null>(null);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const on = () => setOnline(true);
    const off = () => setOnline(false);
    window.addEventListener("online", on);
    window.addEventListener("offline", off);
    return () => {
      window.removeEventListener("online", on);
      window.removeEventListener("offline", off);
    };
  }, []);

  useEffect(() => {
    const handler = (e: Event) => {
      e.preventDefault();
      setInstallEvt(e as InstallPromptEvent);
    };
    window.addEventListener("beforeinstallprompt", handler);
    return () => window.removeEventListener("beforeinstallprompt", handler);
  }, []);

  // 允许页面其它入口（如「我的」访客条）唤起数据模式说明
  useEffect(() => {
    const on = () => setOpen(true);
    window.addEventListener("oto:env-info", on);
    return () => window.removeEventListener("oto:env-info", on);
  }, []);

  const mode = useMemo(() => {
    if (!online)
      return { id: "offline", label: "离线", desc: "离线中 · 本地缓存可用" };
    return {
      id: "local",
      label: "本地沙盒",
      desc: "纯本地数据 · 演示模式；登录后自动切换云端",
    };
  }, [online]);

  const ModeIcon = mode.id === "offline" ? WifiOff : HardDrive;
  const iconColor = mode.id === "offline" ? "text-red-300" : "text-brandPurple";

  const install = useCallback(async () => {
    if (installEvt) {
      await installEvt.prompt();
      await installEvt.userChoice;
      setInstallEvt(null);
      return;
    }
    // 无事件（Safari/已装）→ 引导手动
    setOpen(true);
  }, [installEvt]);

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        aria-label={`数据模式：${mode.label}`}
        className="flex items-center gap-1 px-3 py-2 min-h-10 rounded-full bg-[#f7f7f7] border border-[#e5e5e5] text-xs font-bold text-[#afafaf] hover:text-[#4b4b4b] transition-colors shrink-0"
      >
        <ModeIcon size={9} className={iconColor} />
        {mode.label}
      </button>

      <AnimatePresence>
        {open && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-40 bg-black/50 backdrop-blur-sm"
              onClick={() => setOpen(false)}
            />
            <motion.div
              initial={{ y: 40, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: 40, opacity: 0 }}
              transition={{ type: "spring", stiffness: 320, damping: 28 }}
              className="fixed inset-x-3 bottom-24 z-50 bg-white border border-[#e5e5e5] shadow-sm rounded-3xl p-4"
            >
              <div className="flex items-center gap-2 mb-3">
                <Info size={13} className="text-brandCyan" />
                <h3 className="text-[13px] font-extrabold">运行模式</h3>
                <button
                  onClick={() => setOpen(false)}
                  aria-label="关闭数据模式说明"
                  className="ml-auto text-[#afafaf] hover:text-[#4b4b4b]"
                >
                  ✕
                </button>
              </div>
              <div className="flex items-center gap-2 text-xs text-[#4b4b4b]">
                <ModeIcon size={14} className={iconColor} />
                <span className="font-bold">{mode.label}</span>
              </div>
              <p className="text-xs text-[#afafaf] mt-1.5 leading-relaxed">
                {mode.desc}。所有撮合、托管、争议都在本地模拟完成；上线后切换云端即无缝升级。
              </p>
              <DuoButton
                onClick={install}
                variant="primary"
                size="sm"
                fullWidth
                className="mt-3"
              >
                <Download size={12} />
                {installEvt ? "安装到桌面（PWA）" : "查看安装方式"}
              </DuoButton>
              {!installEvt && (
                <p className="text-xs text-[#afafaf] text-center mt-2">
                  Chrome 可见「安装」；iOS 用 Safari 分享 → 添加到主屏幕
                </p>
              )}
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </>
  );
}