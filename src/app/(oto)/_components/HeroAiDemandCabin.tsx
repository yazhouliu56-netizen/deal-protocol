"use client";

import { useIdentityStore } from "@/store/useIdentityStore";

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

/** AI 炫彩星芒图标（inline SVG 渐变，aria-hidden，零外部切图）。 */
function AiSparkle() {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" fill="none" aria-hidden="true" className="shrink-0">
      <defs>
        <linearGradient id="ai-sparkle-g" x1="0" y1="0" x2="18" y2="18">
          <stop offset="0" stopColor="#1cb0f6" />
          <stop offset="0.5" stopColor="#8b5cf6" />
          <stop offset="1" stopColor="#ff7ab8" />
        </linearGradient>
      </defs>
      <path
        d="M9 0c.7 4.8 3.2 7.3 8 8-4.8.7-7.3 3.2-8 8-.7-4.8-3.2-7.3-8-8 4.8-.7 7.3-3.2 8-8Z"
        fill="url(#ai-sparkle-g)"
      />
      <path
        d="M14.5 11c.3 2 1.3 3 3.3 3.3-2 .3-3 1.3-3.3 3.2-.3-1.9-1.3-2.9-3.2-3.2 1.9-.3 2.9-1.3 3.2-3.3Z"
        fill="url(#ai-sparkle-g)"
        opacity="0.85"
      />
    </svg>
  );
}

/**
 * 卡皮巴拉半身徽章（inline SVG 高精绘制：暖黄光晕 + 探出身子的水豚，
 * aria-hidden，无外部资源）。
 */
function CapybaraBadge() {
  return (
    <span aria-hidden="true" className="relative flex h-16 w-16 shrink-0 items-center justify-center select-none">
      {/* 暖黄色环境光晕 */}
      <span className="absolute inset-0 rounded-full bg-[#fde68a]/70 blur-md" />
      <svg width="60" height="60" viewBox="0 0 60 60" fill="none" aria-hidden="true" className="relative">
        {/* 身体 */}
        <ellipse cx="30" cy="40" rx="20" ry="14" fill="#b45309" />
        <ellipse cx="30" cy="37" rx="15" ry="10" fill="#d97706" />
        {/* 前爪搭边 */}
        <ellipse cx="16" cy="46" rx="4.5" ry="3.5" fill="#92400e" />
        <ellipse cx="44" cy="46" rx="4.5" ry="3.5" fill="#92400e" />
        {/* 头 */}
        <rect x="17" y="12" width="26" height="22" rx="10" fill="#b45309" />
        <rect x="20" y="15" width="20" height="16" rx="8" fill="#d97706" />
        {/* 耳 */}
        <circle cx="21" cy="12.5" r="3.4" fill="#92400e" />
        <circle cx="39" cy="12.5" r="3.4" fill="#92400e" />
        <circle cx="21" cy="12.5" r="1.5" fill="#78350f" />
        <circle cx="39" cy="12.5" r="1.5" fill="#78350f" />
        {/* 眼睛（惬意眯眯眼） */}
        <path d="M24.5 23q1.8 1.6 3.6 0" stroke="#1c1917" strokeWidth="1.6" strokeLinecap="round" />
        <path d="M31.9 23q1.8 1.6 3.6 0" stroke="#1c1917" strokeWidth="1.6" strokeLinecap="round" />
        {/* 鼻吻 */}
        <ellipse cx="30" cy="29" rx="4.6" ry="3.2" fill="#451a03" />
        <ellipse cx="28.4" cy="28.2" rx="1.2" ry="0.9" fill="#a8a29e" opacity="0.7" />
        {/* 腮红 */}
        <circle cx="23" cy="27.5" r="1.6" fill="#f59e0b" opacity="0.55" />
        <circle cx="37" cy="27.5" r="1.6" fill="#f59e0b" opacity="0.55" />
      </svg>
    </span>
  );
}

export default function HeroAiDemandCabin({ value, onChange, onLaunch, onMic }: HeroAiDemandCabinProps) {
  const nickname = useIdentityStore((s) => s.identity.nickname) || "Alex";
  const submit = () => {
    const t = value.trim();
    onLaunch(t || "全类目需求");
  };
  return (
    <div
      className="relative overflow-hidden bg-white rounded-3xl border-2 border-[#e5e5e5] border-b-[6px] shadow-sm p-4 pt-5"
      data-testid="ai-demand-cabin"
      data-layer="ai-cabin"
    >
      {/* 背景漂浮柔和几何块（防雷：pointer-events-none + select-none，禁挡触控） */}
      <div aria-hidden="true" className="pointer-events-none select-none absolute inset-0">
        <span className="absolute -top-8 -left-8 h-28 w-28 rounded-3xl bg-[#1cb0f6]/10 rotate-12" />
        <span className="absolute -top-6 right-10 h-20 w-20 rounded-full bg-[#58cc02]/10" />
        <span className="absolute top-16 -right-8 h-24 w-24 rounded-3xl bg-[#ff9600]/10 -rotate-12" />
      </div>
      {/* 底部彩虹微光渐变光泽带（单轨 Feather 点缀，transform/opacity 零重排） */}
      <div
        aria-hidden="true"
        className="pointer-events-none select-none absolute inset-x-6 bottom-1 h-1 rounded-full bg-gradient-to-r from-[#1cb0f6]/40 via-[#8b5cf6]/40 to-[#ff7ab8]/40 blur-[2px]"
      />

      <div className="relative">
        {/* 问候行：水豚半身 + 气泡 */}
        <div className="flex items-center gap-2.5">
          <CapybaraBadge />
          <div className="min-w-0">
            <p className="text-[15px] font-black text-[#2d3748] truncate">{nickname}，今天想做什么有趣的事？</p>
            <p className="text-xs font-extrabold text-[#58cc02] flex items-center gap-1 mt-0.5">
              ✨ AI 撮合助手 · 慢慢说，都有人兜底
            </p>
          </div>
        </div>

        {/* 意图输入胶囊：星芒 + 输入 + 麦克风 + 出发 */}
        <div className="mt-3 flex items-center gap-2 rounded-full bg-[#f7f7f7] border-2 border-[#e5e5e5] pl-3 pr-1.5 py-1.5 shadow-sm focus-within:border-[#58cc02]/40">
          <AiSparkle />
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
            className="flex-1 min-w-0 bg-transparent py-2 text-sm text-[#4b4b4b] placeholder:text-[#afafaf] focus:outline-none"
          />
          <button
            type="button"
            aria-label="语音输入"
            onClick={onMic}
            className="w-9 h-9 rounded-full bg-white border-2 border-[#e5e5e5] shadow-sm flex items-center justify-center text-sm shrink-0 active:translate-y-px hover:border-[#58cc02]/20 transition-[transform,border]"
          >
            🎙️
          </button>
          <button
            type="button"
            onClick={submit}
            aria-label="想找什么？一句话告诉我 · 发出你的需求"
            data-testid="launch-button"
            className="px-5 py-2.5 rounded-full bg-[#58cc02] border-b-[3px] border-[#46a302] text-white text-sm font-black shadow-sm active:translate-y-0.5 active:border-b-0 transition-[transform] shrink-0 min-h-11"
          >
            [ 出发! ]
          </button>
        </div>
      </div>
    </div>
  );
}
