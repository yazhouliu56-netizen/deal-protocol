"use client";
import { useEffect, useMemo, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { useEdgeSwipeBack } from "@/base/platform/useEdgeSwipeBack";
import { lockEdgeGesture, useEdgeGestureLock } from "@/components/oto-ui/edgeGestureLock";
import Stage from "@/components/oto-ui/3d/Stage";
import ChatPage from "@/components/oto-ui/chat/ChatPage";
import ProfilePage from "@/components/oto-ui/profile/ProfilePage";
import FloatingDock from "@/components/oto-ui/FloatingDock";
import GlassCard from "@/components/oto-ui/GlassCard";
import GlassIconButton from "@/components/oto-ui/GlassIconButton";
import OtoBadge from "@/components/oto-ui/OtoBadge";
import AuthSheet from "@/components/oto-ui/auth/AuthSheet";
import ProofCamera from "@/components/oto-ui/controls/ProofCamera";
import IdentityAvatar from "@/components/oto-ui/IdentityAvatar";
import EnvBadge from "@/components/oto-ui/EnvBadge";
import StatusCapsule from "@/components/oto-ui/StatusCapsule";
import { toAtomicFiveState } from "@/base/ammo/runner";
import { toast } from "@/base/platform/toast";
import { useWaveStore } from "@/store/useWaveStore";
import { useIdentityStore } from "@/store/useIdentityStore";
import WaveFeed from "@/components/waves/WaveFeed";
import MyWaves from "@/components/waves/MyWaves";
import NotificationCenter from "@/components/waves/NotificationCenter";
import FulfillmentCenter from "@/components/waves/FulfillmentCenter";
import DynamicDraftCard from "@/components/waves/DynamicDraftCard";
import PublishSheet from "@/components/waves/PublishSheet";
import { type ArbitrationPhotoEvidence } from "@/components/waves/ArbitrationSheet";
import { useAppStore } from "@/store/useAppStore";
import { initLowPower } from "@/base/platform/performance";
import {
  formatActivityTime,
  otoActivities,
  otoExperiences,
  type OTOActivity,
} from "@/lib/mockData";
import {
  Camera,
  Check,
  ChevronRight,
  Info,
  MapPin,
  Navigation,
  Rotate3d,
  ShoppingBag,
  Sparkles,
  Star,
  Trash2,
} from "lucide-react";

const CATEGORY_EMOJI: Record<string, string> = {
  羽毛球约局: "🏸",
  摄影师约拍: "📷",
  家政保洁: "🧹",
};

const SWATCHES = [
  { color: "#7B61FF", label: "紫罗兰" },
  { color: "#00A3FF", label: "天蓝" },
  { color: "#4ADE80", label: "草绿" },
  { color: "#F472B6", label: "粉红" },
];

const screenVariants = {
  initial: { opacity: 0, y: 18, scale: 0.985 },
  animate: { opacity: 1, y: 0, scale: 1 },
  exit: { opacity: 0, y: -12, scale: 0.99 },
};

export default function Home() {
  const screen = useAppStore((s) => s.screen);
  const setScreen = useAppStore((s) => s.setScreen);
  // P1：AR 拍照存证证据链提升到根视图 —— 拍摄结果跨屏进入 Trip 履约争议物证链
  const [proofShots, setProofShots] = useState<ArbitrationPhotoEvidence[]>([]);

  // P2：屏幕左边缘右滑 → 平滑回 Home（非 Home 屏生效；全屏弹层互斥锁启用时禁用）
  const gestureLocked = useEdgeGestureLock();
  useEdgeSwipeBack({
    enabled: !gestureLocked && screen !== "home",
    onSwipeBack: () => setScreen("home"),
  });

  useEffect(() => {
    initLowPower();
  }, []);

  return (
    <div className="oto-stage app-env h-dvh w-full overflow-hidden relative text-white">
      {/* 多层深空景深：远层星云光团（大尺度）+ 中景日光晕 */}
      <div className="nebula nebula-violet" />
      <div className="nebula nebula-cyan" />
      <div className="nebula nebula-deep" />
      {/* 3 个自然弥散日光晕，漂浮在真实屏幕背景中 */}
      <div className="aurora-blob aurora-violet top-[-15%] left-[-10%] w-[560px] h-[560px]" />
      <div className="aurora-blob aurora-cyan top-1/4 right-[-15%] w-[600px] h-[600px]" />
      <div className="aurora-blob aurora-magenta bottom-[-20%] left-[5%] w-[500px] h-[500px]" />

      {/* 3D 星尘背景（R3F）：AR 页切换为交互模型（mode/color 由全局 store 驱动） */}
      <Stage />

      {/* 散落微光星粒 + 全局噪点 */}
      <div className="starfield" />
      <div className="noise-overlay" />

      {/* 满屏响应式内容层：移动端 100% 视口，桌面端居中大画幅 */}
      <AnimatePresence mode="wait">
        <motion.div
          key={screen}
          variants={screenVariants}
          initial="initial"
          animate="animate"
          exit="exit"
          transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
          className="absolute inset-0 z-10 overflow-y-auto pointer-events-none"
        >
          <div className="mx-auto w-full max-w-md min-h-full px-4 pt-6 pb-28 flex flex-col lg:max-w-6xl lg:px-8 xl:max-w-7xl 2xl:max-w-screen-2xl">
            {screen === "home" && <HomePage />}
            {screen === "ar" && (
              <ARPage
                proofShots={proofShots}
                onProofShot={(r) => setProofShots((prev) => [...prev, r])}
              />
            )}
            {screen === "trip" && <TripPage proofShots={proofShots} />}
            {screen === "profile" && <ProfilePage onGoHome={() => setScreen("home")} />}
          </div>
        </motion.div>
      </AnimatePresence>

      {/* 底部悬浮 Dock：固定在真实屏幕底部（store 驱动） */}
      <FloatingDock />

      {/* 方案 A：空间毛玻璃登录抽屉（全局呼出 oto:auth-open，前台零整页跳出） */}
      <AuthSheet />

      {/* 数据源徽章：全屏面常驻（HomePage 内不再单独挂） */}
      <EnvBadge />
    </div>
  );
}

/* ============================ HOME ============================ */
function HomePage() {
  const setScreen = useAppStore((s) => s.setScreen);
  const openExperience = useAppStore((s) => s.openExperience);
  const setAiDraft = useAppStore((s) => s.setAiDraft);
  const [showCart, setShowCart] = useState(false);
  /** 唯一全局 AI 拟物发单条 / 三大弹药胶囊 → 拟物草稿卡（draft.key 为空串 = 全类目聚合弹药）。 */
  const [draft, setDraft] = useState<null | { key: string; label: string }>(null);
  /** 草稿卡「扣动扳机」→ 完整发布面板（品类/时间/地点/预算，全链路发单 0 丢失）。 */
  const [publishOpen, setPublishOpen] = useState(false);
  /** 草稿卡「扣动扳机」带入的品类别（胶囊中文品类直注 PublishSheet，发单条为空手动填）。 */
  const [publishCategory, setPublishCategory] = useState("");

  // P2：Home 弹层（心愿单 / 拟物草稿卡）打开期间锁定边缘滑动返回
  useEffect(() => {
    lockEdgeGesture(showCart || draft !== null || publishOpen);
  }, [showCart, draft, publishOpen]);
  const cart = useAppStore((s) => s.cart);
  const toggleCart = useAppStore((s) => s.toggleCart);
  const clearCart = useAppStore((s) => s.clearCart);

  /* W2 总装：当前用户进行中活动 Wave → toAtomicFiveState 投影 → 顶栏五态胶囊 */
  const waves = useWaveStore((s) => s.waves);
  const claims = useWaveStore((s) => s.claims);
  const fulfilment = useWaveStore((s) => s.fulfilment);
  const identity = useIdentityStore((s) => s.identity);
  const activeWave = useMemo(() => {
    const mine = waves
      .filter(
        (w) => w.authorId === identity.id && w.status !== "closed" && w.status !== "expired",
      )
      .sort((a, b) => b.createdAt - a.createdAt);
    return mine[0] ?? null;
  }, [waves, identity.id]);
  const activeFiveState = useMemo(() => {
    if (!activeWave) return null;
    const acceptedClaim = claims.find(
      (c) => c.waveId === activeWave.id && (c.status === "accepted" || c.status === "joined"),
    );
    // W5 总装：合并 advanceLifecycle 核销回写（fulfilmentStatus / isSettled），胶囊实时流转
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
      {/* W2 总装：顶栏五态灵动胶囊（当前进行中订单实时投影：🟡广播 ➔ 🔵就位 ➔ 🟣履约 ➔ 🟠待验收 ➔ 🟢已结算） */}
      {activeWave && activeFiveState && (
        <div className="flex justify-center mb-2" data-testid="top-status-capsule">
          <StatusCapsule
            status={activeFiveState}
            options={{
              isOffline: typeof navigator !== "undefined" ? !navigator.onLine : false,
              // P0 接电：SOS 一键报警 → 危机应急预案（级别 3 极端紧急，EPA 三通道通知）
              onSosClick: () => {
                useWaveStore
                  .getState()
                  .raiseCrisis({
                    level: 3,
                    note: "首页顶栏 SOS 一键报警（紧急求助）",
                    waveId: activeWave.id,
                    contacts: [],
                  });
                toast("🚨 SOS 已上报 · 已通知紧急联系人/平台值班/警方通道", "success");
              },
            }}
          />
        </div>
      )}
      {/* 问候语 + 标题 */}
      <div className="flex items-center gap-2.5 mb-1">
        <IdentityAvatar />
        <p className="text-[13px] text-white/75 font-medium flex-1">
          Hello, Alex! 👋
        </p>
        <div className="flex items-center gap-2 shrink-0">
          <NotificationCenter />
          <button
            onClick={() => setShowCart(true)}
            aria-label={`心愿单，共 ${cart.length} 项`}
            className="relative w-11 h-11 rounded-full glass-panel-interactive flex items-center justify-center shrink-0 hover:border-brandPurple/50 active:scale-95 transition-[border,transform]"
          >
            <ShoppingBag size={15} className="text-white/80" />
            {cart.length > 0 && (
              <span className="absolute -top-1 -right-1 min-w-4 h-4 px-1 rounded-full bg-brandPurple border border-white/30 text-[9px] font-bold text-white flex items-center justify-center">
                {cart.length}
              </span>
            )}
          </button>
        </div>
      </div>

      {/* ═══ 第二层：AI 对话发单区 + 返回中部拟物卡流动态区 ═══ */}
      <div className="mt-3" data-layer="action">
        {/* 常驻 AI 智能问候发单条（入口零丢失：全类目拟物草稿卡 100% 直呼） */}
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
            <span className="block text-sm font-extrabold text-white">
              你好，我是 AI 撮合助手 ✨ 一句话告诉我…
            </span>
            <span className="block text-[10px] text-white/50 truncate">
              帮你秒级生成订单 · 匹配弹药 / 计价 / 安全底线一键预览
            </span>
          </span>
          <span className="text-[10px] font-bold text-brandPurple shrink-0 px-2.5 py-1 rounded-full bg-brandPurple/15 border border-brandPurple/30 group-hover:bg-brandPurple/25 transition-colors">
            发出你的需求
          </span>
        </motion.button>

        {/* AI 意图中枢：4 大意图快捷气泡 + 统一输入框（文本 / 按住说话 / 发送）——
            ChatPage compact 融合嵌入，多轮澄清与转正式订单能力 100% 保留 */}
        <div className="mt-2.5">
          <ChatPage
            compact
            onAmmoDraft={(key, category) => setDraft({ key, label: category })}
          />
        </div>
      </div>

      {/* ═══ 中部拟物卡流动态区：输入/说话/意图气泡 → 原地展开弹药草稿卡 ═══ */}
      <AnimatePresence>
        {draft && (
          <motion.div
            initial={{ opacity: 0, y: 14, scale: 0.985, height: 0 }}
            animate={{ opacity: 1, y: 0, scale: 1, height: "auto" }}
            exit={{ opacity: 0, y: -8, scale: 0.98, height: 0 }}
            transition={{ type: "spring", stiffness: 300, damping: 28 }}
            className="mt-3 overflow-hidden"
            data-testid="draft-sheet"
          >
            <div className="relative rounded-3xl glass-panel p-4">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-[13px] font-extrabold flex items-center gap-1.5">
                  <Sparkles size={13} className="text-brandCyan" /> 拟物草稿 ·{" "}
                  {draft.label}
                </h3>
                <button
                  onClick={() => setDraft(null)}
                  aria-label="关闭拟物草稿"
                  className="text-white/40 hover:text-white"
                >
                  ✕
                </button>
              </div>
              <DynamicDraftCard
                category={draft.key}
                onPublish={() => {
                  const label = draft.label;
                  setPublishCategory(label === "全类目需求" ? "" : label);
                  setDraft(null);
                  setPublishOpen(true);
                }}
                onTweak={(key) =>
                  toast(`「${key}」参数可在完整发布面板中微调`, "info")
                }
              />
              <p className="text-[9.5px] text-white/40 mt-3 text-center">
                扣动扳机后进入完整发布面板 · 品类 / 时间 / 地点 / 预算齐全后广播
              </p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ═══ 第三层：雷达波浪视口 —— 直达 WaveFeed 实时需求波卡流 ═══ */}
      <div className="mt-4" data-layer="wave-feed">
        <WaveFeed />
      </div>

      {/* 心愿单面板 */}
      <AnimatePresence>
        {showCart && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-40 bg-black/50 backdrop-blur-sm"
              onClick={() => setShowCart(false)}
            />
            <motion.div
              initial={{ y: 40, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: 40, opacity: 0 }}
              transition={{ type: "spring", stiffness: 320, damping: 28 }}
              className="fixed inset-x-3 bottom-24 z-50 glass-panel rounded-3xl p-4"
            >
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-[13px] font-extrabold flex items-center gap-1.5">
                  <ShoppingBag size={13} className="text-brandCyan" /> 我的心愿单
                </h3>
                <button
                  onClick={() => setShowCart(false)}
                  aria-label="关闭心愿单"
                  className="text-white/40 hover:text-white"
                >
                  <ChevronRight size={16} className="rotate-180" />
                </button>
              </div>
              {cart.length === 0 ? (
                <p className="text-[11px] text-white/40 text-center py-6">
                  还没有收藏——打开任意目的地卡片收藏起来吧 ♥
                </p>
              ) : (
                <>
                  <div className="flex flex-col gap-2 max-h-64 overflow-y-auto no-scrollbar">
                    {cart.map((id) => {
                      const exp = otoExperiences.find((x) => x.id === id);
                      if (!exp) return null;
                      return (
                        <div
                          key={id}
                          className="flex items-center gap-2.5 rounded-2xl bg-white/[0.05] border border-white/10 p-2"
                        >
                          <button
                            onClick={() => {
                              openExperience(exp);
                              setShowCart(false);
                            }}
                            aria-label={`在 AR 预览 ${exp.title}`}
                            className="flex items-center gap-2.5 flex-1 min-w-0 text-left"
                          >
                            <div className="w-8 h-8 rounded-xl bg-brandPurple/20 flex items-center justify-center text-sm shrink-0">
                              {CATEGORY_EMOJI[exp.category] ?? "📍"}
                            </div>
                            <div className="flex-1 min-w-0">
                              <span className="text-[11.5px] font-bold text-white/90 block truncate">
                                {exp.title}
                              </span>
                              <span className="text-[9.5px] text-white/45 block truncate">
                                {exp.location} · {exp.rating} 分
                              </span>
                            </div>
                          </button>
                          <button
                            onClick={() => toggleCart(id)}
                            aria-label={`移除 ${exp.title}`}
                            className="text-white/35 hover:text-red-400 transition-colors shrink-0"
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>
                      );
                    })}
                  </div>
                  <div className="flex gap-2 mt-3">
                    <button
                      onClick={clearCart}
                      className="flex-1 py-2 rounded-xl glass-panel text-[11px] font-bold text-white/50 hover:text-white transition-colors"
                    >
                      清空
                    </button>
                    <button
                      onClick={() => {
                        const titles = cart
                          .map((id) => otoExperiences.find((x) => x.id === id)?.title)
                          .filter(Boolean)
                          .join("、");
                        setAiDraft(`${titles} 帮我撮合`);
                        setShowCart(false);
                        setScreen("home");
                      }}
                      className="flex-1 py-2 rounded-xl btn-primary text-[11px] font-bold glow-purple-strong"
                    >
                      ✨ 全部让 AI 撮合
                    </button>
                  </div>
                </>
              )}
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* 完整发布面板：草稿卡「扣动扳机」→ 品类/时间/地点/预算 → 广播（全链路 0 丢失） */}
      <PublishSheet open={publishOpen} onClose={() => setPublishOpen(false)} initialCategory={publishCategory} />
    </div>
  );
}

/* ============================ AR ============================ */
const AR_SCENE_POINTS = [
  {
    id: "arena",
    emoji: "🏸",
    name: "星羽羽毛球馆",
    meta: "场地空 3 片 · 空调 · 近地铁",
    rating: 4.8,
    price: "¥80/小时",
    distance: "1.2 km",
    draft: "周六晚上想找人打羽毛球，业余水平",
    x: "70%",
    y: "22%",
  },
  {
    id: "photo",
    emoji: "📷",
    name: "滨江街拍点位",
    meta: "日系摄影师常驻 · 日落光线绝佳",
    rating: 4.9,
    price: "¥499/套",
    distance: "800 m",
    draft: "想约摄影师拍一组日系写真",
    x: "24%",
    y: "62%",
  },
  {
    id: "clean",
    emoji: "🧹",
    name: "王姐保洁 · 上门",
    meta: "10 年经验 · 好评王 · 自备工具",
    rating: 5.0,
    price: "¥180/次",
    distance: "2.0 km",
    draft: "周末找个保洁上门",
    x: "74%",
    y: "58%",
  },
];

function ARPage({
  proofShots,
  onProofShot,
}: {
  /** 根视图提升的存证照片（跨屏供给 Trip 争议物证链）。 */
  proofShots: ArbitrationPhotoEvidence[];
  onProofShot: (shot: ArbitrationPhotoEvidence) => void;
}) {
  const selectedExperience = useAppStore((s) => s.selectedExperience);
  const activeSwatch = useAppStore((s) => s.activeSwatch);
  const setActiveSwatch = useAppStore((s) => s.setActiveSwatch);
  const showInfo = useAppStore((s) => s.showInfo);
  const toggleShowInfo = useAppStore((s) => s.toggleShowInfo);
  const resetView = useAppStore((s) => s.resetView);
  const cart = useAppStore((s) => s.cart);
  const toggleCart = useAppStore((s) => s.toggleCart);
  const setScreen = useAppStore((s) => s.setScreen);
  const setAiDraft = useAppStore((s) => s.setAiDraft);

  const [mode, setMode] = useState<"scene" | "preview">("scene");
  const [activePoint, setActivePoint] = useState<null | (typeof AR_SCENE_POINTS)[number]>(null);
  // P0 接电：4:3 存证水印相机模态 + 已捕获存证照片列表（P1：提升到根视图跨屏传导）
  const [photoOpen, setPhotoOpen] = useState(false);

  // P2：AR 全屏相机打开期间锁定边缘滑动返回（防手势打架）
  useEffect(() => {
    lockEdgeGesture(photoOpen);
  }, [photoOpen]);

  const addedToCart = cart.includes(selectedExperience.id);

  const [cameraOrderNo, setCameraOrderNo] = useState(
    () => `AR-${selectedExperience.id}-${Date.now().toString(36)}`,
  );

  function goMatch(draft: string) {
    setAiDraft(draft);
    setScreen("home");
  }

  return (
    <div className="flex-1 w-full flex flex-col items-center relative min-h-0 pointer-events-auto">
      {/* 模式切换 */}
      <div className="flex items-center gap-1.5 z-20 shrink-0 mb-2 pointer-events-auto">
        {(
          [
            { id: "scene", label: "📸 场景探索", hint: "对准真实场景找服务" },
            { id: "preview", label: "✨ 体验预览", hint: "全息 3D 体验" },
          ] as const
        ).map((m) => (
          <button
            key={m.id}
            onClick={() => {
              setMode(m.id);
              // 切回场景探索时重置锚点，避免上次的锚点残留
              setActivePoint(null);
            }}
            className={`px-3 py-1.5 rounded-full text-[11px] font-semibold transition-all ${
              mode === m.id
                ? "btn-primary glow-purple-strong"
                : "glass-panel text-white/60 hover:text-white"
            }`}
          >
            {m.label}
          </button>
        ))}
      </div>

      {/* 中央视口 */}
      <div className="flex-1 min-h-0 w-full flex items-center justify-center relative">
        {mode === "scene" ? (
          <div className="absolute inset-0 pointer-events-none">
            {/* 相机取景网格 */}
            <div className="absolute inset-0 scene-grid" />
            {/* 远处场景元素（模拟取景对象） */}
            <div className="absolute left-[8%] top-[18%] text-[64px] opacity-25 blur-[2px]">🏢</div>
            <div className="absolute right-[6%] top-[30%] text-[48px] opacity-20 blur-[3px]">🌳</div>
            <div className="absolute left-[15%] bottom-[12%] text-[56px] opacity-20 blur-[2px]">🏠</div>
            {/* 取景框角标 */}
            <div className="absolute inset-x-6 top-4 bottom-6 rounded-2xl border border-white/15 pointer-events-none">
              <span className="absolute -top-[7px] left-3 px-1 text-[8px] tracking-[0.3em] text-white/40 bg-black/30 rounded">
                AR 取景框
              </span>
            </div>
            {/* 场景锚点 */}
            <div className="absolute inset-0 pointer-events-auto">
              {AR_SCENE_POINTS.map((p) => (
                <button
                  key={p.id}
                  onClick={() => setActivePoint(p)}
                  aria-label={p.name}
                  className="absolute flex flex-col items-center group active:scale-95 transition-transform"
                  style={{ left: p.x, top: p.y, transform: "translate(-50%, -50%)" }}
                >
                  <span
                    className={`w-3.5 h-3.5 rounded-full ${
                      activePoint?.id === p.id ? "bg-emerald-400" : "bg-brandCyan"
                    } animate-ping-once`}
                  />
                  <span className="mt-1.5 px-2 py-1 rounded-full glass-panel text-[10px] font-bold text-white/90 whitespace-nowrap">
                    {p.emoji} {p.name}
                  </span>
                  <span className="mt-0.5 text-[9px] text-white/45">
                    {p.distance}
                  </span>
                </button>
              ))}
            </div>
          </div>
        ) : (
          <>
            <div className="absolute inset-0 pointer-events-none">
              <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex flex-col items-center gap-1 text-white/50">
                <Rotate3d size={13} className="text-brandCyan" />
                <span className="text-[10px] tracking-wide">
                  拖拽鼠标/手指 360° 旋转查看 3D 模型
                </span>
              </div>
            </div>

            {/* 左侧 4 色 Swatches */}
            <div className="absolute left-2 top-1/2 -translate-y-1/2 flex flex-col items-center gap-2.5 z-20 pointer-events-auto">
              <span className="text-[8px] tracking-[0.25em] text-white/40 font-medium mb-0.5">
                材质
              </span>
              {SWATCHES.map((s) => (
                <button
                  key={s.color}
                  onClick={() => setActiveSwatch(s.color)}
                  aria-label={s.label}
                  className={`w-6 h-6 rounded-full transition-transform ${
                    activeSwatch === s.color
                      ? "scale-110 ring-2 ring-white/60 ring-offset-2 ring-offset-black/40"
                      : "opacity-80 hover:opacity-100"
                  }`}
                  style={{ backgroundColor: s.color }}
                />
              ))}
            </div>

            {/* 右侧控制列 */}
            <div className="absolute right-2 top-1/2 -translate-y-1/2 flex flex-col gap-2 z-20 pointer-events-auto">
              <GlassIconButton size="sm" aria-label="重置视角" onClick={resetView} className="text-brandCyan font-bold text-[10px] glow-cyan">
                360
              </GlassIconButton>
              <GlassIconButton size="sm" aria-label="查看详情" onClick={toggleShowInfo}>
                <Info size={14} />
              </GlassIconButton>
              <GlassIconButton
                size="sm"
                aria-label="拍照存证"
                onClick={() => {
                  setCameraOrderNo(`AR-${selectedExperience.id}-${Date.now().toString(36)}`);
                  setPhotoOpen(true);
                }}
                className="relative"
              >
                <Camera size={14} />
                {proofShots.length > 0 && (
                  <span className="absolute -top-1 -right-1 min-w-4 h-4 px-1 rounded-full bg-brandPurple border border-white/30 text-[9px] font-bold text-white flex items-center justify-center">
                    {proofShots.length}
                  </span>
                )}
              </GlassIconButton>
            </div>
          </>
        )}
      </div>

      {/* 底部卡片 */}
      <div className="w-full z-20 space-y-3 shrink-0 pointer-events-auto">
        {mode === "scene" ? (
          <>
            {activePoint ? (
              <motion.div
                key={activePoint.id}
                initial={{ opacity: 0, y: 14 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
                className="glass-panel p-4 rounded-3xl animate-float-slow"
              >
                <div className="flex items-center gap-3">
                  <div className="w-11 h-11 rounded-2xl glass-panel flex items-center justify-center text-xl shrink-0">
                    {activePoint.emoji}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5">
                      <h3 className="font-bold text-[14px] truncate">
                        {activePoint.name}
                      </h3>
                      <span className="flex items-center gap-0.5 text-[11px] font-semibold text-yellow-400 shrink-0">
                        <Star size={10} className="fill-yellow-400" />
                        {activePoint.rating}
                      </span>
                    </div>
                    <p className="text-[10px] text-white/55 mt-0.5 truncate">
                      {activePoint.meta}
                    </p>
                    <p className="text-[10px] text-brandCyan font-bold mt-0.5">
                      {activePoint.price} · 距你 {activePoint.distance}
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => goMatch(activePoint.draft)}
                  className="w-full mt-3 py-2.5 rounded-2xl btn-primary font-bold text-xs glow-purple-strong hover:brightness-110 active:scale-[0.98] transition-[filter,transform]"
                >
                  找 AI 撮合 →
                </button>
              </motion.div>
            ) : (
              <div className="glass-panel px-4 py-3 rounded-2xl flex items-center gap-2 animate-float-slow">
                <Navigation size={13} className="text-brandCyan shrink-0" />
                <p className="text-[10.5px] text-white/60">
                  对准真实场景，点击光点探索附近可撮合服务
                </p>
              </div>
            )}
          </>
        ) : (
          <>
            <AnimatePresence>
              {showInfo && (
                <motion.div
                  initial={{ opacity: 0, y: 10, height: 0 }}
                  animate={{ opacity: 1, y: 0, height: "auto" }}
                  exit={{ opacity: 0, y: 10, height: 0 }}
                  transition={{ duration: 0.28, ease: [0.16, 1, 0.3, 1] }}
                  className="overflow-hidden"
                >
                  <GlassCard className="p-3.5 rounded-2xl">
                    <p className="text-[11px] text-white/80 leading-relaxed">
                      {selectedExperience.description}
                    </p>
                  </GlassCard>
                </motion.div>
              )}
            </AnimatePresence>

            <div className="glass-panel p-4 rounded-3xl animate-float-slow">
              <div className="flex justify-between items-start mb-1">
                <div>
                  <h3 className="font-bold text-[15px]">
                    {selectedExperience.title} · {selectedExperience.location}
                  </h3>
                  <p className="text-[11px] text-white/60 mt-0.5">
                    {selectedExperience.subtitle} · {selectedExperience.price}
                  </p>
                </div>
                <span className="flex items-center gap-1 text-xs font-semibold text-yellow-400 shrink-0">
                  <Star size={11} className="fill-yellow-400" />{" "}
                  {selectedExperience.rating}
                </span>
              </div>

              <div className="flex gap-3">
<button
                onClick={() => goMatch(`想预约 ${selectedExperience.title} · ${selectedExperience.location} 的体验工作坊`)}
                className="flex-1 py-2.5 rounded-2xl btn-primary font-bold text-xs glow-purple-strong hover:brightness-110 active:scale-[0.98] transition-[filter,transform]"
              >
                预约工作坊
              </button>
                <button
                  onClick={() => toggleCart(selectedExperience.id)}
                  className={`flex-1 py-2.5 rounded-2xl glass-panel font-bold text-xs transition-colors ${
                    addedToCart
                      ? "border-emerald-400/60 text-emerald-300 glow-cyan"
                      : "hover:border-white/60"
                  }`}
                >
                  <AnimatePresence mode="wait" initial={false}>
                    {addedToCart ? (
                      <motion.span
                        key="added"
                        initial={{ scale: 0.6, opacity: 0 }}
                        animate={{ scale: 1, opacity: 1 }}
                        exit={{ scale: 0.6, opacity: 0 }}
                        transition={{ type: "spring", stiffness: 400, damping: 18 }}
                        className="flex items-center justify-center gap-1.5"
                      >
                        <Check size={12} /> 已加入
                      </motion.span>
                    ) : (
                      <motion.span
                        key="idle"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="flex items-center justify-center gap-1.5"
                      >
                        <Sparkles size={12} /> 心愿单
                      </motion.span>
                    )}
                  </AnimatePresence>
                </button>
              </div>
            </div>
          </>
        )}
      </div>

      {/* P0 接电：4:3 存证水印相机模态（拍照 → 水印+哈希指纹 → 本地存证列表） */}
      {photoOpen && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-40 bg-black/50 backdrop-blur-sm"
            onClick={() => setPhotoOpen(false)}
          />
          <motion.div
            initial={{ y: 60, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ type: "spring", stiffness: 300, damping: 28 }}
            className="fixed inset-x-3 bottom-24 z-50 glass-panel rounded-3xl p-4 max-h-[72vh] overflow-y-auto no-scrollbar"
          >
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-[13px] font-extrabold flex items-center gap-1.5">
                <Camera size={13} className="text-brandCyan" /> 拍照存证 · 时间地点水印
              </h3>
              <button
                onClick={() => setPhotoOpen(false)}
                aria-label="关闭相机"
                className="text-white/40 hover:text-white"
              >
                ✕
              </button>
            </div>
            {proofShots.length > 0 && (
              <p className="text-[10px] text-emerald-300/80 mb-2">
                ✅ 当前已存证 {proofShots.length} 张（含水印 + SHA-256 指纹）
              </p>
            )}
            <ProofCamera
              orderNo={cameraOrderNo}
              geo={{ lat: 31.2304, lng: 121.4737, accuracyMeters: 25 }}
              onCaptured={(result) => {
                onProofShot({
                  photo: result.dataUrl,
                  aiNote: `水印存证 · 时间地点注入 · 哈希 ${result.sha256.slice(0, 8)}`,
                });
                setPhotoOpen(false);
                toast(
                  "✅ 存证照片已生成 · 时间地点水印 + 哈希指纹已记录",
                  "success"
                );
              }}
            />
          </motion.div>
        </>
      )}
    </div>
  );
}

/* ============================ TRIP ============================ */
function TripPage({ proofShots = [] }: { proofShots?: ArbitrationPhotoEvidence[] }) {
  const tabs = ["行程", "AR 指南", "地图视图", "分享行程"];
  const [activeTab, setActiveTab] = useState("行程");
  const [shareCopied, setShareCopied] = useState(false);
  const bookings = useAppStore((s) => s.bookings);
  const setSelectedBooking = useAppStore((s) => s.setSelectedBooking);
  const setScreen = useAppStore((s) => s.setScreen);

  const sortedActivities = useMemo(
    () =>
      [...otoActivities].sort(
        (a, b) => new Date(a.time).getTime() - new Date(b.time).getTime()
      ),
    []
  );

  function openOrder(bookingId: string) {
    setSelectedBooking(bookingId);
    setScreen("profile");
  }

  function goTripHome() {
    setActiveTab("行程");
  }

  return (
    <div className="pointer-events-auto">
      {/* W3 总装：进行中订单（MATCHED / IN_SERVICE / INSPECTED）→ 顶部主视口优先渲染履约座舱 */}
      <FulfillmentCenter evidencePhotos={proofShots} />

      {/* 我的需求：需求方视角（信号波 + 接单 + 磋商 + 违约） */}
      <MyWaves />

      {/* 我的预订：AI 对话产生的订单汇入行程 */}
      {bookings.length > 0 && (
        <div className="mt-3">
          <span className="text-[11px] font-semibold text-white/50 mb-2 block">
            我的预订
          </span>
          <div className="flex gap-2 overflow-x-auto no-scrollbar -mx-1 px-1">
            {bookings.map((b) => (
              <button
                key={b.id}
                onClick={() => openOrder(b.id)}
                className="shrink-0 w-44 glass-panel rounded-2xl p-3 text-left hover:border-brandPurple/50 transition-colors active:scale-[0.98]"
              >
                <span className="text-lg block">{CATEGORY_EMOJI[b.category] ?? "🎟️"}</span>
                <span className="text-[11.5px] font-bold text-white/90 block truncate mt-1">
                  {b.providerName}
                </span>
                <span className="text-[9.5px] text-white/45 block truncate mt-0.5">
                  {b.time}
                </span>
                <span className="text-[11px] font-extrabold text-brandCyan block mt-1">
                  {b.price}
                </span>
              </button>
            ))}
          </div>
        </div>
      )}
      {/* 页面标题 */}
      <h2 className="text-[24px] leading-tight font-extrabold bg-clip-text text-transparent bg-linear-to-r from-white via-purple-200 to-brandPurple tracking-tight">
        我的 OTO 之旅
      </h2>
      <p className="text-[11px] text-white/60 mt-1">
        {bookings.length > 0
          ? `${bookings.length} 个真实预订已入行程 · 演示活动补充`
          : "马尔代夫 · 巴厘岛 · 3 天行程"}
      </p>
      {/* 3D 路线地图卡片 + 活动时间线：移动端纵向堆叠，桌面端左右并排 */}
      <div className="lg:grid lg:grid-cols-2 lg:gap-6 lg:items-start">
        <div>
          <div className="relative h-52 lg:h-72 rounded-3xl overflow-hidden mt-3 glass-panel-interactive bg-[rgba(13,16,32,0.45)]">
        {/* 3D 透视街道网格 */}
        <div
          className="absolute inset-0"
          style={{
            background: `
              linear-gradient(rgba(123, 97, 255, 0.22) 1px, transparent 1px),
              linear-gradient(90deg, rgba(123, 97, 255, 0.22) 1px, transparent 1px)`,
            backgroundSize: "26px 26px",
            transform: "perspective(600px) rotateX(58deg) scale(1.9)",
            transformOrigin: "50% 45%",
          }}
        />
        {/* 路线微光 */}
        <div className="absolute left-[10%] top-[52%] w-3/4 h-16 bg-brandPurple/20 blur-2xl" />

        {/* 轨迹线（Pin 1 → Pin 2） */}
        <svg className="absolute inset-0 w-full h-full" viewBox="0 0 400 200">
          <defs>
            <linearGradient id="routeGrad" x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" stopColor="#7B61FF" />
              <stop offset="100%" stopColor="#00F0FF" />
            </linearGradient>
          </defs>
          <line
            x1="88"
            y1="84"
            x2="300"
            y2="124"
            stroke="url(#routeGrad)"
            strokeWidth="2.5"
            strokeDasharray="7 6"
            strokeLinecap="round"
          />
        </svg>

        {/* Pin 1 */}
        <div className="absolute left-[14%] top-[30%] flex flex-col items-center gap-1">
          <span className="px-2 py-0.5 rounded-full bg-brandPurple/30 backdrop-blur-md border border-brandPurple/50 text-[9px] font-bold">
            Pin 1
          </span>
          <MapPin
            size={22}
            className="text-brandPurple drop-shadow-[0_0_10px_rgba(123,97,255,0.9)]"
          />
          <span className="text-[9px] font-semibold text-white/90 bg-white/10 backdrop-blur-md border border-white/25 rounded-full px-2 py-0.5">
            马尔代夫
          </span>
        </div>

        {/* Pin 2 */}
        <div className="absolute right-[8%] bottom-[18%] flex flex-col items-center gap-1">
          <span className="px-2 py-0.5 rounded-full bg-brandCyan/30 backdrop-blur-md border border-brandCyan/50 text-[9px] font-bold text-cyan-200">
            Pin 2
          </span>
          <MapPin
            size={22}
            className="text-brandCyan drop-shadow-[0_0_10px_rgba(0,240,255,0.9)]"
          />
          <span className="text-[9px] font-semibold text-white/90 bg-white/10 backdrop-blur-md border border-white/25 rounded-full px-2 py-0.5">
            巴厘岛
          </span>
        </div>

        {/* 顶部徽章 */}
        <OtoBadge tone="cyan" className="absolute top-3 right-3 px-2.5 py-1 text-[10px]">
          3D 城市路线图 • 距离 1.2 公里
        </OtoBadge>

        {/* 底部标签 */}
        <div className="absolute bottom-0 inset-x-0 p-3 flex items-end justify-between">
          <div className="flex items-center gap-1 text-xs font-bold drop-shadow">
            <MapPin size={13} className="text-brandPurple" /> 马尔代夫 ➔ 巴厘岛
          </div>
        </div>
      </div>
      </div>

      {/* 右侧列：选项卡 + 活动时间线（桌面端内部滚动防溢出） */}
      <div className="mt-4 lg:mt-3 lg:max-h-[calc(100vh-9rem)] lg:overflow-y-auto lg:pr-1 no-scrollbar">
      {/* 选项卡 */}
      <div className="flex gap-1.5">
        {tabs.map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`flex-1 py-2 rounded-xl text-[10px] font-medium transition-all ${
              activeTab === tab
                ? "btn-primary text-white glow-purple-strong"
                : "glass-panel text-white/60 hover:text-white"
            }`}
          >
            {tab}
          </button>
        ))}
      </div>

      {/* Tab 内容 */}
      {activeTab === "行程" && (
        <>
          <span className="text-[11px] font-semibold text-white/50 mt-4 mb-2 block">
            即将开展的活动
          </span>
          <div className="relative">
            <div className="absolute left-[19px] top-2 bottom-2 w-px bg-linear-to-b from-brandPurple/60 via-white/20 to-brandCyan/50" />
            <div className="space-y-3">
              {/* 真实预订优先入时间线（AI 撮合 / waves 成局产生） */}
              {bookings
                .filter((b) => b.status === "upcoming")
                .map((b) => (
                  <div key={b.id} className="flex items-start gap-3">
                    <div className="relative shrink-0 mt-0.5">
                      <div className="w-10 h-10 rounded-2xl glass-panel flex items-center justify-center">
                        <span className="text-base">{CATEGORY_EMOJI[b.category] ?? "🎟️"}</span>
                      </div>
                    </div>
                    <button
                      onClick={() => openOrder(b.id)}
                      className="flex-1 glass-panel p-3 rounded-2xl text-left hover:border-brandCyan/50 transition-colors"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-[10px] font-bold text-brandCyan tracking-wide">
                          {b.time}
                        </span>
                        <span className="flex items-center gap-1 text-[10px] text-white/50">
                          <Check size={10} className="text-emerald-400" />
                          <span className="truncate max-w-[120px]">已确认</span>
                        </span>
                      </div>
                      <h4 className="text-xs font-bold mt-1.5 truncate">{b.title}</h4>
                      <p className="text-[10px] text-white/50 truncate">{b.providerName}</p>
                      <div className="flex items-center gap-2 mt-2">
                        <span className="flex items-center gap-1 px-2.5 py-1 rounded-full border border-brandCyan/40 text-brandCyan text-[10px] font-semibold">
                          {b.price}
                        </span>
                        <span className="text-[10px] text-white/40">点按查看订单</span>
                      </div>
                    </button>
                  </div>
                ))}
              {sortedActivities.map((act) => (
                <ActivityRow
                  key={act.id}
                  activity={act}
                  onNavigate={() => {
                    setActiveTab("地图视图");
                    toast(`🧭 已规划导航路线 · 下一站 ${act.title}（${act.location}）`, "success");
                  }}
                />
              ))}
            </div>
          </div>
        </>
      )}

      {activeTab === "AR 指南" && (
        <div className="mt-4 space-y-2.5">
          <span className="text-[11px] font-semibold text-white/50 mb-2 block">
            🥽 落地即开 · 每站一条 AR 指南
          </span>
          {sortedActivities.map((act, i) => (
            <div
              key={act.id}
              className="flex items-center gap-3 glass-panel rounded-2xl p-3"
            >
              <div className="w-10 h-10 rounded-2xl glass-panel flex items-center justify-center text-lg shrink-0">
                {act.type === "adventure" ? "🤿" : act.type === "cruise" ? "🚤" : act.type === "dining" ? "🍽️" : "🏝️"}
              </div>
              <div className="flex-1 min-w-0">
                <h4 className="text-xs font-bold truncate">{act.title}</h4>
                <p className="text-[10px] text-white/50 truncate">
                  {formatActivityTime(act.time)} · {act.location}
                </p>
              </div>
              <span className="text-[9px] font-bold px-2 py-1 rounded-full bg-brandCyan/15 border border-brandCyan/40 text-brandCyan shrink-0">
                AR 导航 {i + 1}/{sortedActivities.length}
              </span>
            </div>
          ))}
          <p className="text-[9px] text-white/35 pt-1">
            到站后打开相机，光点会引导你找到集合点与向导 🤖
          </p>
        </div>
      )}

      {activeTab === "地图视图" && (
        <div className="mt-4">
          <span className="text-[11px] font-semibold text-white/50 mb-2 block">
            🗺️ 全览地图 · 马尔代夫 ⇄ 巴厘岛
          </span>
          <div className="grid grid-cols-2 gap-2">
            {sortedActivities.map((act, i) => (
              <div
                key={act.id}
                className="glass-panel rounded-2xl p-2.5 text-center"
              >
                <span className="text-base">{act.type === "adventure" ? "🤿" : act.type === "cruise" ? "🚤" : act.type === "dining" ? "🍽️" : "🏝️"}</span>
                <p className="text-[10px] font-bold text-white/85 mt-1 truncate">{act.title}</p>
                <p className="text-[9px] text-white/40">{act.location}</p>
                <span className="inline-block mt-1.5 text-[8.5px] font-bold px-1.5 py-0.5 rounded-full bg-brandPurple/15 border border-brandPurple/40 text-brandPurple">
                  Pin {i + 1}
                </span>
              </div>
            ))}
          </div>
          <div className="mt-2.5 flex items-center gap-1.5 text-[9.5px] text-white/45">
            <MapPin size={10} className="text-brandPurple" />
            共 {sortedActivities.length} 站 · 直线距离 1,200 km · 全程 3 天
          </div>
        </div>
      )}

      {activeTab === "分享行程" && (
        <div className="mt-4">
          <span className="text-[11px] font-semibold text-white/50 mb-2 block">
            📤 分享给同行人
          </span>
          <div className="glass-panel rounded-2xl p-3.5">
            <p className="text-[11px] font-bold text-white/90">
              我的 OTO 之旅 · 马尔代夫 ⇄ 巴厘岛
            </p>
            <p className="text-[9.5px] text-white/45 mt-0.5">
              3 天 4 站 · {sortedActivities[0] ? formatActivityTime(sortedActivities[0].time) : ""} 出发
            </p>
            <div className="flex gap-2 mt-3">
              <button
                onClick={() => setShareCopied(true)}
                className="flex-1 py-2 rounded-xl btn-primary text-[10.5px] font-bold glow-purple-strong hover:brightness-110 active:scale-[0.98] transition-[filter,transform]"
              >
                {shareCopied ? "✓ 已复制" : "复制行程链接"}
              </button>
              <button
                onClick={() => goTripHome()}
                className="flex-1 py-2 rounded-xl glass-panel text-[10.5px] font-bold text-white/80 hover:text-white transition-colors"
              >
                ✈️ 继续安排
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 探索更多 */}
      <button
        onClick={() => setScreen("home")}
        className="mt-5 w-full py-2.5 rounded-2xl glass-panel text-xs font-semibold text-white/80 flex items-center justify-center gap-1.5 hover:border-brandPurple/50 transition-colors"
      >
        <Sparkles size={13} className="text-brandPurple" /> 预约更多线下体验
      </button>
      </div>
      </div>
    </div>
  );
}

function ActivityRow({
  activity,
  onNavigate,
}: {
  activity: OTOActivity;
  onNavigate?: () => void;
}) {
  return (
    <div className="flex items-start gap-3">
      {/* 时间线节点 */}
      <div className="relative shrink-0 mt-0.5">
        <div className="w-10 h-10 rounded-2xl glass-panel flex items-center justify-center">
          <Sparkles size={15} className="text-brandCyan" />
        </div>
      </div>
      {/* 卡片 */}
      <div className="flex-1 glass-panel p-3 rounded-2xl hover:border-brandPurple/50 transition-colors">
        <div className="flex items-center justify-between gap-2">
          <span className="text-[10px] font-bold text-brandCyan tracking-wide">
            {formatActivityTime(activity.time)}
          </span>
          <span className="flex items-center gap-1 text-[10px] text-white/50">
            <MapPin size={10} className="text-brandPurple" />
            <span className="truncate max-w-[120px]">{activity.location}</span>
          </span>
        </div>
        <h4 className="text-xs font-bold mt-1.5 truncate">{activity.title}</h4>
        <p className="text-[10px] text-white/50 truncate">{activity.subtitle}</p>
        <div className="flex items-center gap-2 mt-2">
          <button
            onClick={onNavigate}
            className="flex items-center gap-1 px-2.5 min-h-8 rounded-full border border-brandCyan/40 text-brandCyan text-[10px] font-semibold hover:bg-brandCyan/10 transition-colors"
          >
            <Navigation size={10} /> 导航
          </button>
          <span className="text-[10px] text-white/40">{activity.location}</span>
        </div>
      </div>
    </div>
  );
}
