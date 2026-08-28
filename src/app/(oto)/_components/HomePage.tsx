"use client";
import { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import { Camera, Sparkles } from "lucide-react";
import { lockEdgeGesture } from "@/components/oto-ui/edgeGestureLock";
import { toAtomicFiveState } from "@/base/ammo/runner";
import { listAmmoPillDescriptors } from "@/ammo/registry";
import { useAppStore } from "@/store/useAppStore";
import { useIdentityStore } from "@/store/useIdentityStore";
import { useWaveStore } from "@/store/useWaveStore";
import HomeTopBar from "./HomeTopBar";
import AmmoPillBar from "./AmmoPillBar";
import InspirationChips from "./InspirationChips";
import HomeDraftSheet from "./HomeDraftSheet";
import CartSheet from "./CartSheet";
import RadarFeedSection from "./RadarFeedSection";
import PublishSheet from "@/components/waves/PublishSheet";
import ChatPage from "@/components/oto-ui/chat/ChatPage";

export default function HomePage() {
  const setScreen = useAppStore((s) => s.setScreen);
  const openExperience = useAppStore((s) => s.openExperience);
  const setAiDraft = useAppStore((s) => s.setAiDraft);
  const [showCart, setShowCart] = useState(false);
  const [draft, setDraft] = useState<null | { key: string; label: string }>(null);
  const [publishOpen, setPublishOpen] = useState(false);
  const [publishCategory, setPublishCategory] = useState("");
  useEffect(() => {
    lockEdgeGesture(showCart || draft !== null || publishOpen);
  }, [showCart, draft, publishOpen]);
  const ammoPills = useMemo(() => listAmmoPillDescriptors(), []);
  const cart = useAppStore((s) => s.cart);
  const toggleCart = useAppStore((s) => s.toggleCart);
  const clearCart = useAppStore((s) => s.clearCart);
  const waves = useWaveStore((s) => s.waves);
  const claims = useWaveStore((s) => s.claims);
  const fulfilment = useWaveStore((s) => s.fulfilment);
  const identity = useIdentityStore((s) => s.identity);
  const activeWave = useMemo(() => {
    const mine = waves
      .filter((w) => w.authorId === identity.id && w.status !== "closed" && w.status !== "expired")
      .sort((a, b) => b.createdAt - a.createdAt);
    return mine[0] ?? null;
  }, [waves, identity.id]);
  const activeFiveState = useMemo(() => {
    if (!activeWave) return null;
    const acceptedClaim = claims.find((c) => c.waveId === activeWave.id && (c.status === "accepted" || c.status === "joined"));
    const flags = fulfilment[activeWave.id];
    return toAtomicFiveState({
      waveStatus: activeWave.status,
      claimStatus: acceptedClaim?.status,
      fulfilmentStatus: flags?.fulfilmentStatus,
      isSettled: flags?.isSettled,
    });
  }, [activeWave, claims, fulfilment]);
  return (
    <div className="pointer-events-auto">
      <HomeTopBar activeWave={activeWave} activeFiveState={activeFiveState} cartCount={cart.length} onOpenCart={() => setShowCart(true)} />
      <div className="mt-3" data-layer="action">
        <motion.button
          onClick={() => setDraft({ key: "default-ammo", label: "全类目需求" })}
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          whileTap={{ scale: 0.98 }}
          aria-label="想找什么？一句话告诉我 · 发出你的需求"
          className="w-full flex items-center gap-3 px-4 py-3.5 rounded-2xl glass-panel-interactive hover:border-brandPurple/50 transition-[border] text-left group"
        >
          <div className="w-10 h-10 rounded-xl bg-linear-to-b from-[rgba(139,92,246,0.85)] to-[rgba(99,72,255,0.65)] border border-white/25 flex items-center justify-center shrink-0 shadow-[0_2px_14px_-2px_rgba(123,97,255,0.7),inset_0_1px_0_rgba(255,255,255,0.45)]">
            <Sparkles size={17} className="text-white" />
          </div>
          <span className="flex-1 min-w-0">
            <span className="block text-sm font-extrabold text-white">你好，我是 AI 撮合助手 ✨ 一句话告诉我…</span>
            <span className="block text-xs text-white/50 truncate">帮你秒级生成订单 · 匹配方案 / 计价 / 安全底线一键预览</span>
          </span>
          <span className="text-xs font-bold text-brandPurple shrink-0 px-2.5 py-1 rounded-full bg-brandPurple/15 border border-brandPurple/30 group-hover:bg-brandPurple/25 transition-colors">发出你的需求</span>
        </motion.button>
        <AmmoPillBar pills={ammoPills} onSelectDraft={setDraft} />
        <div className="mt-2.5">
          <ChatPage compact slim onAmmoDraft={(key, category) => setDraft({ key, label: category })} />
        </div>
        <InspirationChips onSelectDraft={setDraft} />
      </div>
      <HomeDraftSheet draft={draft} onClose={() => setDraft(null)} onPublish={(label) => { setPublishCategory(label === "全类目需求" ? "" : label); setDraft(null); setPublishOpen(true); }} />
      <RadarFeedSection />
      <CartSheet open={showCart} cart={cart} onClose={() => setShowCart(false)} onToggleCartItem={toggleCart} onClearCart={clearCart} onPreviewExperience={(exp) => { openExperience(exp); setShowCart(false); }} onAiMatchAll={(titles) => { setAiDraft(`${titles} 帮我撮合`); setShowCart(false); setScreen("home"); }} />
      <PublishSheet open={publishOpen} onClose={() => setPublishOpen(false)} initialCategory={publishCategory} />
      <motion.button initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.4 }} whileTap={{ scale: 0.94 }} onClick={() => setScreen("ar")} aria-label="AR 扫描" className="fixed right-4 bottom-28 z-40 flex items-center gap-1.5 px-3.5 py-2.5 rounded-full glass-panel border-brandCyan/40 text-xs font-bold text-white/90 shadow-[0_4px_20px_-4px_rgba(0,240,255,0.5)] active:scale-95 transition-transform">
        <Camera size={14} className="text-brandCyan" /> AR 扫描
      </motion.button>
    </div>
  );
}
