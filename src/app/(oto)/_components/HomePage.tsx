"use client";
import { memo, useCallback, useEffect, useMemo, useState } from "react";
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
import TalkPublishSheet from "@/components/waves/TalkPublishSheet";
import WaveFeed from "@/components/waves/WaveFeed";
import ChatPage from "@/components/oto-ui/chat/ChatPage";

/** 更多发单方式折叠（Batch③-1：4 门→1+折叠；hero 输入框为主门，
 *  说句话/ AI 撮合收拢至此；内部门 testid/aria 原样保留，e2e 零漂移）。 */
const MorePublishWays = memo(function MorePublishWays({
  onTalk,
  chatOpen,
  onOpenChat,
  onCloseChat,
  onDraft,
}: {
  onTalk: () => void;
  chatOpen: boolean;
  onOpenChat: () => void;
  onCloseChat: () => void;
  onDraft: (draft: { key: string; label: string }) => void;
}) {
  const [open, setOpen] = useState(false);
  return (
    <div className="mt-2">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-label={open ? "收起更多发单方式" : "展开更多发单方式：说句话发单、AI 撮合对话"}
        data-testid="more-publish-toggle"
        className="w-full flex items-center gap-2 min-h-10 px-3 rounded-full bg-white border-2 border-[var(--color-duo-swan)] border-b-4 text-left active:translate-y-px active:border-b-2 transition-[transform]"
      >
        <span className="text-xs font-extrabold text-[var(--color-duo-eel)] flex-1 truncate">✨ 更多发单方式</span>
        <span className="text-xs font-bold text-[var(--color-duo-wolf)] shrink-0">{open ? "收起 ↑" : "语音/照片/多轮追问 ↓"}</span>
      </button>
      {open && (
        <>
          <button
            onClick={onTalk}
            aria-label="说句话发单"
            data-testid="talk-publish-entry"
            className="mt-2 w-full flex items-center justify-center gap-1.5 px-3.5 py-2.5 rounded-2xl bg-[var(--color-duo-blue)]/[.06] border-2 border-[var(--color-duo-blue)]/40 text-xs font-bold text-[var(--color-duo-blue-ink)]"
          >
            🎙 说句话发单（语音/照片也行）
          </button>
          <AiChatCard open={chatOpen} onOpen={onOpenChat} onClose={onCloseChat} onDraft={onDraft} />
        </>
      )}
    </div>
  );
});
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
        className="mt-3 w-full flex items-center gap-2 min-h-10 px-3 rounded-full bg-white border-2 border-[var(--color-duo-swan)] border-b-4 text-left active:translate-y-px active:border-b-2 transition-[transform]"
      >
        <span className="text-xs font-extrabold text-[var(--color-duo-eel)] flex-1 truncate">🤖 AI 撮合对话 · 多轮追问</span>
        <span className="text-xs font-bold text-[var(--color-duo-wolf)] shrink-0">💬 展开 ↓</span>
      </button>
    );
  }
  return (
    <div className="mt-4 rounded-3xl bg-white border-2 border-[var(--color-duo-swan)] border-b-[6px] shadow-sm p-3" data-layer="ai-chat-embedded">
      <div>
        <div className="mb-2 flex items-center gap-1">
          <p className="text-xs font-extrabold text-[var(--color-duo-eel)] flex-1">🤖 AI 撮合对话 · 多轮追问</p>
          <button
            type="button"
            onClick={onClose}
            aria-label="收起 ↑，关闭AI对话"
            className="px-3 py-2 min-h-10 rounded-full bg-[var(--color-duo-polar)] border-2 border-[var(--color-duo-swan)] text-xs font-bold text-[var(--color-duo-wolf)] hover:text-[var(--color-duo-eel)] transition-colors shrink-0"
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
  const [talkOpen, setTalkOpen] = useState(false);
  // Batch③-3：段状态上 store，跨屏"去雷达"可直达（原 useState 跨屏不可达，空卡 CTA 谎报去向）。
  const homeTab = useAppStore((s) => s.homeTab);
  const setHomeTab = useAppStore((s) => s.setHomeTab);
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
  // 视口景深只属于真弹层（Cart/Publish/Talk 均带遮罩）：内联草稿卡无遮罩，
  // 若跟随变暗整页 brightness 0.85 会被读成全屏灰幕，故 draft 不进锁条件。
  useEffect(() => {
    lockEdgeGesture(showCart || publishOpen || talkOpen);
  }, [showCart, publishOpen, talkOpen]);
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
      <div className="relative">
        <HomeTopBar
          activeWave={activeWave}
          activeFiveState={activeFiveState}
          cartCount={cart.length}
          onOpenCart={handleOpenCart}
        />
        <div className="mt-3" data-layer="action">
          {/* 首页重设计 P1：一屏一职（分段切换，发单/雷达不再堆叠） */}
          <div data-testid="home-tabs" className="mb-2 flex rounded-2xl bg-[var(--color-duo-polar)] border-2 border-[var(--color-duo-swan)] p-1 gap-1">
            <button
              type="button"
              data-testid="home-tab-demand"
              aria-label="发单"
              onClick={() => setHomeTab("demand")}
              className={`flex-1 rounded-xl py-1.5 text-xs font-extrabold ${homeTab === "demand" ? "bg-white text-[var(--color-duo-blue-ink)] shadow-sm" : "text-[var(--color-duo-hare)]"}`}
            >
              📣 发单
            </button>
            <button
              type="button"
              data-testid="home-tab-radar"
              aria-label="雷达"
              onClick={() => setHomeTab("radar")}
              className={`flex-1 rounded-xl py-1.5 text-xs font-extrabold ${homeTab === "radar" ? "bg-white text-[var(--color-duo-blue-ink)] shadow-sm" : "text-[var(--color-duo-hare)]"}`}
            >
              📡 雷达
            </button>
          </div>
          {homeTab === "demand" ? (
            <>
              {/* B1 一体化 AI 需求舱（1:1 图纸：水豚半身 + 星芒输入胶囊 + [ 出发! ]） */}
              <HeroAiDemandCabin
                value={aiInput}
                onChange={setAiInput}
                hasMission={activeWave !== null}
                composing={draft !== null || publishOpen}
                onLaunch={handleLaunch}
                onMic={handleMic}
              />
              <AmmoPillBar pills={ammoPills} onSelectDraft={setDraft} variant="compact" hasLiveWaves={hasLiveWaves} />
              <MorePublishWays
                onTalk={() => setTalkOpen(true)}
                chatOpen={chatOpen}
                onOpenChat={handleOpenChat}
                onCloseChat={handleCloseChat}
                onDraft={setDraft}
              />
            </>
          ) : (
            <div className="mt-1" id="wave-feed" data-layer="wave-feed">
              {/* Batch③-1 AR 降级：悬浮 pill 撤除，入口收拢至雷达段内联行（aria 口径保留，e2e-app/offline 仅增一切段动作）。 */}
              <button
                type="button"
                onClick={() => setScreen("ar")}
                aria-label="附近服务"
                data-testid="radar-ar-entry"
                className="mb-2 w-full flex items-center gap-2 min-h-10 px-3 rounded-2xl bg-white border-2 border-[var(--color-duo-swan)] text-left active:brightness-[0.97] transition-[filter]"
              >
                <span className="text-xs font-extrabold text-[var(--color-duo-eel)] flex-1 truncate">📷 附近服务</span>
                <span className="text-xs font-bold text-[var(--color-duo-wolf)] shrink-0">看看附近可撮合的服务 →</span>
              </button>
              <WaveFeed />
            </div>
          )}
        </div>
      </div>
      <HomeDraftSheet draft={draft} onClose={() => setDraft(null)} onPublish={(label) => { setPublishCategory(label === "全类目需求" ? "" : label); setDraft(null); setPublishOpen(true); }} />
      <CartSheet open={showCart} cart={cart} onClose={() => setShowCart(false)} onToggleCartItem={toggleCart} onClearCart={clearCart} onPreviewExperience={(exp) => { openExperience(exp); setShowCart(false); }} onAiMatchAll={(titles) => { setAiDraft(`${titles} 帮我撮合`); setShowCart(false); setScreen("home"); }} />
      <PublishSheet open={publishOpen} onClose={() => setPublishOpen(false)} initialCategory={publishCategory} />
      <TalkPublishSheet
        open={talkOpen}
        onClose={() => setTalkOpen(false)}
        onFallback={(cat) => {
          setTalkOpen(false);
          setPublishCategory(cat);
          setPublishOpen(true);
        }}
      />
      {/* Batch③-1：AR 悬浮 pill 撤除（入口见雷达段 radar-ar-entry）；SOS 按 §3 裁决 C：有在途单隐藏（胶囊 SOS 在位），无单保留兜底。 */}
      <FloatingSosButton waveId={activeWave?.id} hidden={activeWave !== null} />
    </div>
  );
}
