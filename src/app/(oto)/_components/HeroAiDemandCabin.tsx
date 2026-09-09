"use client";

import { memo, useEffect, useRef, useState } from "react";
import confetti from "canvas-confetti";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { useIdentityStore } from "@/store/useIdentityStore";
import DuoButton from "@/components/ui/DuoButton";
import { CapybaraBadge } from "@/components/oto-ui/MascotStates";

/**
 * HeroAiDemandCabin —— 一体化 AI 需求舱（设计图极简形态）。
 * 纯展示层抽取：输入/发射链路与 HomePage 原逻辑 100% 同构（default-ammo 直拨）。
 * E2E 锚点守恒：data-testid="ai-demand-cabin" / role="searchbox" /
 * placeholder*="描述你的需求" / aria-label 含"想找什么"+"发出你的需求" /
 * "AI 撮合助手" 文案缺一不可（e2e-app.mjs:59/95/115 锁定）。
 * 防雷：背景几何块 pointer-events-none + 吉祥物用户供图（public/mascots，
 * onError 回退内联 SVG，图裂不断腿）。
 */

interface HeroAiDemandCabinProps {
  value: string;
  onChange: (v: string) => void;
  onLaunch: (text: string) => void;
  onMic: () => void;
  /** 有在途单时水豚睁眼（状态变脸，HomePage 同源投影）。 */
  hasMission?: boolean;
  /** 起草/发布面板打开时水豚戴侦探帽（searching 态，HomePage 同源投影）。 */
  composing?: boolean;
}

/** AI 炫彩星芒图标（inline SVG 渐变，aria-hidden，零外部切图）。 */
function AiSparkle() {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" fill="none" aria-hidden="true" className="shrink-0">
      <defs>
        <linearGradient id="ai-sparkle-g" x1="0" y1="0" x2="18" y2="18">
          <stop offset="0" stopColor="var(--color-duo-blue)" />
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

/* 吉祥物状态表收归 @/components/oto-ui/MascotStates（水豚 5 态：idle/listening/searching/success/sleepy）。 */

function HeroAiDemandCabin({ value, onChange, onLaunch, onMic, hasMission = false, composing = false }: HeroAiDemandCabinProps) {
  const nickname = useIdentityStore((s) => s.identity.nickname) || "Alex";
  const [focused, setFocused] = useState(false);
  const [celebrating, setCelebrating] = useState(false);
  const reduceMotion = useReducedMotion();
  const celebTimer = useRef<number | null>(null);
  useEffect(() => () => {
    if (celebTimer.current !== null) window.clearTimeout(celebTimer.current);
  }, []);
  const awake = focused || hasMission;
  // 水豚 5 态映射：起草中侦探帽 > 聆听睁眼 > 待命笑眼（状态表见 MascotStates）
  const mood = composing ? "searching" : awake ? "listening" : "idle";
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
      const colors = ["var(--color-duo-green)", "var(--color-duo-blue)", "#ffd028", "#ff7ab8"];
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
      id="ai-cabin"
      className="glass-cabin relative overflow-hidden rounded-3xl border-2 border-[var(--color-duo-swan)] border-b-[6px] p-4 pt-5"
      data-testid="ai-demand-cabin"
      data-layer="ai-cabin"
    >
      <div className="relative">
        {/* 问候行：水豚半身 + 气泡（话语从水豚嘴里说出：左尾气泡） */}
        <div className="flex items-center gap-2.5">
          <CapybaraBadge mood={mood} onPress={submit} />
          <div className="bubble-pop relative min-w-0 flex-1 rounded-2xl bg-[var(--color-duo-polar)] border-2 border-[var(--color-duo-swan)] px-3 py-2 ml-1">
            <span aria-hidden="true" className="absolute -left-[8px] top-1/2 -translate-y-1/2 h-3.5 w-3.5 rotate-45 bg-[var(--color-duo-polar)] border-l-2 border-b-2 border-[var(--color-duo-swan)]" />
            <p className="text-[15px] font-black text-[#2d3748] leading-snug">{nickname}，今天想做什么有趣的事？</p>
            <p className="text-xs font-extrabold text-[var(--color-duo-green-ink)] flex items-center gap-1 mt-0.5">
              ✨ AI 撮合助手 · 慢慢说，都有人兜底
            </p>
          </div>
        </div>

        {/* 意图输入胶囊：星芒 + 输入 + 麦克风 + 出发（Duo 唯一 CTA 出口） */}
        <div className="mt-3 flex items-center gap-2 rounded-full bg-white border-2 border-[var(--color-duo-swan)] pl-3 pr-1.5 py-1.5 focus-within:border-[var(--color-duo-blue)]">
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
            className="flex-1 min-w-0 bg-transparent py-2 text-sm text-[var(--color-duo-eel)] placeholder:text-[var(--color-duo-hare)] focus:outline-none"
          />
          <DuoButton
            type="button"
            variant="outline"
            size="sm"
            sound="click"
            aria-label="🎙️ 语音输入"
            onClick={onMic}
            className="rounded-full px-3 shrink-0"
          >
            🎙️
          </DuoButton>
          <DuoButton
            type="button"
            variant="primary"
            size="sm"
            sound="correct"
            onClick={submit}
            aria-label="[ 出发! ] 想找什么？一句话告诉我 · 发出你的需求"
            data-testid="launch-button"
            className="rounded-full px-5 shrink-0"
          >
            出发!
          </DuoButton>
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
            <span className="absolute h-56 w-56 rounded-full bg-[var(--color-duo-green-light)]" />
            <motion.div
              initial={{ scale: 0.4, y: 60, rotate: -8 }}
              animate={{ scale: 1, y: 0, rotate: 0 }}
              exit={{ scale: 0.7, y: 30, transition: { duration: 0.2 } }}
              transition={{ type: "spring", stiffness: 320, damping: 17 }}
              className="relative"
            >
              <CapybaraBadge mood="success" large />
            </motion.div>
            <motion.div
              initial={{ scale: 0.7, y: 16 }}
              animate={{ scale: 1, y: 0 }}
              transition={{ type: "spring", stiffness: 380, damping: 16, delay: 0.08 }}
              className="relative rounded-3xl bg-white border-2 border-[var(--color-duo-swan)] border-b-[6px] px-6 py-3 text-center"
            >
              <p className="text-lg font-black text-[#2d3748]">发射成功！🎉</p>
              <p className="text-xs font-bold text-[var(--color-duo-green-ink)] mt-0.5">正在为你装填弹药…</p>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

/** memo：广播同步触发 HomePage 重渲染时，输入未变即跳过（广播空转掐断）。 */
export default memo(HeroAiDemandCabin);
