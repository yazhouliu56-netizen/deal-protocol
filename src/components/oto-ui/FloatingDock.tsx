"use client";
import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { Home, Map, MessageCircle, User } from "lucide-react";
import { useAppStore } from "@/store/useAppStore";
import { useWaveStore } from "@/store/useWaveStore";
import { useIdentityStore } from "@/store/useIdentityStore";
import { unreadTotal } from "@/base/comm/im";

/** 4 键一体化主屏导航（AR/ProofCamera 已收纳为首页及履约座舱的上下文悬浮按钮）。 */
export type DockPage = "home" | "ar" | "im" | "trip" | "profile";

const NAVS: { id: DockPage; label: string; icon: typeof Home }[] = [
  { id: "home", label: "首页", icon: Home },
  { id: "im", label: "消息", icon: MessageCircle },
  { id: "trip", label: "行程", icon: Map },
  { id: "profile", label: "我的", icon: User },
];

/** True on desktop breakpoints — drives the right-rail slide-in entrance. */
function useIsDesktop() {
  const [isDesktop, setIsDesktop] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia("(min-width: 1024px)");
    const update = () => setIsDesktop(mq.matches);
    const id = requestAnimationFrame(update);
    mq.addEventListener("change", update);
    return () => {
      cancelAnimationFrame(id);
      mq.removeEventListener("change", update);
    };
  }, []);
  return isDesktop;
}

/**
 * Bottom floating dock (mobile) / right vertical rail (desktop).
 * Desktop entrance: slides in from the right after 0.5s — hints at the
 * side navigation for first-time PWA users.
 */
export default function FloatingDock() {
  const activeTab = useAppStore((s) => s.screen);
  const setScreen = useAppStore((s) => s.setScreen);
  const isDesktop = useIsDesktop();
  // 消息键未读角标：IM 私信中枢总未读（ADR-0010 会话未读实时投影）
  const imThreads = useWaveStore((s) => s.imThreads);
  const me = useIdentityStore((s) => s.identity.id);
  const msgUnread = unreadTotal(imThreads, me);

  return (
    <motion.div
      initial={isDesktop ? { opacity: 0, x: 80 } : false}
      animate={isDesktop ? { opacity: 1, x: 0 } : {}}
      transition={{ delay: 0.5, duration: 0.55, ease: [0.16, 1, 0.3, 1] }}
    >
      <div className="fixed o-safe-bottom o-safe-pb left-1/2 -translate-x-1/2 z-50 lg:left-auto lg:right-6 lg:top-1/2 lg:bottom-auto lg:-translate-y-1/2 lg:translate-x-0">
        <div className="bg-white border-2 border-[#e5e5e5] border-b-[6px] rounded-3xl px-6 py-2.5 flex items-center justify-between gap-8 md:gap-14 shadow-sm lg:flex-col lg:px-3 lg:py-4 lg:gap-7">
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
                    ? "text-[var(--color-duo-green)] scale-110"
                    : "text-[#afafaf] hover:text-[#4b4b4b] hover:scale-105"
                }`}
              >
                {/* Spring Glider：半透明高光胶囊，Tab 间弹簧滑行吸附（transform/opacity 硬件加速，60fps） */}
                {isActive && (
                  <motion.div
                    layoutId="activeDockPill"
                    data-testid="dock-glider"
                    transition={{ type: "spring", stiffness: 400, damping: 30 }}
                    className="absolute inset-0 -inset-x-1 -top-1 -bottom-1 rounded-2xl bg-[#d7ffb8] border border-[#58cc02]/30 shadow-[0_4px_12px_rgba(88,204,2,0.25)]"
                    aria-hidden="true"
                  />
                )}
                <div
                  className={`relative p-2.5 rounded-full transition-colors duration-300 ${
                    isActive ? "bg-[#58cc02]/15" : ""
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
                    <span className="absolute -top-0.5 -right-1 min-w-4 h-4 px-1 rounded-full bg-[#ff4b4b] border-2 border-white text-xs font-bold text-white flex items-center justify-center font-tabular shadow-sm">
                      {msgUnread}
                    </span>
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
