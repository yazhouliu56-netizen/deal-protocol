"use client";
import { memo } from "react";
import type { ScenarioTheme } from "@/types/ui-viewport";
import type { DuoPillTone } from "@/components/ui/DuoPill";
import { SleepyBeast } from "@/components/oto-ui/MascotStates";

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
  /** B4 推荐开关：prefsOn 缺省 true；onTogglePrefs 缺席则整行不渲染。 */
  prefsOn?: boolean;
  onTogglePrefs?: () => void;
}

/** B4 推荐开关行（默认开，可关；关＝永远图纸序）。 */
function PrefsToggle({ prefsOn, onTogglePrefs }: { prefsOn: boolean; onTogglePrefs?: () => void }) {
  if (!onTogglePrefs) return null;
  return (
    <button
      type="button"
      data-testid="discovery-prefs-toggle"
      aria-pressed={prefsOn}
      aria-label={prefsOn ? "关闭个性化推荐" : "开启个性化推荐"}
      onClick={onTogglePrefs}
      className="mt-1 text-[11px] font-bold text-[var(--color-duo-wolf)]"
    >
      {prefsOn ? "✨ 为你推荐 · 开" : "✨ 为你推荐 · 关"}
    </button>
  );
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

/**
 * Batch④-4 暗岛 hex 出清：主题→Duo tone 唯一映射（forgeryTone/SAFETY_PILL_META 同例）。
 * 口径：创始人契约 ui-viewport（家政蓝/组局橙/交友紫/维修橙图纸实现/default 绿）+
 * Batch①-1 不引入紫 token 裁决 → companion 收敛蓝（中括号本就蓝底，零差）。
 * theme 仍是唯一 key（宪法 #4：零品类硬编码分支）；未知 theme 兜底 default。
 */
export const THEME_TONE: Record<ScenarioTheme, DuoPillTone> = {
  housekeeping: "blue",
  meetup: "yellow",
  companion: "blue",
  tech: "orange",
  default: "green",
};

/** tone → Duo 基色 var（图标投影等装饰位，color-mix 取透明度，零 hex）。 */
const TONE_VAR: Record<DuoPillTone, string> = {
  blue: "--color-duo-blue",
  green: "--color-duo-green",
  yellow: "--color-duo-yellow",
  red: "--color-duo-red",
  orange: "--color-duo-orange",
  neutral: "--color-duo-hare",
};

/** tone → 深色正文 class（白底/浅底通用，a11y ≥4.5 实证见单测）。 */
const TONE_TEXT: Record<DuoPillTone, string> = {
  blue: "text-[var(--color-duo-blue-ink)]",
  green: "text-[var(--color-duo-green-ink)]",
  yellow: "text-[var(--color-duo-yellow-ink)]",
  red: "text-[var(--color-duo-red-dark)]",
  orange: "text-[var(--color-duo-orange-ink)]",
  neutral: "text-[var(--color-duo-eel)]",
};

/** tone → 浅底 wash（featured 整底按钮，DuoPill soft 同配方：基色/10 + ink 字）。 */
const TONE_WASH: Record<DuoPillTone, string> = {
  blue: "bg-[var(--color-duo-blue)]/10 text-[var(--color-duo-blue-ink)]",
  green: "bg-[var(--color-duo-green)]/10 text-[var(--color-duo-green-ink)]",
  yellow: "bg-[var(--color-duo-yellow)]/10 text-[var(--color-duo-yellow-ink)]",
  red: "bg-[var(--color-duo-red)]/10 text-[var(--color-duo-red-dark)]",
  orange: "bg-[var(--color-duo-orange)]/10 text-[var(--color-duo-orange-ink)]",
  neutral: "bg-[var(--color-duo-polar)] text-[var(--color-duo-eel)]",
};

const toneOf = (theme: ScenarioTheme): DuoPillTone => THEME_TONE[theme] ?? THEME_TONE.default;

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

/* 平头哥状态表收归 @/components/oto-ui/MascotStates（4 态：sleeping/awake/cheering/empty）。 */

/** 品类大磁贴：注册表动态驱动 — 48px+ 大触控方块（老少皆宜）。
 * Batch④-4：价格文案走 TONE_TEXT（ incubation 遗留 bg/border/text 死字段 P8-4 已删，此处仅保留 price）。 */
const TILE_STYLE: Record<string, { price: string }> = {
  housekeeping: { price: "¥60/h 起" },
  meetup: { price: "¥15 AA制" },
  companion: { price: "¥100/h 起" },
  tech: { price: "¥30 检测" },
  default: { price: "¥80/天" },
};

function AmmoPillBar({ pills, onSelectDraft, variant = "tiles", hasLiveWaves = false, prefsOn = true, onTogglePrefs }: AmmoPillBarProps) {
  if (variant === "featured") {
    const featured = FEATURED_PILL_AMMO_IDS.map((id) => pills.find((p) => p.ammoId === id)).filter(
      (p): p is AmmoPillDescriptor => !!p,
    );
    // 精简案：灵感 chips 整块并入；时段 caption 按 Batch③-1 用户裁决（ticker 砍）移除。
    return (
      <div className="mt-4" data-layer="ammo-library" data-testid="ammo-pill-bar" data-variant="featured">
        <div className="flex items-center gap-2">
          <div className="flex-1 min-w-0">
            {/* 平头哥说的话：右尾气泡指向熟睡的它 */}
            <p className="bubble-pop bubble-pop-right relative mt-1 mr-1 rounded-2xl bg-white border-2 border-[var(--color-duo-swan)] px-3 py-1.5 text-sm font-black text-slate-700 w-fit max-w-full">
              <span aria-hidden="true" className="absolute -right-[8px] top-1/2 -translate-y-1/2 h-3 w-3 rotate-45 bg-white border-r-2 border-t-2 border-[var(--color-duo-swan)]" />
              看看大家都在忙什么？
            </p>
          </div>
          <SleepyBeast awake={hasLiveWaves} />
        </div>
        <div className="mt-2 grid grid-cols-2 gap-2">
          {featured.map((pill) => {
            const tone = toneOf(pill.theme);
            return (
              <button
                key={pill.ammoId}
                onClick={() => onSelectDraft({ key: pill.label, label: pill.label })}
                data-ammo={pill.ammoId}
                data-category={pill.category}
                data-theme={pill.theme}
                aria-label={`[ ${pill.icon} ${pill.label} | ${pillTagFor(pill.theme)} ] · 一键弹药发单`}
                data-testid={`pill-${pill.ammoId}`}
                className={`flex items-center justify-center gap-1 px-2 py-2.5 rounded-2xl text-xs font-extrabold whitespace-nowrap min-h-11 active:translate-y-px active:brightness-[0.97] transition-[transform,filter] ${TONE_WASH[tone]}`}
              >
                <span aria-hidden="true">[</span>
                <span className="text-sm leading-none" aria-hidden="true">{pill.icon}</span>
                <span className="truncate">{pill.label}</span>
                <span className="font-normal opacity-70" aria-hidden="true">|</span>
                <span>{pillTagFor(pill.theme)}</span>
                <span aria-hidden="true">]</span>
              </button>
            );
          })}
        </div>
        <PrefsToggle prefsOn={prefsOn} onTogglePrefs={onTogglePrefs} />
      </div>
    );
  }
  if (variant === "compact") {
    // 折叠线案（F1）出清时段副标题（Batch③-1 ticker 砍）；展位切 4 与图纸四展位对齐；
    return (
      <div className="mt-4" data-layer="ammo-library" data-testid="ammo-pill-bar" data-variant="compact">
        <div
          className="mt-2 flex items-center gap-2 overflow-hidden"
          data-layer="ammo-pills"
        >
          <div className="flex flex-1 min-w-0 items-center gap-2 overflow-x-auto no-scrollbar py-0.5">
            {pills.slice(0, 4).map((pill) => {
            const tone = toneOf(pill.theme);
            return (
              <button
                key={pill.ammoId}
                onClick={() => onSelectDraft({ key: pill.label, label: pill.label })}
                data-ammo={pill.ammoId}
                data-category={pill.category}
                data-theme={pill.theme}
                aria-label={`一键弹药发单：${pill.label} ${pillTagFor(pill.theme)}`}
                data-testid={`pill-${pill.ammoId}`}
                className="flex shrink-0 items-center gap-1 px-3 py-2 rounded-full bg-white border-2 border-[var(--color-duo-swan)] border-b-4 text-xs font-bold text-[var(--color-duo-eel)] active:translate-y-px active:border-b-2 transition-[transform] hover:border-[var(--color-duo-green)]/20 whitespace-nowrap min-h-10"
              >
                <span className="text-sm leading-none" aria-hidden="true">{pill.icon}</span>
                <span className="truncate">{pill.label}</span>
                <span className="text-[var(--color-duo-wolf)] font-normal" aria-hidden="true">|</span>
                <span className={`font-extrabold ${TONE_TEXT[tone]}`}>{pillTagFor(pill.theme)}</span>
              </button>
            );
          })}
        </div>
        <SleepyBeast awake={hasLiveWaves} />
      </div>
      <PrefsToggle prefsOn={prefsOn} onTogglePrefs={onTogglePrefs} />
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
        const tone = toneOf(pill.theme);
        return (
          <button
            key={pill.ammoId}
            onClick={() => onSelectDraft({ key: pill.label, label: pill.label })}
            data-ammo={pill.ammoId}
            data-category={pill.category}
            data-theme={pill.theme}
            aria-label={`${pill.icon} ${pill.label} ${s.price} · 一键弹药发单`}
            data-testid={`pill-${pill.ammoId}`}
            className="flex flex-col items-center gap-1 px-2 py-3 rounded-2xl bg-white border-2 border-b-[4px] border-[var(--color-duo-swan)] active:translate-y-1 active:border-b-2 active:shadow-none transition-[transform,border] min-h-[88px] justify-center hover:border-[var(--color-duo-green)]/20"
            style={{ borderBottomColor: "var(--color-duo-swan)" }}
          >
            <span className="text-2xl leading-none" style={{ filter: `drop-shadow(0 1px 0 color-mix(in srgb, var(${TONE_VAR[tone]}) 20%, transparent))` }}>{pill.icon}</span>
            <span className="text-xs font-extrabold text-[var(--color-duo-eel)] truncate w-full text-center leading-tight">{pill.label}</span>
            <span className={`text-xs font-bold truncate w-full text-center ${TONE_TEXT[tone]}`}>{s.price}</span>
          </button>
        );
      })}
      <PrefsToggle prefsOn={prefsOn} onTogglePrefs={onTogglePrefs} />
    </div>
  );
}

/** memo：pills 描述符引用稳定（HomePage useMemo []），广播同步时跳过重渲染。 */
export default memo(AmmoPillBar);
