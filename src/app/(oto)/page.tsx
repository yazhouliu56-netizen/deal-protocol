"use client";
import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import { useEdgeSwipeBack } from "@/adapters/ui/useEdgeSwipeBack";
import { useEdgeGestureLock } from "@/components/oto-ui/edgeGestureLock";
import Stage from "@/components/oto-ui/3d/Stage";
import FloatingDock from "@/components/oto-ui/FloatingDock";
import { useAppStore } from "@/store/useAppStore";
import { initLowPower } from "@/adapters/ui/performance";
import { openAuthSheet } from "@/components/oto-ui/auth/AuthSheet";
import HomePage from "./_components/HomePage";
import MessagesPage from "./_components/MessagesPage";
import ARPage from "./_components/ARPage";
import TripPage from "./_components/TripPage";
import ProfilePage from "@/components/oto-ui/profile/ProfilePage";
import SandboxBotHost from "./_components/SandboxBotHost";
import HomeTickerMarquee from "./_components/HomeTickerMarquee";
import HomeModalContainer from "./_components/HomeModalContainer";
import type { ArbitrationPhotoEvidence } from "@/components/waves/ArbitrationSheet";

const screenVariants = {
  initial: { opacity: 0, y: 18, scale: 0.985 },
  animate: { opacity: 1, y: 0, scale: 1 },
  exit: { opacity: 0, y: -12, scale: 0.99 },
};

export function shouldAutoOpenAuth(param: string | null): boolean {
  return param === "open" || param === "login";
}

export function AuthUrlGate() {
  const searchParams = useSearchParams();
  const shouldOpen = shouldAutoOpenAuth(searchParams.get("auth"));
  useEffect(() => {
    if (!shouldOpen) return;
    openAuthSheet();
  }, [shouldOpen]);
  useEffect(() => {
    if (!shouldOpen) return;
    const sheetSel = '[data-testid="auth-sheet"]';
    let seenSheet = false;
    const observer = new MutationObserver(() => {
      if (typeof document === "undefined") return;
      const present = !!document.querySelector(sheetSel);
      if (present) { seenSheet = true; return; }
      if (seenSheet) {
        const url = new URL(window.location.href);
        url.searchParams.delete("auth");
        window.history.replaceState(null, "", url.pathname + url.search);
        observer.disconnect();
      }
    });
    observer.observe(document.body, { childList: true, subtree: true });
    return () => observer.disconnect();
  }, [shouldOpen]);
  return null;
}

export default function Home() {
  const screen = useAppStore((s) => s.screen);
  const setScreen = useAppStore((s) => s.setScreen);
  const [proofShots, setProofShots] = useState<ArbitrationPhotoEvidence[]>([]);
  const gestureLocked = useEdgeGestureLock();
  useEdgeSwipeBack({ enabled: !gestureLocked && screen !== "home", onSwipeBack: () => setScreen("home") });
  useEffect(() => { initLowPower(); }, []);
  return (
    <div className="oto-stage app-env h-dvh w-full overflow-hidden relative text-white">
      <div className="nebula nebula-violet" />
      <div className="nebula nebula-cyan" />
      <div className="nebula nebula-deep" />
      <div className="aurora-blob aurora-violet top-[-15%] left-[-10%] w-[560px] h-[560px]" />
      <div className="aurora-blob aurora-cyan top-1/4 right-[-15%] w-[600px] h-[600px]" />
      <div className="aurora-blob aurora-magenta bottom-[-20%] left-[5%] w-[500px] h-[500px]" />
      <Stage />
      <div className="starfield" />
      <div className="noise-overlay" />
      <div className={`absolute inset-0 z-10 overflow-hidden transition-all duration-250 ease-out origin-top will-change-transform ${gestureLocked ? "scale-[0.96] brightness-[0.85]" : "scale-100 brightness-100"}`} style={{ willChange: "transform, filter" }} data-depth-active={gestureLocked ? "true" : "false"}>
        <AnimatePresence mode="wait">
          <motion.div key={screen} variants={screenVariants} initial="initial" animate="animate" exit="exit" transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }} className="absolute inset-0 overflow-y-auto pointer-events-none">
            <div className="mx-auto w-full max-w-md min-h-full px-4 pt-6 pb-28 flex flex-col lg:max-w-6xl lg:px-8 xl:max-w-7xl 2xl:max-w-screen-2xl">
              {screen === "home" && <><HomeTickerMarquee /><HomePage /></>}
              {screen === "im" && <MessagesPage onGoHome={() => setScreen("home")} />}
              {screen === "ar" && <ARPage proofShots={proofShots} onProofShot={(r) => setProofShots((prev) => [...prev, r])} />}
              {screen === "trip" && <TripPage proofShots={proofShots} onProofShot={(r) => setProofShots((prev) => [...prev, r])} />}
              {screen === "profile" && <ProfilePage onGoHome={() => setScreen("home")} />}
            </div>
          </motion.div>
        </AnimatePresence>
      </div>
      <FloatingDock />
      <HomeModalContainer />
      <Suspense fallback={null}><AuthUrlGate /></Suspense>
      <SandboxBotHost />
    </div>
  );
}
