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

/** 熟睡平头哥（蜜獾）插画：白斗篷头顶 + 黑身 + 灰吻 + 小圆耳，
 *  与熊猫彻底区分（inline SVG，aria-hidden，零外部切图永不 404）。 */
function SleepyBeast() {
  return (
    <span
      aria-hidden="true"
      className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-white border-2 border-[#e5e5e5] shadow-sm select-none"
    >
      <svg width="40" height="40" viewBox="0 0 40 40" fill="none" aria-hidden="true">
        {/* 黑身肩膀 */}
        <ellipse cx="20" cy="35" rx="13" ry="7.5" fill="#292524" />
        {/* 前爪 + 爪趾线 */}
        <ellipse cx="10.5" cy="36" rx="3.4" ry="2.4" fill="#292524" />
        <path d="M9 34.5v2.6M11.5 34.5v2.6" stroke="#57534e" strokeWidth="0.9" strokeLinecap="round" />
        <ellipse cx="29.5" cy="36" rx="3.4" ry="2.4" fill="#292524" />
        <path d="M28 34.5v2.6M31 34.5v2.6" stroke="#57534e" strokeWidth="0.9" strokeLinecap="round" />
        {/* 头（深） */}
        <ellipse cx="20" cy="18.5" rx="12" ry="11" fill="#292524" />
        {/* 白斗篷头顶（蜜獾标志：银白披风覆顶） */}
        <ellipse cx="20" cy="11" rx="10" ry="6.5" fill="#e7e5e4" />
        <path d="M10.5 13.5Q20 6 29.5 13.5" stroke="#f5f5f4" strokeWidth="1.6" strokeLinecap="round" />
        {/* 耳（小圆深色，贴头两侧） */}
        <circle cx="9.5" cy="14" r="3.1" fill="#1c1917" />
        <circle cx="30.5" cy="14" r="3.1" fill="#1c1917" />
        <circle cx="9.5" cy="14" r="1.2" fill="#44403c" />
        <circle cx="30.5" cy="14" r="1.2" fill="#44403c" />
        {/* 闭眼呼噜线（浅色，落在深底上） */}
        <path d="M12 20.5q2 1.6 4 0" stroke="#f5f5f4" strokeWidth="1.5" strokeLinecap="round" />
        <path d="M24 20.5q2 1.6 4 0" stroke="#f5f5f4" strokeWidth="1.5" strokeLinecap="round" />
        {/* 灰吻 + 黑鼻头 + 嘴 */}
        <ellipse cx="20" cy="26" rx="5.5" ry="4" fill="#57534e" />
        <ellipse cx="20" cy="24.6" rx="2.4" ry="1.8" fill="#0c0a09" />
        <ellipse cx="19.2" cy="24" rx="0.7" ry="0.5" fill="#a8a29e" opacity="0.8" />
        <path d="M20 26.4v1.2M20 27.6q-1.8 1.2-3.4 0.4M20 27.6q1.8 1.2 3.4 0.4" stroke="#0c0a09" strokeWidth="1" strokeLinecap="round" />
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
