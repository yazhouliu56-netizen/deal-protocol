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
import { listAmmoPillDescriptors } from "@/ammo/registry";
import { otoExperiences } from "@/lib/mockData";
import {
  Camera,
  Check,
  ChevronRight,
  Info,
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
  /** 弹药胶囊栏（注册表单一真理源：官方四枚 + 动态池热注弹药，工厂上新首页自动长出）。 */
  const ammoPills = useMemo(() => listAmmoPillDescriptors(), []);
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

        {/* 弹药胶囊栏：注册表动态驱动（官方四枚 + 动态池热注；每枚挂 data-ammo / data-theme
            主题色作用域 —— 点击精准唤起对应弹药拟物草稿卡） */}
        <div
          className="mt-2 flex gap-2 overflow-x-auto no-scrollbar pb-0.5"
          data-layer="ammo-pills"
          data-testid="ammo-pill-bar"
        >
          {ammoPills.map((pill) => (
            <motion.button
              key={pill.ammoId}
              whileTap={{ scale: 0.95 }}
              onClick={() =>
                setDraft({ key: pill.label, label: pill.label })
              }
              data-ammo={pill.ammoId}
              data-category={pill.category}
              data-theme={pill.theme}
              aria-label={`${pill.label} · 一键弹药发单`}
              className="shrink-0 flex items-center gap-1.5 px-3.5 py-2 rounded-full glass-panel-interactive transition-[border,transform]"
              style={{
                borderColor: "var(--theme-border)",
                boxShadow: `0 2px 12px -3px var(--theme-glow), inset 0 1px 0 rgba(255,255,255,0.35)`,
                background:
                  "linear-gradient(135deg, var(--theme-surface-tint), rgba(255,255,255,0.05))",
              }}
            >
              <span className="text-sm leading-none">{pill.icon}</span>
              <span className="text-[11px] font-extrabold text-white/90 whitespace-nowrap">
                {pill.label}
              </span>
            </motion.button>
          ))}
        </div>

        {/* AI 发单中枢（slim 灭双头怪）：常驻发单对话框（文本输入 + 按住说话 + 发射按钮）+ 限高消息流
            重复的 AI 撮合标题 / 四大意图气泡 / 初始重播问候卡在 slim 模式下收敛隐藏；
            多轮澄清与订单卡转化能力 100% 保留；文本/语音意图命中弹药 → 原地展开拟物草稿卡 */}
        <div className="mt-2.5">
          <ChatPage
            compact
            slim
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
/** Trip 屏：以通用五态履约座舱为唯一核心的行程与活动订单中枢（旅游假数据已彻底出清）。 */
function TripPage({ proofShots = [] }: { proofShots?: ArbitrationPhotoEvidence[] }) {
  const bookings = useAppStore((s) => s.bookings);
  const setSelectedBooking = useAppStore((s) => s.setSelectedBooking);
  const setScreen = useAppStore((s) => s.setScreen);
  const waves = useWaveStore((s) => s.waves);
  const identity = useIdentityStore((s) => s.identity);

  /** 当前用户进行中订单（与 FulfillmentCenter 同源投影：决定顶部渲染座舱还是空态）。 */
  const activeOrder = useMemo(() => {
    const mine = waves.filter(
      (w) =>
        w.authorId === identity.id &&
        w.status !== "closed" &&
        w.status !== "expired" &&
        w.status !== "pending" &&
        !w.removed,
    );
    return mine[0] ?? null;
  }, [waves, identity.id]);

  function openOrder(bookingId: string) {
    setSelectedBooking(bookingId);
    setScreen("profile");
  }

  const upcoming = bookings.filter((b) => b.status === "upcoming");

  return (
    <div className="pointer-events-auto">
      {/* 核心视口：进行中订单 → 通用五态履约座舱（无进行中单则由 FulfillmentCenter 自隐藏） */}
      <FulfillmentCenter evidencePhotos={proofShots} />

      {/* 无进行中订单 → 极简科技感雷达空态 */}
      {!activeOrder && (
        <div className="mt-2 glass-panel rounded-3xl p-6 flex flex-col items-center text-center"
          data-testid="trip-empty-state">
          <div className="relative w-20 h-20 flex items-center justify-center">
            <span className="absolute inset-0 rounded-full border border-brandCyan/30 animate-ping" />
            <span className="absolute inset-2.5 rounded-full border border-brandPurple/30" />
            <span className="text-2xl">📡</span>
          </div>
          <p className="text-[12px] font-extrabold text-white/85 mt-3">
            当前暂无进行中行程
          </p>
          <p className="text-[10px] text-white/45 mt-1">
            去首页发单，或去雷达抢单 · 履约座舱在此实时接管
          </p>
          <button
            onClick={() => setScreen("home")}
            className="mt-3 px-4 py-2 rounded-xl btn-primary glow-purple-strong text-[11px] font-bold active:scale-95 transition-[filter,transform]"
          >
            ✨ 去首页发单
          </button>
        </div>
      )}

      {/* 我的需求：需求方视角（信号波 + 接单 + 磋商 + 违约） */}
      <MyWaves />

      {/* 我的预订：AI 对话产生的真实订单汇入行程中枢 */}
      {bookings.length > 0 && (
        <div className="mt-3">
          <span className="text-[11px] font-semibold text-white/50 mb-2 flex items-center gap-1.5">
            <span className="w-1 h-3 rounded-full bg-linear-to-b from-brandCyan to-brandPurple" />
            我的预订
          </span>
          <div className="flex justify-between items-baseline mb-2">
            <p className="text-[10px] text-white/40">
              共 {bookings.length} 个真实预订 · 点按进入订单详情
            </p>
            <span className="text-[9px] px-2 py-0.5 rounded-full bg-brandCyan/15 border border-brandCyan/40 text-brandCyan font-bold">
              履约中枢
            </span>
          </div>
          <div className="flex flex-col gap-2">
            {upcoming.map((b) => (
              <button
                key={b.id}
                onClick={() => openOrder(b.id)}
                className="w-full glass-panel rounded-2xl p-3 flex items-center gap-3 text-left hover:border-brandPurple/50 transition-colors active:scale-[0.99]"
              >
                <div className="w-10 h-10 rounded-xl glass-panel flex items-center justify-center text-lg shrink-0">
                  {CATEGORY_EMOJI[b.category] ?? "🎟️"}
                </div>
                <div className="flex-1 min-w-0">
                  <span className="flex items-center gap-2">
                    <span className="text-[12.5px] font-bold truncate">{b.title}</span>
                    <span className="text-[9px] px-1.5 py-px rounded-full bg-brandPurple/20 border border-brandPurple/40 text-brandPurple font-semibold shrink-0">
                      待出行
                    </span>
                  </span>
                  <p className="text-[10px] text-white/50 mt-0.5 truncate">
                    {b.time} · {b.providerName}
                  </p>
                </div>
                <span className="text-[12px] font-extrabold text-brandCyan shrink-0">
                  {b.price}
                </span>
              </button>
            ))}
            {bookings.filter((b) => b.status !== "upcoming").map((b) => (
              <button
                key={b.id}
                onClick={() => openOrder(b.id)}
                className="w-full glass-panel rounded-2xl p-3 flex items-center gap-3 text-left hover:border-brandPurple/50 transition-colors active:scale-[0.99]"
              >
                <div className="w-10 h-10 rounded-xl glass-panel flex items-center justify-center text-lg shrink-0">
                  {CATEGORY_EMOJI[b.category] ?? "🎟️"}
                </div>
                <div className="flex-1 min-w-0">
                  <span className="flex items-center gap-2">
                    <span className="text-[12.5px] font-bold truncate">{b.title}</span>
                    <span
                      className={`text-[9px] px-1.5 py-px rounded-full font-semibold shrink-0 ${
                        b.status === "cancelled"
                          ? "bg-white/10 border border-white/20 text-white/50"
                          : "bg-emerald-400/10 border border-emerald-400/30 text-emerald-400"
                      }`}
                    >
                      {b.status === "cancelled" ? "已取消" : "已完成"}
                    </span>
                  </span>
                  <p className="text-[10px] text-white/50 mt-0.5 truncate">
                    {b.time} · {b.providerName}
                  </p>
                </div>
                <span className="text-[12px] font-extrabold text-brandCyan shrink-0">
                  {b.price}
                </span>
              </button>
            ))}
          </div>
        </div>
      )}

      {bookings.length === 0 && (
        <div className="mt-4 glass-panel rounded-2xl p-4 text-center">
          <p className="text-[11px] text-white/40">
            还没有预订——去首页对 AI 说句需求，订单会汇入这里的履约中枢
          </p>
        </div>
      )}
    </div>
  );
}
