"use client";
import { motion } from "framer-motion";
import type { ScenarioTheme } from "@/types/ui-viewport";

/** 弹药胶囊描述符（注册表 listAmmoPillDescriptors 单行结构，类型同源零漂移）。 */
export interface AmmoPillDescriptor {
  ammoId: string;
  category: string;
  label: string;
  icon: string;
  theme: ScenarioTheme;
}

interface AmmoPillBarProps {
  pills: AmmoPillDescriptor[];
  onSelectDraft: (draft: { key: string; label: string }) => void;
  /**
   * compact = 设计图轻量横滑胶囊；tiles = 48px+ 大磁贴（默认，E2E 守恒）；
   * featured = 1:1 图纸弹药库预览（标题 + 四展位中括号胶囊 + 平头哥）。
   */
  variant?: "tiles" | "compact" | "featured";
  /** 附近有活水时平头哥醒来（HomePage 同源投影，默认酣睡）。 */
  hasLiveWaves?: boolean;
}

/**
 * 图纸展位弹药（1:1 设计稿指定展位，按 ammoId 从注册表描述符中精选；
 * 展示的标签/图标/主题/配色 100% 注册表驱动，tsx 零手写品类数组——
 * 展位选择本身为图纸要求，见条文 #4 对照）。
 * 映射：组局社交 meetup / 家政保洁 housekeeping / 陪伴交友 companion /
 * 家电维修 appliance（图纸第 4 枚"闪送"无真实类目，按裁决补丁落家电维修）。
 */
const FEATURED_PILL_AMMO_IDS = [
  "meetup-social-v1",
  "housekeeping-v1",
  "companion-v1",
  "appliance-repair-v1",
];

/** 中括号胶囊主题配色（图纸精确色值，theme 派生，零品类名硬编码分支）。 */
const BRACKET_STYLE: Record<string, { bg: string; text: string }> = {
  meetup: { bg: "#ffe4e6", text: "#e11d48" },
  housekeeping: { bg: "#fef9c3", text: "#713f12" },
  companion: { bg: "#dbeafe", text: "#1d4ed8" },
  tech: { bg: "#ffedd5", text: "#c2410c" },
  default: { bg: "#ffedd5", text: "#c2410c" },
};

/** 轻标签后缀纯函数：由弹药 theme 派生，零品类名硬编码分支（宪法 #4）。 */
export function pillTagFor(theme: ScenarioTheme): string {
  switch (theme) {
    case "meetup":
      return "热门";
    case "housekeeping":
      return "高效";
    case "companion":
      return "艺术";
    case "tech":
      return "极速";
    default:
      return "精选";
  }
}

/** 熟睡平头哥（蜜獾）：蜷睡圆球 + 白斗篷覆背 + 暖橙底托
 *  （inline SVG，aria-hidden，零外部切图永不 404）。
 *  状态变脸：awake=true（附近有活水）睁眼醒来收起 zzz，false 继续酣睡。 */
function SleepyBeast({ awake = false }: { awake?: boolean }) {
  return (
    <span
      aria-hidden="true"
      className="mascot-bob flex h-20 w-20 shrink-0 items-center justify-center rounded-2xl bg-white border-2 border-[#e5e5e5] shadow-sm select-none"
    >
      <svg width="60" height="60" viewBox="0 0 40 40" fill="none" aria-hidden="true">
        {/* 暖橙底托 */}
        <circle cx="20" cy="20" r="17" fill="#ffedd5" />
        {/* 蜷睡身（深灰圆球） */}
        <circle cx="18.5" cy="22.5" r="11.5" fill="#44403c" />
        {/* 白斗篷覆背（蜜獾标志） */}
        <ellipse cx="18.5" cy="14.5" rx="8.5" ry="5" fill="#f5f5f4" />
        {/* 蜷尾（白尖） */}
        <path d="M28 27q5.5 -1 4.5 -7" stroke="#44403c" strokeWidth="4.5" strokeLinecap="round" />
        <circle cx="32.6" cy="19.4" r="2.4" fill="#f5f5f4" />
        {/* 小圆耳 */}
        <circle cx="8.6" cy="17.5" r="2.6" fill="#292524" />
        <circle cx="8.6" cy="17.5" r="1" fill="#78716c" />
        {/* 紧闭笑眼（醒来时睁眼） + 小鼻头 + 微笑 */}
        {awake ? (
          <>
            <circle cx="14.5" cy="23" r="1.9" fill="#f5f5f4" />
            <circle cx="14.5" cy="23" r="0.8" fill="#1c1917" />
          </>
        ) : (
          <path d="M12.5 23.5q2 2 4 0" stroke="#f5f5f4" strokeWidth="1.5" strokeLinecap="round" />
        )}
        <ellipse cx="20.5" cy="26.5" rx="1.9" ry="1.4" fill="#1c1917" />
        <path d="M17.5 29.5q3 2.4 6 0" stroke="#f5f5f4" strokeWidth="1.3" strokeLinecap="round" />
        {/* zzz：有活水醒来即收起 */}
        {!awake && (
          <>
            <text x="29" y="11" fontSize="7" fontWeight="bold" fill="#c2410c" opacity="0.65">z</text>
            <text x="33" y="6" fontSize="9" fontWeight="bold" fill="#c2410c" opacity="0.65">z</text>
            <text x="26" y="6" fontSize="6" fontWeight="bold" fill="#c2410c" opacity="0.45">z</text>
          </>
        )}
      </svg>
    </span>
  );
}

/** 品类大磁贴：注册表动态驱动 — 48px+ 大触控方块（老少皆宜，零硬编码价格人话化）。 */
const TILE_STYLE: Record<string, { bg: string; border: string; text: string; price: string }> = {
  housekeeping: { bg: "#ffffff", border: "#e5e5e5", text: "#4b4b4b", price: "¥60/h 起" },
  meetup: { bg: "#ffffff", border: "#e5e5e5", text: "#4b4b4b", price: "¥15 AA制" },
  companion: { bg: "#ffffff", border: "#e5e5e5", text: "#4b4b4b", price: "¥100/h 起" },
  tech: { bg: "#ffffff", border: "#e5e5e5", text: "#4b4b4b", price: "¥30 检测" },
  default: { bg: "#ffffff", border: "#e5e5e5", text: "#4b4b4b", price: "¥80/天" },
};
const TILE_ACCENT: Record<string, string> = {
  housekeeping: "#1cb0f6",
  meetup: "#ffc800",
  companion: "#8b5cf6",
  tech: "#ff9600",
  default: "#58cc02",
};

export default function AmmoPillBar({ pills, onSelectDraft, variant = "tiles", hasLiveWaves = false }: AmmoPillBarProps) {
  if (variant === "featured") {
    const featured = FEATURED_PILL_AMMO_IDS.map((id) => pills.find((p) => p.ammoId === id)).filter(
      (p): p is AmmoPillDescriptor => !!p,
    );
    return (
      <div className="mt-4" data-layer="ammo-library" data-testid="ammo-pill-bar" data-variant="featured">
        <div className="flex items-center gap-2">
          <div className="flex-1 min-w-0">
            <p className="text-xs font-bold text-[#afafaf]">弹药库预览</p>
            {/* 平头哥说的话：右尾气泡指向熟睡的它 */}
            <p className="bubble-pop bubble-pop-right relative mt-1 mr-1 rounded-2xl bg-white border-2 border-[#e5e5e5] shadow-sm px-3 py-1.5 text-sm font-black text-[#2d3748] w-fit max-w-full">
              <span aria-hidden="true" className="absolute -right-[8px] top-1/2 -translate-y-1/2 h-3 w-3 rotate-45 bg-white border-r-2 border-t-2 border-[#e5e5e5]" />
              看看大家都在忙什么？
            </p>
          </div>
          <SleepyBeast awake={hasLiveWaves} />
        </div>
        <div className="mt-2 grid grid-cols-2 gap-2">
          {featured.map((pill) => {
            const s = BRACKET_STYLE[pill.theme] ?? BRACKET_STYLE.default;
            return (
              <motion.button
                key={pill.ammoId}
                whileTap={{ scale: 0.96 }}
                onClick={() => onSelectDraft({ key: pill.label, label: pill.label })}
                data-ammo={pill.ammoId}
                data-category={pill.category}
                data-theme={pill.theme}
                aria-label={`${pill.label} · 一键弹药发单`}
                data-testid={`pill-${pill.ammoId}`}
                className="flex items-center justify-center gap-1 px-2 py-2.5 rounded-2xl text-xs font-extrabold whitespace-nowrap min-h-11 active:scale-95 transition-transform"
                style={{ backgroundColor: s.bg, color: s.text }}
              >
                <span aria-hidden="true">[</span>
                <span className="text-sm leading-none" aria-hidden="true">{pill.icon}</span>
                <span className="truncate">{pill.label}</span>
                <span className="font-normal opacity-70" aria-hidden="true">|</span>
                <span>{pillTagFor(pill.theme)}</span>
                <span aria-hidden="true">]</span>
              </motion.button>
            );
          })}
        </div>
      </div>
    );
  }
  if (variant === "compact") {
    return (
      <div
        className="mt-3 flex items-center gap-2 overflow-hidden"
        data-layer="ammo-pills"
        data-testid="ammo-pill-bar"
        data-variant="compact"
      >
        <div className="flex flex-1 min-w-0 items-center gap-2 overflow-x-auto no-scrollbar py-0.5">
          {pills.slice(0, 5).map((pill) => {
            const accent = TILE_ACCENT[pill.theme] ?? TILE_ACCENT.default;
            return (
              <motion.button
                key={pill.ammoId}
                whileTap={{ scale: 0.96 }}
                onClick={() => onSelectDraft({ key: pill.label, label: pill.label })}
                data-ammo={pill.ammoId}
                data-category={pill.category}
                data-theme={pill.theme}
                aria-label={`${pill.label} · 一键弹药发单`}
                data-testid={`pill-${pill.ammoId}`}
                className="flex shrink-0 items-center gap-1 px-3 py-2 rounded-full bg-white border-2 border-[#e5e5e5] border-b-4 shadow-sm text-xs font-bold text-[#4b4b4b] active:translate-y-px active:border-b-2 transition-[transform] hover:border-[#58cc02]/20 whitespace-nowrap min-h-10"
              >
                <span className="text-sm leading-none">{pill.icon}</span>
                <span className="truncate">{pill.label}</span>
                <span className="text-[#afafaf] font-normal">|</span>
                <span className="font-extrabold" style={{ color: accent }}>{pillTagFor(pill.theme)}</span>
              </motion.button>
            );
          })}
        </div>
        <SleepyBeast />
      </div>
    );
  }
  return (
    <div
      className="mt-3 grid grid-cols-3 gap-2 sm:grid-cols-5"
      data-layer="ammo-pills"
      data-testid="ammo-pill-bar"
    >
      {pills.slice(0, 5).map((pill) => {
        const s = TILE_STYLE[pill.theme] ?? TILE_STYLE.default;
        const accent = TILE_ACCENT[pill.theme] ?? TILE_ACCENT.default;
        return (
          <motion.button
            key={pill.ammoId}
            whileTap={{ scale: 0.97 }}
            onClick={() => onSelectDraft({ key: pill.label, label: pill.label })}
            data-ammo={pill.ammoId}
            data-category={pill.category}
            data-theme={pill.theme}
            aria-label={`${pill.label} · 一键弹药发单`}
            data-testid={`pill-${pill.ammoId}`}
            className="flex flex-col items-center gap-1 px-2 py-3 rounded-2xl bg-white border-2 border-b-[4px] border-[#e5e5e5] shadow-sm active:translate-y-1 active:border-b-2 active:shadow-none transition-[transform,border] min-h-[88px] justify-center hover:border-[#58cc02]/20"
            style={{ borderBottomColor: "#e5e5e5" }}
          >
            <span className="text-2xl leading-none" style={{ filter: `drop-shadow(0 1px 0 ${accent}20)` }}>{pill.icon}</span>
            <span className="text-xs font-extrabold text-[#4b4b4b] truncate w-full text-center leading-tight">{pill.label}</span>
            <span className="text-xs font-bold truncate w-full text-center" style={{ color: accent }}>{s.price}</span>
          </motion.button>
        );
      })}
    </div>
  );
}
