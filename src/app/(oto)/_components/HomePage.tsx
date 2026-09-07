"use client";
import { memo, useCallback, useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import { Camera } from "lucide-react";
import { lockEdgeGesture } from "@/components/oto-ui/edgeGestureLock";
import { toAtomicFiveState } from "@/base/ammo/runner";
import { listAmmoPillDescriptors } from "@/ammo/registry";
import { useAppStore } from "@/store/useAppStore";
import { useWaveStore } from "@/store/useWaveStore";
import { useHasLiveWaves, useMyActiveWave } from "@/hooks/useActiveWave";
import HomeTopBar from "./HomeTopBar";
import AmmoPillBar from "./AmmoPillBar";
import HeroAiDemandCabin from "./HeroAiDemandCabin";
import FloatingSosButton from "./FloatingSosButton";
import HomeDraftSheet from "./HomeDraftSheet";
import CartSheet from "./CartSheet";
import PublishSheet from "@/components/waves/PublishSheet";
import WaveFeed from "@/components/waves/WaveFeed";
import ChatPage from "@/components/oto-ui/chat/ChatPage";

/** AI 撮合对话卡（memo 抽取：广播同步时 chatOpen 未变即跳过整卡重渲染）。
 *  折叠线案（F2）：未展开态压成单行胶囊（锚点 testid + aria-label 保真，e2e-match 零触碰）。 */
const AiChatCard = memo(function AiChatCard({
  open,
  onOpen,
  onClose,
  onDraft,
}: {
  open: boolean;
  onOpen: () => void;
  onClose: () => void;
  onDraft: (draft: { key: string; label: string }) => void;
}) {
  if (!open) {
    return (
      <button
        type="button"
        onClick={onOpen}
        aria-expanded="false"
        aria-label="展开多轮AI沟通：🤖 AI 撮合对话 · 多轮追问 💬 展开 ↓"
        data-testid="ai-chat-toggle"
        className="mt-3 w-full flex items-center gap-2 min-h-10 px-3 rounded-full bg-white border-2 border-[#e5e5e5] border-b-4 shadow-sm text-left active:translate-y-px active:border-b-2 transition-[transform]"
      >
        <span className="text-xs font-extrabold text-[#4b4b4b] flex-1 truncate">🤖 AI 撮合对话 · 多轮追问</span>
        <span className="text-xs font-bold text-[#767676] shrink-0">💬 展开 ↓</span>
      </button>
    );
  }
  return (
    <div className="mt-4 rounded-3xl bg-white border-2 border-[#e5e5e5] border-b-[6px] shadow-sm p-3" data-layer="ai-chat-embedded">
      <div>
        <div className="mb-2 flex items-center gap-1">
          <p className="text-xs font-extrabold text-[#4b4b4b] flex-1">🤖 AI 撮合对话 · 多轮追问</p>
          <button
            type="button"
            onClick={onClose}
            aria-label="收起 ↑，关闭AI对话"
            className="px-3 py-2 min-h-10 rounded-full bg-[#f7f7f7] border-2 border-[#e5e5e5] text-xs font-bold text-[#afafaf] hover:text-[#4b4b4b] transition-colors shrink-0"
          >
            收起 ↑
          </button>
        </div>
        <ChatPage compact slim onAmmoDraft={(key, category) => onDraft({ key, label: category })} />
      </div>
    </div>
  );
});

/**
 * 首页买家视口（折叠线案后形态）：问候顶栏 ➔ 水豚发射舱 ➔ 弹药横滑
 * ➔ AI 对话单行入口 ➔ 活水 Feed ➔ 温情雷达空态。
 * 卖家工作台按裁决收归 我的 → 服务者工作台（ProfilePage 内，e2e-app 锁定）。
 */
export default function HomePage() {
  const setScreen = useAppStore((s) => s.setScreen);
  const openExperience = useAppStore((s) => s.openExperience);
  const setAiDraft = useAppStore((s) => s.setAiDraft);
  const [showCart, setShowCart] = useState(false);
  const [draft, setDraft] = useState<null | { key: string; label: string }>(null);
  const [publishOpen, setPublishOpen] = useState(false);
  const [publishCategory, setPublishCategory] = useState("");
  const [aiInput, setAiInput] = useState("");
  const [chatOpen, setChatOpen] = useState(false);
  // 回调固化：memo 子组件 props 引用稳定，广播同步时才能跳过重渲染
  const handleLaunch = useCallback((text: string) => {
    setDraft({ key: "default-ammo", label: text });
    setAiInput("");
  }, []);
  const handleMic = useCallback(() => setDraft({ key: "default-ammo", label: "全类目需求" }), []);
  const handleOpenCart = useCallback(() => setShowCart(true), []);
  const handleOpenChat = useCallback(() => setChatOpen(true), []);
  const handleCloseChat = useCallback(() => setChatOpen(false), []);
  useEffect(() => {
    lockEdgeGesture(showCart || draft !== null || publishOpen);
  }, [showCart, draft, publishOpen]);
  const ammoPills = useMemo(() => listAmmoPillDescriptors(), []);
  const cart = useAppStore((s) => s.cart);
  const toggleCart = useAppStore((s) => s.toggleCart);
  const clearCart = useAppStore((s) => s.clearCart);
  const claims = useWaveStore((s) => s.claims);
  const fulfilment = useWaveStore((s) => s.fulfilment);
  // 在途同源：对象版喂五态胶囊/水豚，布尔版喂平头哥（谓词收拢至 useActiveWave）
  const activeWave = useMyActiveWave();
  const hasLiveWaves = useHasLiveWaves();
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
    <div className="oto-pastel-bg pointer-events-auto overflow-x-hidden relative -mx-4 -mt-6 px-4 pt-6 pb-4">
      {/* 氛围几何装饰层（图纸四角斑块：青绿/天蓝/暖橙/明黄，缓动漂浮，pointer-events-none 禁挡触控） */}
      <div aria-hidden="true" className="pointer-events-none select-none absolute inset-0 overflow-hidden">
        <span className="drift absolute -top-6 -left-8 h-28 w-28 rounded-3xl bg-[#58cc02]/15 rotate-12 shadow-sm" />
        <span className="drift drift-d1 absolute top-24 -right-10 h-32 w-32 rounded-full bg-[#1cb0f6]/10 -rotate-12" />
        <span className="drift drift-d2 absolute top-[46%] -left-10 h-24 w-24 rounded-3xl bg-[#ff9600]/10 rotate-12" />
        <span className="drift drift-d1 absolute bottom-24 right-6 h-20 w-20 rounded-2xl bg-[#ffd028]/15 -rotate-12" />
      </div>
      <div className="relative">
        <HomeTopBar
          activeWave={activeWave}
          activeFiveState={activeFiveState}
          cartCount={cart.length}
          onOpenCart={handleOpenCart}
        />
        <div className="mt-3" data-layer="action">
          {/* B1 一体化 AI 需求舱（1:1 图纸：水豚半身 + 星芒输入胶囊 + [ 出发! ]） */}
          <HeroAiDemandCabin
            value={aiInput}
            onChange={setAiInput}
            hasMission={activeWave !== null}
            onLaunch={handleLaunch}
            onMic={handleMic}
          />
          <AmmoPillBar pills={ammoPills} onSelectDraft={setDraft} variant="compact" hasLiveWaves={hasLiveWaves} />
          <AiChatCard open={chatOpen} onOpen={handleOpenChat} onClose={handleCloseChat} onDraft={setDraft} />
          <div className="mt-4" id="wave-feed" data-layer="wave-feed">
            <WaveFeed />
          </div>
        </div>
      </div>
      <HomeDraftSheet draft={draft} onClose={() => setDraft(null)} onPublish={(label) => { setPublishCategory(label === "全类目需求" ? "" : label); setDraft(null); setPublishOpen(true); }} />
      <CartSheet open={showCart} cart={cart} onClose={() => setShowCart(false)} onToggleCartItem={toggleCart} onClearCart={clearCart} onPreviewExperience={(exp) => { openExperience(exp); setShowCart(false); }} onAiMatchAll={(titles) => { setAiDraft(`${titles} 帮我撮合`); setShowCart(false); setScreen("home"); }} />
      <PublishSheet open={publishOpen} onClose={() => setPublishOpen(false)} initialCategory={publishCategory} />
      <motion.button initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.4 }} whileTap={{ scale: 0.94 }} onClick={() => setScreen("ar")} aria-label="AR 扫描" className="fixed right-4 bottom-28 z-40 flex items-center gap-1.5 px-3.5 py-2.5 rounded-full bg-white border-2 border-[#e5e5e5] border-b-4 shadow-sm text-xs font-bold text-[#4b4b4b] active:translate-y-1 active:border-b-2 transition-[transform] hover:border-[#1cb0f6]/30">
        <Camera size={14} className="text-[#1cb0f6]" /> AR 扫描
      </motion.button>
      <FloatingSosButton waveId={activeWave?.id} />
    </div>
  );
}
