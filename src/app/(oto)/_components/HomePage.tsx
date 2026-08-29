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
          data-testid="launch-button"
          className="w-full flex items-center gap-3 px-4 py-4 rounded-3xl bg-white border-2 border-[#e5e5e5] border-b-[6px] shadow-sm hover:border-[#58cc02]/30 transition-[border,transform] text-left group active:translate-y-1 active:border-b-2 active:shadow-none"
        >
          <div className="w-10 h-10 rounded-xl bg-[#58cc02] border-b-2 border-[#46a302] flex items-center justify-center shrink-0 shadow-sm">
            <Sparkles size={17} className="text-white" />
          </div>
          <span className="flex-1 min-w-0">
            <span className="block text-sm font-extrabold text-[#4b4b4b]">想找谁帮忙？一句话告诉我…</span>
            <span className="block text-xs text-[#777777] truncate">AI 撮合助手 · 语音或文字秒级生成订单 · 智能匹配最合适的人</span>
          </span>
          <span className="text-xs font-extrabold text-white shrink-0 px-3.5 py-2 rounded-full bg-[#58cc02] border-b-4 border-[#46a302] shadow-sm group-hover:brightness-[1.03] transition-[filter] flex items-center gap-1">🎙️ 发出你的需求</span>
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
      <motion.button initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.4 }} whileTap={{ scale: 0.94 }} onClick={() => setScreen("ar")} aria-label="AR 扫描" className="fixed right-4 bottom-28 z-40 flex items-center gap-1.5 px-3.5 py-2.5 rounded-full bg-white border-2 border-[#e5e5e5] border-b-4 shadow-sm text-xs font-bold text-[#4b4b4b] active:translate-y-1 active:border-b-2 transition-[transform] hover:border-[#1cb0f6]/30">
        <Camera size={14} className="text-[#1cb0f6]" /> AR 扫描
      </motion.button>
    </div>
  );
}
