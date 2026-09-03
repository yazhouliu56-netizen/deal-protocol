"use client";
import { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import { Camera } from "lucide-react";
import { lockEdgeGesture } from "@/components/oto-ui/edgeGestureLock";
import { toAtomicFiveState } from "@/base/ammo/runner";
import { listAmmoPillDescriptors } from "@/ammo/registry";
import { useAppStore } from "@/store/useAppStore";
import { useIdentityStore } from "@/store/useIdentityStore";
import { useWaveStore } from "@/store/useWaveStore";
import HomeTopBar, { type HomeMode } from "./HomeTopBar";
import AmmoPillBar from "./AmmoPillBar";
import HeroAiDemandCabin from "./HeroAiDemandCabin";
import HomeDraftSheet from "./HomeDraftSheet";
import CartSheet from "./CartSheet";
import PublishSheet from "@/components/waves/PublishSheet";
import WaveFeed from "@/components/waves/WaveFeed";
import ChatPage from "@/components/oto-ui/chat/ChatPage";
import WorkerWorkbench from "@/components/oto-ui/profile/WorkerWorkbench";

export default function HomePage() {
  const setScreen = useAppStore((s) => s.setScreen);
  const openExperience = useAppStore((s) => s.openExperience);
  const setAiDraft = useAppStore((s) => s.setAiDraft);
  const [showCart, setShowCart] = useState(false);
  const [draft, setDraft] = useState<null | { key: string; label: string }>(null);
  const [publishOpen, setPublishOpen] = useState(false);
  const [publishCategory, setPublishCategory] = useState("");
  const [homeMode, setHomeMode] = useState<HomeMode>("buyer");
  const [aiInput, setAiInput] = useState("");
  const [chatOpen, setChatOpen] = useState(false);
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
    <div className="pointer-events-auto overflow-x-hidden">
      <HomeTopBar
        activeWave={activeWave}
        activeFiveState={activeFiveState}
        cartCount={cart.length}
        onOpenCart={() => setShowCart(true)}
        mode={homeMode}
        onModeChange={setHomeMode}
      />
      {homeMode === "seller" ? (
        <div className="mt-4" data-testid="home-seller-workbench" data-layer="seller-workbench">
          <WorkerWorkbench onBack={() => setHomeMode("buyer")} />
        </div>
      ) : (
        <div className="mt-3" data-layer="action">
          {/* B1 一体化 AI 需求舱（设计图极简形态：水豚问候 + 出发 + 轻标签） */}
          <HeroAiDemandCabin
            value={aiInput}
            onChange={setAiInput}
            onLaunch={(text) => {
              setDraft({ key: "default-ammo", label: text });
              setAiInput("");
            }}
            onMic={() => setDraft({ key: "default-ammo", label: "全类目需求" })}
          />
          <AmmoPillBar pills={ammoPills} onSelectDraft={setDraft} variant="compact" />
          <div className="mt-4 rounded-3xl bg-white border-2 border-[#e5e5e5] border-b-[6px] shadow-sm p-3" data-layer="ai-chat-embedded">
            {chatOpen ? (
              <div>
                <div className="mb-2 flex items-center gap-1">
                  <p className="text-xs font-extrabold text-[#4b4b4b] flex-1">🤖 AI 撮合对话 · 多轮追问</p>
                  <button
                    type="button"
                    onClick={() => setChatOpen(false)}
                    aria-label="收起AI对话"
                    className="px-3 py-2 min-h-10 rounded-full bg-[#f7f7f7] border-2 border-[#e5e5e5] text-xs font-bold text-[#afafaf] hover:text-[#4b4b4b] transition-colors shrink-0"
                  >
                    收起 ↑
                  </button>
                </div>
                <ChatPage compact slim onAmmoDraft={(key, category) => setDraft({ key, label: category })} />
              </div>
            ) : (
              <button
                type="button"
                onClick={() => setChatOpen(true)}
                aria-expanded="false"
                aria-label="展开多轮AI沟通"
                data-testid="ai-chat-toggle"
                className="w-full flex items-center gap-2 min-h-12 text-left"
              >
                <span className="text-xs font-extrabold text-[#4b4b4b] flex-1">🤖 AI 撮合对话 · 多轮追问</span>
                <span className="px-3 py-2 rounded-full bg-[#f7f7f7] border-2 border-[#e5e5e5] border-b-4 text-xs font-bold text-[#4b4b4b] active:translate-y-px active:border-b-2 transition-[transform] shrink-0">
                  💬 展开 ↓
                </span>
              </button>
            )}
          </div>
          <div className="mt-4" id="wave-feed" data-layer="wave-feed">
            <WaveFeed />
          </div>
        </div>
      )}
      <HomeDraftSheet draft={draft} onClose={() => setDraft(null)} onPublish={(label) => { setPublishCategory(label === "全类目需求" ? "" : label); setDraft(null); setPublishOpen(true); }} />
      <CartSheet open={showCart} cart={cart} onClose={() => setShowCart(false)} onToggleCartItem={toggleCart} onClearCart={clearCart} onPreviewExperience={(exp) => { openExperience(exp); setShowCart(false); }} onAiMatchAll={(titles) => { setAiDraft(`${titles} 帮我撮合`); setShowCart(false); setScreen("home"); }} />
      <PublishSheet open={publishOpen} onClose={() => setPublishOpen(false)} initialCategory={publishCategory} />
      <motion.button initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.4 }} whileTap={{ scale: 0.94 }} onClick={() => setScreen("ar")} aria-label="AR 扫描" className="fixed right-4 bottom-28 z-40 flex items-center gap-1.5 px-3.5 py-2.5 rounded-full bg-white border-2 border-[#e5e5e5] border-b-4 shadow-sm text-xs font-bold text-[#4b4b4b] active:translate-y-1 active:border-b-2 transition-[transform] hover:border-[#1cb0f6]/30">
        <Camera size={14} className="text-[#1cb0f6]" /> AR 扫描
      </motion.button>
    </div>
  );
}
