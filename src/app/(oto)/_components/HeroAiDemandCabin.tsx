"use client";

import { memo, useEffect, useRef, useState } from "react";
import confetti from "canvas-confetti";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
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
  /** 有在途单时水豚睁眼（状态变脸，HomePage 同源投影）。 */
  hasMission?: boolean;
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
 * 出发音效（零依赖 WebAudio：C5-E5-G5 上行三音“叮”，静默降级不打断发射）。
 */
function playLaunchChime() {
  try {
    const w = window as unknown as { AudioContext?: typeof AudioContext; webkitAudioContext?: typeof AudioContext };
    const Ctx = w.AudioContext ?? w.webkitAudioContext;
    if (!Ctx) return;
    const ctx = new Ctx();
    [523.25, 659.25, 783.99].forEach((f, i) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "sine";
      osc.frequency.value = f;
      const t = ctx.currentTime + i * 0.09;
      gain.gain.setValueAtTime(0.0001, t);
      gain.gain.exponentialRampToValueAtTime(0.18, t + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.28);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(t);
      osc.stop(t + 0.3);
    });
    window.setTimeout(() => void ctx.close(), 900);
  } catch {
    /* 无音频环境静默降级 */
  }
}

/**
 * 卡皮巴拉徽章（圆滚滚治愈风：浅棕圆身 + 紧闭笑眼 + 上扬嘴角 +
 * 短尾巴 + 头顶小柚子，无外部资源）。
 * 状态变脸：awake=true 睁眼（听你说/有在途单），false 紧闭笑眼。
 * 真按钮：传 onPress 即渲染为可聚焦 <button>（问候处接 submit，同[ 出发! ]语义，
 * 空输入走“全类目需求”兜底）；庆祝遮罩内不传，保持纯装饰。
 */
function CapybaraBadge({ awake, large = false, onPress }: { awake: boolean; large?: boolean; onPress?: () => void }) {
  const cls = `mascot-bob relative flex shrink-0 items-center justify-center select-none cursor-pointer active:scale-90 active:-rotate-6 transition-transform ${large ? "h-40 w-40" : "h-24 w-24"}`;
  const body = (
    <>
      {/* 暖黄色环境光晕 */}
      <span className="absolute inset-0 rounded-full bg-[#fde68a]/70 blur-md" />
      <svg width={large ? 150 : 88} height={large ? 150 : 88} viewBox="0 0 60 60" fill="none" aria-hidden="true" className="relative drop-shadow-[0_10px_18px_rgba(217,119,6,.35)]">
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
        {/* 眼睛：awake 睁眼聆听（会眨眼），平常紧闭笑眼 */}
        {awake ? (
          <g className="mascot-blink">
            <ellipse cx="20.5" cy="28" rx="3" ry="3.6" fill="#4a2d0c" />
            <circle cx="21.5" cy="26.8" r="1.1" fill="#fff" />
            <ellipse cx="37.5" cy="28" rx="3" ry="3.6" fill="#4a2d0c" />
            <circle cx="38.5" cy="26.8" r="1.1" fill="#fff" />
          </g>
        ) : (
          <>
            <path d="M17.5 28q3 3.2 6 0" stroke="#4a2d0c" strokeWidth="2" strokeLinecap="round" />
            <path d="M34.5 28q3 3.2 6 0" stroke="#4a2d0c" strokeWidth="2" strokeLinecap="round" />
          </>
        )}
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
    </>
  );
  if (onPress) {
    return (
      <button type="button" onClick={onPress} aria-label="水豚出发：一键发射需求" data-testid="mascot-launch" className={cls}>
        {body}
      </button>
    );
  }
  return (
    <span aria-hidden="true" className={cls}>
      {body}
    </span>
  );
}

function HeroAiDemandCabin({ value, onChange, onLaunch, onMic, hasMission = false }: HeroAiDemandCabinProps) {
  const nickname = useIdentityStore((s) => s.identity.nickname) || "Alex";
  const [focused, setFocused] = useState(false);
  const [celebrating, setCelebrating] = useState(false);
  const reduceMotion = useReducedMotion();
  const celebTimer = useRef<number | null>(null);
  useEffect(() => () => {
    if (celebTimer.current !== null) window.clearTimeout(celebTimer.current);
  }, []);
  const awake = focused || hasMission;
  const submit = () => {
    const t = value.trim();
    // C 位时刻：水豚跳出来报“发射成功”（结构性偏离已特批；z-70 浮于 Sheet 之上，
    // pointer-events-none 全程不挡点击，aria-hidden 对 e2e/读屏零感知；敏感用户跳过）
    if (!reduceMotion) {
      setCelebrating(true);
      if (celebTimer.current !== null) window.clearTimeout(celebTimer.current);
      celebTimer.current = window.setTimeout(() => setCelebrating(false), 1500);
    }
    // 出发爽感：三音叮 + duo 配色撒花（reduced-motion 由库选项兜底），再走原发射链路
    playLaunchChime();
    try {
      // 通关级撒花：130 粒 duo 四色 + 左右礼花双 burst（reduced-motion 由库选项兜底）
      const colors = ["#58cc02", "#1cb0f6", "#ffd028", "#ff7ab8"];
      confetti({ particleCount: 150, spread: 100, startVelocity: 38, ticks: 220, scalar: 1.1, origin: { y: 0.3 }, colors, disableForReducedMotion: true });
      window.setTimeout(() => {
        try {
          confetti({ particleCount: 50, angle: 60, spread: 60, origin: { x: 0, y: 0.5 }, colors, disableForReducedMotion: true });
          confetti({ particleCount: 50, angle: 120, spread: 60, origin: { x: 1, y: 0.5 }, colors, disableForReducedMotion: true });
        } catch { /* 忽略 */ }
      }, 150);
    } catch {
      /* 撒花失败不打断发射 */
    }
    onLaunch(t || "全类目需求");
  };
  return (
    <div
      className="glass-cabin relative overflow-hidden rounded-3xl border-2 border-[#e5e5e5] border-b-[6px] p-4 pt-5 transition-[transform,box-shadow] focus-within:-translate-y-0.5 focus-within:shadow-[0_20px_48px_-12px_rgba(88,204,2,.4)]"
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
          <CapybaraBadge awake={awake} onPress={submit} />
          <div className="bubble-pop relative min-w-0 flex-1 rounded-2xl bg-[#f7f7f7] border-2 border-[#e5e5e5] px-3 py-2 ml-1">
            <span aria-hidden="true" className="absolute -left-[8px] top-1/2 -translate-y-1/2 h-3.5 w-3.5 rotate-45 bg-[#f7f7f7] border-l-2 border-b-2 border-[#e5e5e5]" />
            <p className="text-[15px] font-black text-[#2d3748] leading-snug">{nickname}，今天想做什么有趣的事？</p>
            <p className="text-xs font-extrabold text-[#357a00] flex items-center gap-1 mt-0.5">
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
            onFocus={() => setFocused(true)}
            onBlur={() => setFocused(false)}
            placeholder="一句话描述你的需求，比如：周六晚7点天河2人羽毛球AA制…"
            aria-label="一句话描述你的需求"
            className="flex-1 min-w-0 bg-transparent py-2 text-sm text-[#4b4b4b] placeholder:text-[#afafaf] focus:outline-none"
          />
          <button
            type="button"
            aria-label="🎙️ 语音输入"
            onClick={onMic}
            className="w-9 h-9 rounded-full bg-white border-2 border-[#e5e5e5] shadow-sm flex items-center justify-center text-sm shrink-0 active:translate-y-px hover:border-[#58cc02]/20 transition-[transform,border]"
          >
            🎙️
          </button>
          <button
            type="button"
            onClick={submit}
            aria-label="[ 出发! ] 想找什么？一句话告诉我 · 发出你的需求"
            data-testid="launch-button"
            className="px-5 py-2.5 rounded-full bg-[#3a8500] border-b-[3px] border-[#2f7a00] text-white text-sm font-black shadow-[0_6px_16px_rgba(88,204,2,.45)] active:scale-90 active:border-b-0 transition-transform shrink-0 min-h-11"
          >
            [ 出发! ]
          </button>
        </div>
      </div>
      {/* 发射庆祝遮罩：C 位水豚弹簧入场报“发射成功”，1.5s 退场 */}
      <AnimatePresence>
        {celebrating && (
          <motion.div
            aria-hidden="true"
            data-testid="launch-celebration"
            className="pointer-events-none fixed inset-0 z-[70] flex flex-col items-center justify-center gap-3"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0, transition: { duration: 0.25 } }}
          >
            <span className="absolute h-56 w-56 rounded-full bg-[#58cc02]/20 blur-2xl" />
            <motion.div
              initial={{ scale: 0.4, y: 60, rotate: -8 }}
              animate={{ scale: 1, y: 0, rotate: 0 }}
              exit={{ scale: 0.7, y: 30, transition: { duration: 0.2 } }}
              transition={{ type: "spring", stiffness: 320, damping: 17 }}
              className="relative"
            >
              <CapybaraBadge awake large />
            </motion.div>
            <motion.div
              initial={{ scale: 0.7, y: 16 }}
              animate={{ scale: 1, y: 0 }}
              transition={{ type: "spring", stiffness: 380, damping: 16, delay: 0.08 }}
              className="relative rounded-3xl bg-white border-2 border-[#e5e5e5] border-b-[6px] shadow-xl px-6 py-3 text-center"
            >
              <p className="text-lg font-black text-[#2d3748]">发射成功！🎉</p>
              <p className="text-xs font-bold text-[#357a00] mt-0.5">正在为你装填弹药…</p>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

/** memo：广播同步触发 HomePage 重渲染时，输入未变即跳过（广播空转掐断）。 */
export default memo(HeroAiDemandCabin);
