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
  /** compact = 设计图轻量横滑胶囊；tiles = 48px+ 大磁贴（默认，E2E 守恒）。 */
  variant?: "tiles" | "compact";
}

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

/** 沉睡小兽插画（inline SVG，aria-hidden，零外部切图永不 404）。 */
function SleepyBeast() {
  return (
    <span
      aria-hidden="true"
      className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-[#f7f7f7] border-2 border-[#e5e5e5] select-none"
    >
      <svg width="40" height="40" viewBox="0 0 40 40" fill="none" aria-hidden="true">
        <circle cx="11" cy="11" r="5" fill="#4b4b4b" />
        <circle cx="29" cy="11" r="5" fill="#4b4b4b" />
        <circle cx="11" cy="11" r="2" fill="#fff" />
        <circle cx="29" cy="11" r="2" fill="#fff" />
        <ellipse cx="20" cy="22" rx="12" ry="10" fill="#fff" stroke="#e5e5e5" strokeWidth="2" />
        <path d="M13 21q2 2 4 0" stroke="#4b4b4b" strokeWidth="1.6" strokeLinecap="round" />
        <path d="M23 21q2 2 4 0" stroke="#4b4b4b" strokeWidth="1.6" strokeLinecap="round" />
        <ellipse cx="20" cy="26" rx="2.4" ry="1.7" fill="#4b4b4b" />
        <text x="30" y="10" fontSize="7" fontWeight="bold" fill="#afafaf">z</text>
        <text x="34" y="6" fontSize="9" fontWeight="bold" fill="#afafaf">z</text>
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
