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
import InspirationChips from "./InspirationChips";
import HomeDraftSheet from "./HomeDraftSheet";
import CartSheet from "./CartSheet";
import RadarFeedSection from "./RadarFeedSection";
import PublishSheet from "@/components/waves/PublishSheet";
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
          {/* B1 一体化 AI 需求舱（白3D消灭深紫框，双输入框合一） */}
          <div
            className="bg-white rounded-3xl border-2 border-[#e5e5e5] border-b-[6px] shadow-sm p-4"
            data-testid="ai-demand-cabin"
            data-layer="ai-cabin"
          >
            <p className="text-xs font-extrabold text-[#58cc02] flex items-center gap-1">
              ✨ AI 撮合助手 · 秒级生成担保契约 · 0 押金 满意后分账
            </p>
            <div className="mt-3 flex items-center gap-2">
              <input
                type="search"
                role="searchbox"
                value={aiInput}
                onChange={(e) => setAiInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && aiInput.trim()) {
                    setDraft({ key: "default-ammo", label: aiInput.trim() });
                    setAiInput("");
                  }
                }}
                placeholder="一句话描述需求，如：周六晚 7 点天河 2 人羽毛球 AA制..."
                aria-label="一句话描述需求"
                className="flex-1 min-w-0 px-3 py-3 rounded-2xl bg-[#f7f7f7] border-2 border-[#e5e5e5] text-sm text-[#4b4b4b] placeholder:text-[#afafaf] focus:outline-none focus:border-[#58cc02]/30"
              />
              <button
                aria-label="语音输入"
                onClick={() => setDraft({ key: "default-ammo", label: "全类目需求" })}
                className="w-11 h-11 rounded-full bg-white border-2 border-[#e5e5e5] border-b-4 shadow-sm flex items-center justify-center shrink-0 active:translate-y-1 active:border-b-2 transition-[transform] hover:border-[#58cc02]/20"
              >
                🎙️
              </button>
              <button
                onClick={() => {
                  if (aiInput.trim()) {
                    setDraft({ key: "default-ammo", label: aiInput.trim() });
                    setAiInput("");
                  } else {
                    setDraft({ key: "default-ammo", label: "全类目需求" });
                  }
                }}
                aria-label="想找什么？一句话告诉我 · 发出你的需求"
                data-testid="launch-button"
                className="px-4 py-3 rounded-2xl bg-[#58cc02] border-b-4 border-[#46a302] text-white text-xs font-extrabold shadow-sm active:translate-y-1 active:border-b-0 transition-[transform] shrink-0"
              >
                ⚡ 发出
              </button>
            </div>
            <div className="mt-3 flex flex-wrap gap-2">
              {[
                { label: "🏸 周末羽毛球", ammo: "组局社交" },
                { label: "🧹 2小时保洁", ammo: "家政保洁" },
                { label: "🔧 空调清洗", ammo: "家电维修" },
                { label: "🐾 宠物寄养", ammo: "宠物寄养" },
              ].map((c) => (
                <button
                  key={c.label}
                  onClick={() => setDraft({ key: c.ammo, label: c.ammo })}
                  className="px-3 py-2 rounded-full bg-white border-2 border-[#e5e5e5] border-b-4 shadow-sm text-xs font-bold text-[#4b4b4b] active:translate-y-1 active:border-b-2 transition-[transform] hover:border-[#58cc02]/20"
                >
                  {c.label}
                </button>
              ))}
            </div>
          </div>
          <AmmoPillBar pills={ammoPills} onSelectDraft={setDraft} />
          <div className="mt-2.5">
            <ChatPage compact slim onAmmoDraft={(key, category) => setDraft({ key, label: category })} />
          </div>
          <InspirationChips onSelectDraft={setDraft} />
          <RadarFeedSection />
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
