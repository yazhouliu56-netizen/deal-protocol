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

/** 熟睡平头哥插画（inline SVG 黑白配色 + zzz，aria-hidden，零外部切图永不 404）。 */
function SleepyBeast() {
  return (
    <span
      aria-hidden="true"
      className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-white border-2 border-[#e5e5e5] shadow-sm select-none"
    >
      <svg width="40" height="40" viewBox="0 0 40 40" fill="none" aria-hidden="true">
        {/* 耳（深） */}
        <circle cx="11" cy="11" r="5" fill="#4b4b4b" />
        <circle cx="29" cy="11" r="5" fill="#4b4b4b" />
        <circle cx="11" cy="11" r="2" fill="#d6d3d1" />
        <circle cx="29" cy="11" r="2" fill="#d6d3d1" />
        {/* 脸（白）+ 深色眼罩纹 */}
        <ellipse cx="20" cy="23" rx="12" ry="10" fill="#fff" stroke="#e5e5e5" strokeWidth="2" />
        <ellipse cx="13.5" cy="21" rx="3.4" ry="2.6" fill="#4b4b4b" opacity="0.85" transform="rotate(-18 13.5 21)" />
        <ellipse cx="26.5" cy="21" rx="3.4" ry="2.6" fill="#4b4b4b" opacity="0.85" transform="rotate(18 26.5 21)" />
        {/* 闭眼呼噜线 */}
        <path d="M11.5 21.5q2 1.4 4 0" stroke="#fff" strokeWidth="1.4" strokeLinecap="round" />
        <path d="M24.5 21.5q2 1.4 4 0" stroke="#fff" strokeWidth="1.4" strokeLinecap="round" />
        {/* 鼻吻（深） */}
        <ellipse cx="20" cy="27" rx="2.6" ry="1.9" fill="#4b4b4b" />
        {/* zzz（低功耗：静态字符，respect reduced-motion 由父级动画统一收敛） */}
        <text x="30" y="11" fontSize="7" fontWeight="bold" fill="#afafaf">z</text>
        <text x="34" y="6" fontSize="9" fontWeight="bold" fill="#afafaf">z</text>
        <text x="27" y="6" fontSize="6" fontWeight="bold" fill="#d6d3d1">z</text>
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

export default function AmmoPillBar({ pills, onSelectDraft, variant = "tiles" }: AmmoPillBarProps) {
  if (variant === "featured") {
    const featured = FEATURED_PILL_AMMO_IDS.map((id) => pills.find((p) => p.ammoId === id)).filter(
      (p): p is AmmoPillDescriptor => !!p,
    );
    return (
      <div className="mt-4" data-layer="ammo-library" data-testid="ammo-pill-bar" data-variant="featured">
        <div className="flex items-center gap-2">
          <div className="flex-1 min-w-0">
            <p className="text-xs font-bold text-[#afafaf]">弹药库预览</p>
            <p className="text-sm font-black text-[#2d3748] mt-0.5">看看大家都在忙什么？</p>
          </div>
          <SleepyBeast />
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
