"use client";
import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { Bot, Home, Map, Scan, User } from "lucide-react";
import { useAppStore } from "@/store/useAppStore";

export type DockPage = "home" | "ai" | "ar" | "trip" | "profile";

const NAVS: { id: DockPage; label: string; icon: typeof Home }[] = [
  { id: "home", label: "首页", icon: Home },
  { id: "ai", label: "AI 助手", icon: Bot },
  { id: "ar", label: "AR 扫描", icon: Scan },
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

  return (
    <motion.div
      initial={isDesktop ? { opacity: 0, x: 80 } : false}
      animate={isDesktop ? { opacity: 1, x: 0 } : {}}
      transition={{ delay: 0.5, duration: 0.55, ease: [0.16, 1, 0.3, 1] }}
    >
      <div className="fixed o-safe-bottom o-safe-pb left-1/2 -translate-x-1/2 z-50 lg:left-auto lg:right-6 lg:top-1/2 lg:bottom-auto lg:-translate-y-1/2 lg:translate-x-0">
        <div className="glass-panel rounded-full px-6 py-2.5 flex items-center justify-between gap-8 md:gap-12 shadow-2xl glow-purple lg:flex-col lg:px-3 lg:py-4 lg:gap-6">
          {NAVS.map((nav) => {
            const Icon = nav.icon;
            const isActive = activeTab === nav.id;
            return (
              <button
                key={nav.id}
                onClick={() => setScreen(nav.id)}
                aria-label={nav.label}
                className={`relative flex flex-col items-center gap-1 transition-all duration-300 ${
                  isActive
                    ? "text-brandPurple scale-110"
                    : "text-white/55 hover:text-white hover:scale-105"
                }`}
              >
                <div
                  className={`relative p-2 rounded-full transition-colors duration-300 ${
                    isActive ? "bg-brandPurple/20" : ""
                  }`}
                >
                  {isActive && (
                    <motion.div
                      layoutId="dock-active-halo"
                      transition={{ type: "spring", stiffness: 400, damping: 30 }}
                      className="absolute inset-0 rounded-full glow-purple"
                    />
                  )}
                  <Icon size={20} className="relative" />
                </div>
                <span className="text-[10px] font-semibold tracking-wide">
                  {nav.label}
                </span>
                {isActive && (
                  <div className="absolute -bottom-1 w-1 h-1 rounded-full bg-brandPurple glow-purple" />
                )}
              </button>
            );
          })}
        </div>
      </div>
    </motion.div>
  );
}
