"use client";
import { motion } from "framer-motion";
import { Home, Map, MessageCircle, User } from "lucide-react";
import { useAppStore } from "@/store/useAppStore";
import { useWaveStore } from "@/store/useWaveStore";
import { useIdentityStore } from "@/store/useIdentityStore";
import { useHasMyActiveWave } from "@/hooks/useActiveWave";
import { unreadTotal } from "@/base/comm/im";

/** 4 键一体化主屏导航（AR/ProofCamera 已收纳为首页及履约座舱的上下文悬浮按钮）。 */
export type DockPage = "home" | "ar" | "im" | "trip" | "profile";

const NAVS: { id: DockPage; label: string; icon: typeof Home }[] = [
  { id: "home", label: "首页", icon: Home },
  { id: "im", label: "消息", icon: MessageCircle },
  { id: "trip", label: "行程", icon: Map },
  { id: "profile", label: "我的", icon: User },
];

/**
 * Bottom floating dock — locked centered on all breakpoints inside 430px container.
 * Microkernel 4.3: right-rail removed (was lg:right-6 / lg:top-1/2 / lg:flex-col).
 */
export default function FloatingDock() {
  const activeTab = useAppStore((s) => s.screen);
  const setScreen = useAppStore((s) => s.setScreen);
  // 消息键未读角标：IM 私信中枢总未读（ADR-0010 会话未读实时投影）
  const imThreads = useWaveStore((s) => s.imThreads);
  const me = useIdentityStore((s) => s.identity.id);
  const msgUnread = unreadTotal(imThreads, me);
  // 行程键进行中订单圆点：顶栏五态胶囊收拢后的实时感知替代（有在途单即亮）。
  // 在途谓词收拢至 useActiveWave（布尔 selector，waves 高频写入不重渲染 Dock）。
  const hasActiveWave = useHasMyActiveWave();

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.2, duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
    >
      <div className="fixed o-safe-bottom o-safe-pb bottom-6 left-1/2 -translate-x-1/2 z-50 w-full max-w-[430px] px-4">
        <div className="bg-white border-2 border-[var(--color-duo-swan)] border-b-4 rounded-full px-5 py-2 flex items-center justify-between gap-6 md:gap-12">
          {NAVS.map((nav) => {
            const Icon = nav.icon;
            const isActive = activeTab === nav.id;
            return (
              <button
                key={nav.id}
                onClick={() => setScreen(nav.id)}
                aria-label={nav.label}
                data-testid={`dock-tab-${nav.id}`}
                data-active={isActive ? "true" : "false"}
                className={`relative flex flex-col items-center gap-1 transition-all duration-300 ${
                  isActive
                    ? "text-[#357a00] scale-110"
                    : "text-[var(--color-duo-wolf)] hover:text-[var(--color-duo-eel)] hover:scale-105"
                }`}
              >
                {/* Spring Glider：半透明高光胶囊，Tab 间弹簧滑行吸附（transform/opacity 硬件加速，60fps） */}
                {isActive && (
                  <motion.div
                    layoutId="activeDockPill"
                    data-testid="dock-glider"
                    transition={{ type: "spring", stiffness: 400, damping: 30 }}
                    className="absolute inset-0 -inset-x-1 -top-1 -bottom-1 rounded-2xl bg-[var(--color-duo-green-light)] border border-[var(--color-duo-green)]/30 shadow-[0_4px_12px_rgba(88,204,2,0.25)]"
                    aria-hidden="true"
                  />
                )}
                <div
                  className={`relative p-2.5 rounded-full transition-colors duration-300 ${
                    isActive ? "bg-[var(--color-duo-green)]/15" : ""
                  }`}
                >
                  {isActive && (
                    <motion.div
                      layoutId="dock-active-halo"
                      transition={{ type: "spring", stiffness: 400, damping: 30 }}
                      className="absolute inset-0 rounded-full shadow-[0_0_12px_rgba(88,204,2,0.35)]"
                    />
                  )}
                  <Icon size={20} className="relative" />
                  {nav.id === "im" && msgUnread > 0 && (
                    <span className="absolute -top-0.5 -right-1 min-w-4 h-4 px-1 rounded-full bg-[var(--color-duo-red)] border-2 border-white text-xs font-bold text-white flex items-center justify-center font-tabular shadow-sm">
                      {msgUnread}
                    </span>
                  )}
                  {nav.id === "trip" && hasActiveWave && (
                    <span
                      aria-hidden="true"
                      className="absolute top-0.5 right-1.5 w-2 h-2 rounded-full bg-[var(--color-duo-green)] animate-pulse"
                    />
                  )}
                </div>
                <span className="text-xs font-semibold tracking-wide relative">
                  {nav.label}
                </span>
                {isActive && (
                  <div className="absolute -bottom-1 w-1 h-1 rounded-full bg-[var(--color-duo-green)]" />
                )}
              </button>
            );
          })}
        </div>
      </div>
    </motion.div>
  );
}
