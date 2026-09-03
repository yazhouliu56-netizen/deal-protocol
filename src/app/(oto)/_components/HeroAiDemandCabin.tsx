"use client";

/**
 * HeroAiDemandCabin —— 一体化 AI 需求舱（设计图极简形态）。
 * 纯展示层抽取：输入/发射链路与 HomePage 原逻辑 100% 同构（default-ammo 直拨）。
 * E2E 锚点守恒：data-testid="ai-demand-cabin" / role="searchbox" /
 * placeholder*="描述你的需求" / aria-label 含"想找什么"+"发出你的需求" /
 * "AI 撮合助手" 文案缺一不可（e2e-app.mjs:59/95/115 锁定）。
 * 防雷：背景几何块 pointer-events-none + inline SVG（零外部切图，永不 404）。
 */

interface HeroAiDemandCabinProps {
  value: string;
  onChange: (v: string) => void;
  onLaunch: (text: string) => void;
  onMic: () => void;
}

/** 卡皮巴拉问候徽章（inline SVG，aria-hidden，无外部资源）。 */
function CapybaraBadge() {
  return (
    <span
      aria-hidden="true"
      className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-[#fff7ed] border-2 border-[#fed7aa] border-b-4 shadow-sm select-none"
    >
      <svg width="28" height="28" viewBox="0 0 28 28" fill="none" aria-hidden="true">
        <rect x="4" y="8" width="20" height="14" rx="7" fill="#b45309" />
        <rect x="7" y="12" width="14" height="8" rx="4" fill="#d97706" />
        <circle cx="6.5" cy="9" r="2.5" fill="#92400e" />
        <circle cx="21.5" cy="9" r="2.5" fill="#92400e" />
        <circle cx="10.5" cy="15" r="1.3" fill="#1c1917" />
        <circle cx="17.5" cy="15" r="1.3" fill="#1c1917" />
        <ellipse cx="14" cy="18.5" rx="2.2" ry="1.5" fill="#451a03" />
      </svg>
    </span>
  );
}

export default function HeroAiDemandCabin({ value, onChange, onLaunch, onMic }: HeroAiDemandCabinProps) {
  const submit = () => {
    const t = value.trim();
    onLaunch(t || "全类目需求");
  };
  return (
    <div
      className="relative overflow-hidden bg-white rounded-3xl border-2 border-[#e5e5e5] border-b-[6px] shadow-sm p-4"
      data-testid="ai-demand-cabin"
      data-layer="ai-cabin"
    >
      {/* 背景漂浮柔和几何块（防雷：pointer-events-none + select-none，禁挡触控） */}
      <div aria-hidden="true" className="pointer-events-none select-none absolute inset-0">
        <span className="absolute -top-8 -left-8 h-28 w-28 rounded-3xl bg-[#1cb0f6]/10 rotate-12" />
        <span className="absolute -top-6 right-10 h-20 w-20 rounded-full bg-[#58cc02]/10" />
        <span className="absolute top-16 -right-8 h-24 w-24 rounded-3xl bg-[#ff9600]/10 -rotate-12" />
      </div>

      <div className="relative">
        {/* 问候行：水豚 + 气泡 */}
        <div className="flex items-center gap-2.5">
          <CapybaraBadge />
          <div className="min-w-0">
            <p className="text-sm font-extrabold text-[#4b4b4b] truncate">Alex，今天想做什么有趣的事？</p>
            <p className="text-xs font-extrabold text-[#58cc02] flex items-center gap-1 mt-0.5">
              ✨ AI 撮合助手 · 秒级生成担保契约 · 0 押金 满意后分账
            </p>
          </div>
        </div>

        {/* 输入行 */}
        <div className="mt-3 flex items-center gap-2">
          <div className="relative flex-1 min-w-0">
            <input
              type="search"
              role="searchbox"
              value={value}
              onChange={(e) => onChange(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && value.trim()) submit();
              }}
              placeholder="一句话描述你的需求，比如：周六晚7点天河2人羽毛球AA制…"
              aria-label="一句话描述你的需求"
              className="w-full min-w-0 pl-3 pr-11 py-3 rounded-2xl bg-[#f7f7f7] border-2 border-[#e5e5e5] text-sm text-[#4b4b4b] placeholder:text-[#afafaf] focus:outline-none focus:border-[#58cc02]/30"
            />
            <button
              type="button"
              aria-label="语音输入"
              onClick={onMic}
              className="absolute right-1.5 top-1/2 -translate-y-1/2 w-8 h-8 rounded-full bg-white border-2 border-[#e5e5e5] shadow-sm flex items-center justify-center text-sm shrink-0 active:translate-y-px hover:border-[#58cc02]/20 transition-[transform,border]"
            >
              🎙️
            </button>
          </div>
          <button
            type="button"
            onClick={submit}
            aria-label="想找什么？一句话告诉我 · 发出你的需求"
            data-testid="launch-button"
            className="px-4 py-3 rounded-2xl bg-[#58cc02] border-b-4 border-[#46a302] text-white text-sm font-extrabold shadow-sm active:translate-y-1 active:border-b-0 transition-[transform] shrink-0 min-h-12"
          >
            出发！
          </button>
        </div>

        {/* 锚点 */}
        <a
          href="#wave-feed"
          className="mt-3 inline-flex items-center gap-1 text-xs font-bold text-[#afafaf] hover:text-[#4b4b4b] transition-colors"
        >
          看看大家都在忙什么？ ↓
        </a>
      </div>
    </div>
  );
}
