"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import Stage from "@/components/3d/Stage";
import HoloCard, { HoloBoundary } from "@/components/3d/HoloCard";
import ChatPage from "@/components/chat/ChatPage";
import ProfilePage from "@/components/profile/ProfilePage";
import FloatingDock from "@/components/ui/FloatingDock";
import GlassCard from "@/components/ui/GlassCard";
import GlassIconButton from "@/components/ui/GlassIconButton";
import Badge from "@/components/ui/Badge";
import CategoryPill from "@/components/ui/CategoryPill";
import SearchBar from "@/components/ui/SearchBar";
import WaveFeed from "@/components/waves/WaveFeed";
import MyWaves from "@/components/waves/MyWaves";
import SafetyKit from "@/components/waves/SafetyKit";
import { useAppStore } from "@/store/useAppStore";
import { initLowPower, isLowPower } from "@/lib/performance";
import {
  CATEGORY_LABELS,
  OTO_CATEGORIES,
  formatActivityTime,
  otoActivities,
  otoExperiences,
  type OTOActivity,
  type OTOCategory,
  type OTOExperience,
} from "@/lib/mockData";
import {
  Bot,
  Building2,
  Camera,
  Check,
  ChevronRight,
  Info,
  Landmark,
  MapPin,
  Mountain,
  Navigation,
  Rocket,
  Rotate3d,
  ShoppingBag,
  Sparkles,
  Star,
  Trash2,
  Umbrella,
} from "lucide-react";

const CATEGORY_EMOJI: Record<string, string> = {
  羽毛球约局: "🏸",
  摄影师约拍: "📷",
  家政保洁: "🧹",
};

const AI_HOT_SERVICES = [
  { emoji: "🏸", label: "羽毛球约局", draft: "周日下午想找人打羽毛球" },
  { emoji: "📷", label: "摄影师约拍", draft: "想约摄影师拍一组日系写真" },
  { emoji: "🧹", label: "家政保洁", draft: "周末找个保洁上门" },
  { emoji: "👥", label: "陪诊陪护", draft: "想找人陪家人去医院看诊" },
];

const SWATCHES = [
  { color: "#7B61FF", label: "紫罗兰" },
  { color: "#00A3FF", label: "天蓝" },
  { color: "#4ADE80", label: "草绿" },
  { color: "#F472B6", label: "粉红" },
];

const CATEGORY_ICON: Record<OTOCategory, typeof Umbrella> = {
  Beach: Umbrella,
  Mountains: Mountain,
  City: Building2,
  Historical: Landmark,
  Adventure: Rocket,
};

const screenVariants = {
  initial: { opacity: 0, y: 18, scale: 0.985 },
  animate: { opacity: 1, y: 0, scale: 1 },
  exit: { opacity: 0, y: -12, scale: 0.99 },
};

const listContainer = {
  hidden: {},
  show: { transition: { staggerChildren: 0.06 } },
};

const listItem = {
  hidden: { opacity: 0, y: 16 },
  show: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.4, ease: [0.16, 1, 0.3, 1] as const },
  },
};

export default function Home() {
  const screen = useAppStore((s) => s.screen);

  useEffect(() => {
    initLowPower();
  }, []);

  return (
    <main className="app-env h-screen w-full overflow-hidden relative text-white">
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
            {screen === "ai" && <ChatPage />}
            {screen === "ar" && <ARPage />}
            {screen === "trip" && <TripPage />}
            {screen === "profile" && <ProfilePage />}
          </div>
        </motion.div>
      </AnimatePresence>

      {/* 底部悬浮 Dock：固定在真实屏幕底部（store 驱动） */}
      <FloatingDock />
    </main>
  );
}

/* ============================ HOME ============================ */
function HomePage() {
  const activeCategory = useAppStore((s) => s.activeCategory);
  const setActiveCategory = useAppStore((s) => s.setActiveCategory);
  const openExperience = useAppStore((s) => s.openExperience);
  const setScreen = useAppStore((s) => s.setScreen);
  const setAiDraft = useAppStore((s) => s.setAiDraft);
  const [search, setSearch] = useState("");
  const [showCart, setShowCart] = useState(false);
  const cart = useAppStore((s) => s.cart);
  const toggleCart = useAppStore((s) => s.toggleCart);
  const clearCart = useAppStore((s) => s.clearCart);
  const destinationsRef = useRef<HTMLDivElement>(null);

  const visibleExperiences = useMemo(() => {
    const q = search.trim().toLowerCase();
    const byCategory = activeCategory
      ? otoExperiences.filter((e) => e.category === activeCategory)
      : otoExperiences;
    if (!q) return byCategory;
    return byCategory.filter(
      (e) =>
        e.title.toLowerCase().includes(q) ||
        e.subtitle.toLowerCase().includes(q) ||
        e.location.toLowerCase().includes(q) ||
        CATEGORY_LABELS[e.category]?.toLowerCase().includes(q)
    );
  }, [activeCategory, search]);

  const searchResultCategory = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return null;
    return (
      OTO_CATEGORIES.find((c) => CATEGORY_LABELS[c].toLowerCase().includes(q)) ??
      null
    );
  }, [search]);

  return (
    <div className="pointer-events-auto">
      {/* 问候语 + 标题 */}
      <div className="flex items-center gap-2.5 mb-1">
        <div className="w-9 h-9 rounded-full btn-primary flex items-center justify-center text-sm font-extrabold shadow-lg glow-purple-strong">
          A
        </div>
        <p className="text-[13px] text-white/75 font-medium flex-1">
          Hello, Alex! 👋
        </p>
        <button
          onClick={() => setShowCart(true)}
          aria-label={`心愿单，共 ${cart.length} 项`}
          className="relative w-9 h-9 rounded-full glass-panel-interactive flex items-center justify-center shrink-0 hover:border-brandPurple/50 active:scale-95 transition-[border,transform]"
        >
          <ShoppingBag size={15} className="text-white/80" />
          {cart.length > 0 && (
            <span className="absolute -top-1 -right-1 min-w-4 h-4 px-1 rounded-full bg-brandPurple border border-white/30 text-[9px] font-bold text-white flex items-center justify-center">
              {cart.length}
            </span>
          )}
        </button>
      </div>

      {/* 雷达 Feed：主导首页 */}
      <WaveFeed />

      {/* AI 对话条：常驻需求入口 */}
      <button
        onClick={() => setScreen("ai")}
        className="mt-4 w-full flex items-center gap-2.5 px-4 py-3 rounded-2xl glass-panel-interactive text-left group"
      >
        <div className="w-8 h-8 rounded-xl bg-linear-to-b from-[rgba(139,92,246,0.85)] to-[rgba(99,72,255,0.65)] border border-white/25 flex items-center justify-center shrink-0 shadow-[0_2px_14px_-2px_rgba(123,97,255,0.7),inset_0_1px_0_rgba(255,255,255,0.45)]">
          <Bot size={15} className="text-white" />
        </div>
        <div className="flex-1 min-w-0">
          <span className="block text-xs font-semibold text-white/90">
            想找什么，直接说
          </span>
          <span className="block text-[10px] text-white/45 truncate">
            羽毛球约局 · 约拍 · 保洁…… AI 帮你撮合
          </span>
        </div>
        <span className="text-[10px] text-brandPurple font-semibold shrink-0 px-2 py-1 rounded-full bg-brandPurple/15 border border-brandPurple/30 group-hover:bg-brandPurple/25 transition-colors">
          去问问
        </span>
      </button>

      {/* AI 热门服务：点卡自动带需求进对话 */}
      <div className="mt-3">
        <span className="text-[10px] font-semibold text-white/40 flex items-center gap-1 mb-1.5">
          <Sparkles size={10} className="text-brandPurple" /> AI 热门撮合 · 点一下直接说需求
        </span>
        <div className="flex gap-2 overflow-x-auto no-scrollbar -mx-1 px-1 pb-0.5">
          {AI_HOT_SERVICES.map((s) => (
            <button
              key={s.label}
              onClick={() => {
                setAiDraft(s.draft);
                setScreen("ai");
              }}
              className="shrink-0 flex flex-col items-center gap-1 px-4 py-2.5 min-w-[76px] rounded-2xl glass-panel-interactive hover:border-brandPurple/50 active:scale-95 transition-[border,transform]"
            >
              <span className="text-lg">{s.emoji}</span>
              <span className="text-[10px] font-bold text-white/80">
                {s.label}
              </span>
            </button>
          ))}
        </div>
      </div>

      {/* 搜索栏 */}
      <div className="mt-4">
        <SearchBar
          placeholder="搜索 OTO 体验或线下门店……"
          value={search}
          onChange={setSearch}
          onSearch={() => {
            const q = search.trim();
            if (!q) return;
            if (searchResultCategory) {
              setActiveCategory(searchResultCategory);
              setSearch("");
              return;
            }
            setAiDraft(q);
            setScreen("ai");
          }}
        />
      </div>

      {search.trim() && (
        <div className="mt-3 flex items-center gap-2">
          <span className="text-[10.5px] text-white/50">
            “{search.trim()}” 命中 {visibleExperiences.length} 个目的地
          </span>
          <span className="flex-1 h-px bg-white/10" />
          <button
            onClick={() => {
              setAiDraft(search.trim());
              setScreen("ai");
            }}
            className="text-[10.5px] font-bold text-brandPurple border border-brandPurple/40 bg-brandPurple/15 rounded-full px-2.5 py-1 hover:bg-brandPurple/25 transition-colors"
          >
            ✨ 让 AI 撮合
          </button>
        </div>
      )}

      {/* 分类胶囊 */}
      <div className="flex flex-wrap gap-2 mt-4">
        <CategoryPill
          active={activeCategory === null}
          onClick={() => setActiveCategory(null)}
        >
          全部
        </CategoryPill>
        {OTO_CATEGORIES.map((cat) => {
          const Icon = CATEGORY_ICON[cat];
          return (
            <CategoryPill
              key={cat}
              active={activeCategory === cat}
              onClick={() => setActiveCategory(activeCategory === cat ? null : cat)}
            >
              <Icon size={12} />
              {CATEGORY_LABELS[cat]}
            </CategoryPill>
          );
        })}
      </div>

      {/* Popular Destinations 高清阳光实景卡片 */}
      <div className="flex items-center justify-between mt-6 mb-2.5">
        <span className="text-[13px] font-semibold tracking-wide">
          {activeCategory
            ? `${CATEGORY_LABELS[activeCategory]}热门目的地`
            : "热门目的地"}
        </span>
        <button
          onClick={() => destinationsRef.current?.scrollIntoView({ behavior: "smooth", block: "start" })}
          className="flex items-center gap-0.5 text-[11px] text-brandPurple font-medium hover:brightness-125 transition-[filter]"
        >
          查看全部 <ChevronRight size={12} />
        </button>
      </div>
      <motion.div
        ref={destinationsRef}
        variants={listContainer}
        initial="hidden"
        animate="show"
        className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 2xl:grid-cols-5 gap-3 md:gap-5"
      >
        {visibleExperiences.map((item, i) => (
          <DestinationCard
            key={item.id}
            item={item}
            index={i}
            onOpen={() => openExperience(item)}
          />
        ))}
      </motion.div>

      {/* 安全四件套入口 */}
      <div className="mt-5">
        <SafetyKit />
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
                        setScreen("ai");
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
    </div>
  );
}

/** 3D holographic destination card with 2D lazy fallback (low power / offline / no WebGL). */
function DestinationCard({
  item,
  index,
  onOpen,
}: {
  item: OTOExperience;
  index: number;
  onOpen: () => void;
}) {
  const [hover, setHover] = useState(false);
  const [holoFailed, setHoloFailed] = useState(false);
  const [photoReady, setPhotoReady] = useState(false);
  const [mounted, setMounted] = useState(false);
  const lowPower = useMemo(() => isLowPower(), []);
  // Mounted first so SSR and first client frame both render the 2D fallback
  // (isLowPower() differs on server vs client — avoids hydration mismatch).
  // 3D mounts only after the 2D photo is ready: texture loads from browser
  // cache instantly, so there is never a white/blank 3D card on slow networks.
  const use3D = mounted && !lowPower && !holoFailed && photoReady;
  const priceParts = useMemo(() => {
    const idx = item.price.indexOf("/");
    return idx > 0
      ? [item.price.slice(0, idx), item.price.slice(idx)]
      : [item.price, ""];
  }, [item.price]);

  useEffect(() => {
    const id = requestAnimationFrame(() => setMounted(true));
    return () => cancelAnimationFrame(id);
  }, []);

  return (
    <motion.div
      variants={listItem}
      className="animate-float-slow"
      style={{ animationDelay: `${(index % 2) * 0.9}s` }}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
    >
      <motion.button
        onClick={onOpen}
        whileHover={{ y: -6 }}
        transition={{ type: "spring", stiffness: 320, damping: 22 }}
        className="relative w-full h-44 md:h-48 lg:h-56 rounded-3xl overflow-hidden glass-panel-interactive text-left"
      >
        {use3D ? (
          <HoloBoundary onFail={() => setHoloFailed(true)}>
            <HoloCard url={item.imageUrl} hover={hover} />
          </HoloBoundary>
        ) : (
          <DestinationCardImage
            url={item.imageUrl}
            onReady={() => setPhotoReady(true)}
          />
        )}
        <div className="absolute inset-x-0 bottom-0 card-inlay p-2.5 rounded-b-3xl">
          <div className="flex items-center justify-between gap-1">
            <span className="text-[13px] font-extrabold truncate">
              {item.title}
            </span>
            <span className="flex items-center gap-0.5 text-[10px] font-bold text-yellow-400 bg-white/10 backdrop-blur-sm rounded-full px-1.5 py-0.5 shrink-0">
              <Star size={9} className="fill-yellow-400" />
              {item.rating}
            </span>
          </div>
          <span className="text-[10px] text-white/60 block truncate">
            {item.subtitle}
          </span>
          <span className="flex items-baseline gap-1 mt-0.5">
            <span className="text-[11px] font-extrabold bg-clip-text text-transparent bg-linear-to-r from-brandCyan to-brandPurple">
              {priceParts[0]}
            </span>
            <span className="text-[9px] font-light text-white/50">
              {priceParts[1]}
            </span>
          </span>
        </div>
        {item.hasAR && (
          <Badge className="absolute top-2.5 right-2.5">AR</Badge>
        )}
      </motion.button>
    </motion.div>
  );
}

/** IntersectionObserver-powered lazy loader. */
function useInView<T extends HTMLElement>(margin = "200px") {
  const ref = useRef<T>(null);
  const [inView, setInView] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const ob = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setInView(true);
          ob.disconnect();
        }
      },
      { rootMargin: margin }
    );
    ob.observe(el);
    return () => ob.disconnect();
  }, [margin]);
  return { ref, inView };
}

/** Lazy-loaded sunny destination photo with shimmer skeleton + fade-in. */
function DestinationCardImage({
  url,
  onReady,
}: {
  url: string;
  onReady?: () => void;
}) {
  const { ref, inView } = useInView<HTMLDivElement>();
  const [loaded, setLoaded] = useState(false);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    if (!inView) return;
    const img = new Image();
    img.onload = () => {
      setLoaded(true);
      onReady?.();
    };
    img.onerror = () => setFailed(true);
    img.src = url;
  }, [inView, url, onReady]);

  return (
    <div ref={ref} className="absolute inset-0">
      {!loaded && !failed && <div className="absolute inset-0 shimmer" />}
      {failed && (
        <div className="absolute inset-0 bg-linear-to-b from-brandPurple/30 to-[#0d1030]" />
      )}
      {inView && (
        <div
          className={`absolute inset-0 bg-cover bg-center [mask-image:linear-gradient(to_top,black_45%,transparent_100%)] [mask-size:100%_100%] transition-opacity duration-500 ${
            loaded ? "opacity-100" : "opacity-0"
          }`}
          style={{ backgroundImage: `url(${url})` }}
        />
      )}
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

function ARPage() {
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

  const addedToCart = cart.includes(selectedExperience.id);

  function goMatch(draft: string) {
    setAiDraft(draft);
    setScreen("ai");
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
                AR VIEWFINDER
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
              <GlassIconButton size="sm" aria-label="拍照留影">
                <Camera size={14} />
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
    </div>
  );
}

/* ============================ TRIP ============================ */
function TripPage() {
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
        马尔代夫 · 巴厘岛 · 3 天行程
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
        <Badge tone="cyan" className="absolute top-3 right-3 px-2.5 py-1 text-[10px]">
          3D 城市路线图 • 距离 1.2 公里
        </Badge>

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
              {sortedActivities.map((act) => (
                <ActivityRow key={act.id} activity={act} />
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
        onClick={() => setScreen("ai")}
        className="mt-5 w-full py-2.5 rounded-2xl glass-panel text-xs font-semibold text-white/80 flex items-center justify-center gap-1.5 hover:border-brandPurple/50 transition-colors"
      >
        <Sparkles size={13} className="text-brandPurple" /> 预约更多线下体验
      </button>
      </div>
      </div>
    </div>
  );
}

function ActivityRow({ activity }: { activity: OTOActivity }) {
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
          <button className="flex items-center gap-1 px-2.5 py-1 rounded-full border border-brandCyan/40 text-brandCyan text-[10px] font-semibold hover:bg-brandCyan/10 transition-colors">
            <Navigation size={10} /> 导航
          </button>
          <span className="text-[10px] text-white/40">{activity.location}</span>
        </div>
      </div>
    </div>
  );
}
