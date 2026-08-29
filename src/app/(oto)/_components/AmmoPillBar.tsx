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

/** 品类胶囊栏：注册表动态驱动（官方四枚 + 动态池热注；每枚挂 data-ammo / data-theme
    主题色作用域 —— 点击精准唤起对应弹药拟物草稿卡）。 */
const PILL_STYLE: Record<string, { bg: string; border: string; text: string }> = {
  housekeeping: { bg: "#1cb0f6", border: "#1899d6", text: "#ffffff" },
  meetup: { bg: "#ffc800", border: "#e5b400", text: "#4b4b4b" },
  companion: { bg: "#8b5cf6", border: "#7c3aed", text: "#ffffff" },
  tech: { bg: "#ff9600", border: "#e58700", text: "#ffffff" },
  default: { bg: "#58cc02", border: "#46a302", text: "#ffffff" },
};

export default function AmmoPillBar({ pills, onSelectDraft }: AmmoPillBarProps) {
  return (
    <div
      className="mt-2 flex gap-2 overflow-x-auto no-scrollbar pb-0.5"
      data-layer="ammo-pills"
      data-testid="ammo-pill-bar"
    >
      {pills.map((pill) => {
        const s = PILL_STYLE[pill.theme] ?? PILL_STYLE.default;
        return (
          <motion.button
            key={pill.ammoId}
            whileTap={{ scale: 0.95 }}
            onClick={() => onSelectDraft({ key: pill.label, label: pill.label })}
            data-ammo={pill.ammoId}
            data-category={pill.category}
            data-theme={pill.theme}
            aria-label={`${pill.label} · 一键弹药发单`}
            className="shrink-0 flex items-center gap-1.5 px-3.5 py-2 rounded-full border-b-4 border-x border-t text-xs font-extrabold shadow-sm active:translate-y-1 active:border-b-0 transition-[transform,filter] whitespace-nowrap"
            style={{
              backgroundColor: s.bg,
              borderColor: s.border,
              color: s.text,
              borderBottomWidth: "4px",
            }}
          >
            <span className="text-sm leading-none">{pill.icon}</span>
            <span className="whitespace-nowrap">{pill.label}</span>
          </motion.button>
        );
      })}
    </div>
  );
}
