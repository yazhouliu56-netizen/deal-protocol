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
 * 卡皮巴拉徽章（圆滚滚治愈风：浅棕圆身 + 紧闭笑眼 + 上扬嘴角 +
 * 短尾巴 + 头顶小柚子，aria-hidden，无外部资源）。
 */
function CapybaraBadge() {
  return (
    <span aria-hidden="true" className="relative flex h-24 w-24 shrink-0 items-center justify-center select-none">
      {/* 暖黄色环境光晕 */}
      <span className="absolute inset-0 rounded-full bg-[#fde68a]/70 blur-md" />
      <svg width="88" height="88" viewBox="0 0 60 60" fill="none" aria-hidden="true" className="relative">
        {/* 短粗小尾巴 */}
        <ellipse cx="48" cy="44" rx="4" ry="5" fill="#a9742c" />
        {/* 圆滚身体（浅棕） */}
        <ellipse cx="29" cy="36" rx="20" ry="17" fill="#c8956c" />
        <ellipse cx="29" cy="41" rx="13" ry="10" fill="#dab88f" />
        {/* 小圆耳 */}
        <circle cx="15.5" cy="15" r="4.2" fill="#a9742c" />
        <circle cx="42.5" cy="15" r="4.2" fill="#a9742c" />
        <circle cx="15.5" cy="15" r="1.8" fill="#7c4a21" />
        <circle cx="42.5" cy="15" r="1.8" fill="#7c4a21" />
        {/* 头顶小柚子 */}
        <circle cx="29" cy="8.5" r="3.6" fill="#f59e0b" />
        <ellipse cx="27.8" cy="7.4" rx="1.1" ry="1.5" fill="#fcd34d" opacity="0.9" />
        <path d="M29 5q0.4-1.6 1.8-2" stroke="#15803d" strokeWidth="1.2" strokeLinecap="round" />
        {/* 紧闭笑眼 */}
        <path d="M17.5 28q3 3.2 6 0" stroke="#4a2d0c" strokeWidth="2" strokeLinecap="round" />
        <path d="M34.5 28q3 3.2 6 0" stroke="#4a2d0c" strokeWidth="2" strokeLinecap="round" />
        {/* 浅色吻部 + 小鼻头 */}
        <ellipse cx="29" cy="36.5" rx="9" ry="7" fill="#ecd3ac" />
        <ellipse cx="29" cy="34" rx="3.2" ry="2.4" fill="#4a2d0c" />
        <ellipse cx="28" cy="33.2" rx="0.9" ry="0.6" fill="#d6d3d1" opacity="0.9" />
        {/* 上扬微笑嘴 */}
        <path d="M29 36.4v1.4M29 37.8q-2.8 2.4-5.6 1M29 37.8q2.8 2.4 5.6 1" stroke="#4a2d0c" strokeWidth="1.4" strokeLinecap="round" />
        {/* 腮红 */}
        <ellipse cx="18.5" cy="34" rx="2.4" ry="1.6" fill="#f0a08a" opacity="0.7" />
        <ellipse cx="39.5" cy="34" rx="2.4" ry="1.6" fill="#f0a08a" opacity="0.7" />
        {/* 小前爪 */}
        <ellipse cx="19" cy="50" rx="4" ry="2.8" fill="#a9742c" />
        <ellipse cx="39" cy="50" rx="4" ry="2.8" fill="#a9742c" />
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
        {/* 问候行：水豚半身 + 气泡（话语从水豚嘴里说出：左尾气泡） */}
        <div className="flex items-center gap-2.5">
          <CapybaraBadge />
          <div className="relative min-w-0 flex-1 rounded-2xl bg-[#f7f7f7] border-2 border-[#e5e5e5] px-3 py-2 ml-1">
            <span aria-hidden="true" className="absolute -left-[8px] top-1/2 -translate-y-1/2 h-3.5 w-3.5 rotate-45 bg-[#f7f7f7] border-l-2 border-b-2 border-[#e5e5e5]" />
            <p className="text-[15px] font-black text-[#2d3748] leading-snug">{nickname}，今天想做什么有趣的事？</p>
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
