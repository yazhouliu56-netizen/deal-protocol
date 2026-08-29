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

export default function AmmoPillBar({ pills, onSelectDraft }: AmmoPillBarProps) {
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
