"use client";

import { useState } from "react";
import Image from "next/image";

/**
 * 吉祥物状态表（极简多邻国情绪闭环 · SVG 主 + PNG 彩蛋）。
 * 水豚 = 买家/发单侧 5 态（idle/listening/searching/success/sleepy，均有挂载）；
 * 平头哥 = 卖家/履约侧 4 态（sleeping/awake/cheering/empty，均有挂载；onroute 零挂载已切除）。
 * PNG 供图仅 idle/sleeping 常态展示，awake/图裂一律回退内联 SVG（宪法 #10）。
 */

export type CapybaraMood = "idle" | "listening" | "searching" | "success" | "sleepy";
export type BeastMood = "sleeping" | "awake" | "cheering" | "empty";

function capybaraEyes(mood: CapybaraMood) {
  if (mood === "listening" || mood === "searching") {
    return (
      <g className="mascot-blink">
        <ellipse cx="20.5" cy="28" rx="3" ry="3.6" fill="#4a2d0c" />
        <circle cx="21.5" cy="26.8" r="1.1" fill="#fff" />
        <ellipse cx="37.5" cy="28" rx="3" ry="3.6" fill="#4a2d0c" />
        <circle cx="38.5" cy="26.8" r="1.1" fill="#fff" />
      </g>
    );
  }
  if (mood === "sleepy") {
    return (
      <>
        <path d="M17.5 29q3 -1.5 6 0" stroke="#4a2d0c" strokeWidth="2" strokeLinecap="round" />
        <path d="M34.5 29q3 -1.5 6 0" stroke="#4a2d0c" strokeWidth="2" strokeLinecap="round" />
      </>
    );
  }
  if (mood === "success") {
    return (
      <>
        <path d="M17 27q3 -3.5 6.5 -0.5" stroke="#4a2d0c" strokeWidth="2.2" strokeLinecap="round" />
        <path d="M34.5 26.5q3 -3.5 6.5 -0.5" stroke="#4a2d0c" strokeWidth="2.2" strokeLinecap="round" />
      </>
    );
  }
  return (
    <>
      <path d="M17.5 28q3 3.2 6 0" stroke="#4a2d0c" strokeWidth="2" strokeLinecap="round" />
      <path d="M34.5 28q3 3.2 6 0" stroke="#4a2d0c" strokeWidth="2" strokeLinecap="round" />
    </>
  );
}

function capybaraHat(mood: CapybaraMood) {
  // searching：侦探帽 + 放大镜；success：派对三角帽
  if (mood === "searching") {
    return (
      <>
        <ellipse cx="29" cy="12" rx="13" ry="3.4" fill="#78716c" />
        <path d="M20 12q0-8 9-8t9 8" fill="#57534e" />
        <circle cx="47" cy="40" r="6.5" fill="none" stroke="var(--color-duo-blue)" strokeWidth="2.2" />
        <path d="M51.5 44.5 56 49" stroke="var(--color-duo-blue)" strokeWidth="2.4" strokeLinecap="round" />
      </>
    );
  }
  if (mood === "success") {
    return (
      <>
        <path d="M24 13 29 0l5 13" fill="var(--color-duo-blue)" />
        <circle cx="29" cy="0.8" r="2.2" fill="#ff7ab8" />
        <circle cx="26.5" cy="7" r="1" fill="#ffd028" />
        <circle cx="31" cy="9" r="1" fill="#ffffff" />
      </>
    );
  }
  // idle 默认头顶小柚子
  return (
    <>
      <circle cx="29" cy="8.5" r="3.6" fill="#f59e0b" />
      <ellipse cx="27.8" cy="7.4" rx="1.1" ry="1.5" fill="#fcd34d" opacity="0.9" />
      <path d="M29 5q0.4-1.6 1.8-2" stroke="#15803d" strokeWidth="1.2" strokeLinecap="round" />
    </>
  );
}

function CapybaraSvg({ mood, large }: { mood: CapybaraMood; large?: boolean }) {
  const s = large ? 150 : 88;
  return (
    <svg width={s} height={s} viewBox="0 0 60 60" fill="none" aria-hidden="true" className="relative drop-shadow-[0_10px_18px_rgba(217,119,6,.35)]">
      <ellipse cx="48" cy="44" rx="4" ry="5" fill="#a9742c" />
      <ellipse cx="29" cy="36" rx="20" ry="17" fill="#c8956c" />
      <ellipse cx="29" cy="41" rx="13" ry="10" fill="#dab88f" />
      <circle cx="15.5" cy="15" r="4.2" fill="#a9742c" />
      <circle cx="42.5" cy="15" r="4.2" fill="#a9742c" />
      <circle cx="15.5" cy="15" r="1.8" fill="#7c4a21" />
      <circle cx="42.5" cy="15" r="1.8" fill="#7c4a21" />
      {capybaraHat(mood)}
      {capybaraEyes(mood)}
      <ellipse cx="29" cy="36.5" rx="9" ry="7" fill="#ecd3ac" />
      <ellipse cx="29" cy="34" rx="3.2" ry="2.4" fill="#4a2d0c" />
      <ellipse cx="28" cy="33.2" rx="0.9" ry="0.6" fill="#d6d3d1" opacity="0.9" />
      {mood === "success" ? (
        <ellipse cx="29" cy="39" rx="3" ry="2.4" fill="#4a2d0c" />
      ) : (
        <path d="M29 36.4v1.4M29 37.8q-2.8 2.4-5.6 1M29 37.8q2.8 2.4 5.6 1" stroke="#4a2d0c" strokeWidth="1.4" strokeLinecap="round" />
      )}
      <ellipse cx="18.5" cy="34" rx="2.4" ry="1.6" fill="#f0a08a" opacity={mood === "sleepy" ? 0.4 : 0.7} />
      <ellipse cx="39.5" cy="34" rx="2.4" ry="1.6" fill="#f0a08a" opacity={mood === "sleepy" ? 0.4 : 0.7} />
      <ellipse cx="19" cy="50" rx="4" ry="2.8" fill="#a9742c" />
      <ellipse cx="39" cy="50" rx="4" ry="2.8" fill="#a9742c" />
    </svg>
  );
}

export function CapybaraBadge({
  mood,
  awake,
  large = false,
  onPress,
}: {
  mood?: CapybaraMood;
  /** 兼容旧 awake 布尔：true→listening，false→idle */
  awake?: boolean;
  large?: boolean;
  onPress?: () => void;
}) {
  const m: CapybaraMood = mood ?? (awake ? "listening" : "idle");
  const cls = `mascot-bob relative flex shrink-0 items-center justify-center select-none cursor-pointer active:scale-90 active:-rotate-6 transition-transform ${large ? "h-40 w-40" : "h-24 w-24"}`;
  const [imgOk, setImgOk] = useState(true);
  // PNG 彩蛋仅 idle 常态；其余情绪一律 SVG 表达，图裂回退 SVG
  const showArt = m === "idle" && imgOk;
  const body = (
    <>
      <span className="absolute inset-0 rounded-full bg-amber-200/70 blur-md" />
      {showArt ? (
        <Image
          src="/mascots/capybara.png"
          alt=""
          aria-hidden="true"
          width={large ? 150 : 88}
          height={large ? 150 : 88}
          priority
          draggable={false}
          onError={() => setImgOk(false)}
          className="relative h-full w-full object-contain mix-blend-multiply select-none"
        />
      ) : (
        <CapybaraSvg mood={m} large={large} />
      )}
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
    <span aria-hidden="true" data-testid="capy-mascot" data-mood={m} className={cls}>
      {body}
    </span>
  );
}

function BeastSvg({ mood }: { mood: BeastMood }) {
  const cheering = mood === "cheering";
  return (
    <svg width="60" height="60" viewBox="0 0 40 40" fill="none" aria-hidden="true" className="drop-shadow-[0_10px_16px_rgba(68,64,60,.35)]">
      <circle cx="20" cy="20" r="17" fill={cheering ? "var(--color-duo-green-light)" : "#ffedd5"} />
      <circle cx="18.5" cy="22.5" r="11.5" fill="#44403c" />
      <ellipse cx="18.5" cy="14.5" rx="8.5" ry="5" fill="#f5f5f4" />
      <path d="M28 27q5.5 -1 4.5 -7" stroke="#44403c" strokeWidth="4.5" strokeLinecap="round" />
      <circle cx="32.6" cy="19.4" r="2.4" fill="#f5f5f4" />
      <circle cx="8.6" cy="17.5" r="2.6" fill="#292524" />
      <circle cx="8.6" cy="17.5" r="1" fill="#78716c" />
      {mood === "awake" || cheering ? (
        <g className="mascot-blink">
          <circle cx="14.5" cy="23" r="1.9" fill="#f5f5f4" />
          <circle cx="14.5" cy="23" r="0.8" fill="#1c1917" />
          {cheering && (
            <>
              <circle cx="22" cy="23" r="1.9" fill="#f5f5f4" />
              <circle cx="22" cy="23" r="0.8" fill="#1c1917" />
            </>
          )}
        </g>
      ) : mood === "empty" ? (
        <path d="M12.5 23.5q2 1 4 0" stroke="#f5f5f4" strokeWidth="1.5" strokeLinecap="round" />
      ) : (
        <path d="M12.5 23.5q2 2 4 0" stroke="#f5f5f4" strokeWidth="1.5" strokeLinecap="round" />
      )}
      <ellipse cx="20.5" cy="26.5" rx="1.9" ry="1.4" fill="#1c1917" />
      {cheering ? (
        <ellipse cx="19" cy="30" rx="3" ry="2.4" fill="#f5f5f4" />
      ) : mood === "empty" ? (
        <path d="M17.5 29.5h5" stroke="#f5f5f4" strokeWidth="1.3" strokeLinecap="round" />
      ) : (
        <path d="M17.5 29.5q3 2.4 6 0" stroke="#f5f5f4" strokeWidth="1.3" strokeLinecap="round" />
      )}
      {cheering && (
        <>
          <path d="M8 30 4.5 26" stroke="#44403c" strokeWidth="3" strokeLinecap="round" />
          <path d="M29 30l3.5-4" stroke="#44403c" strokeWidth="3" strokeLinecap="round" />
          <circle cx="33" cy="8" r="1.4" fill="var(--color-duo-green)" />
          <circle cx="7" cy="9" r="1.4" fill="#ff7ab8" />
          <circle cx="29" cy="4.5" r="1.2" fill="#ffd028" />
        </>
      )}
      {mood === "sleeping" && (
        <>
          <text x="29" y="11" fontSize="7" fontWeight="bold" fill="#c2410c" opacity="0.65">z</text>
          <text x="33" y="6" fontSize="9" fontWeight="bold" fill="#c2410c" opacity="0.65">z</text>
          <text x="26" y="6" fontSize="6" fontWeight="bold" fill="#c2410c" opacity="0.45">z</text>
        </>
      )}
    </svg>
  );
}

export function SleepyBeast({
  mood,
  awake = false,
  interactive = true,
  onPress,
  label = "平头哥：看看大家在忙什么，去附近的需求",
}: {
  mood?: BeastMood;
  /** 兼容旧 awake 布尔：true→awake，false→sleeping */
  awake?: boolean;
  /** false → 纯装饰 span（空态/结算内使用，不抢点击） */
  interactive?: boolean;
  onPress?: () => void;
  label?: string;
}) {
  const m: BeastMood = mood ?? (awake ? "awake" : "sleeping");
  const [imgOk, setImgOk] = useState(true);
  // PNG 彩蛋仅酣睡常态；睁眼语义只能由 SVG 表达，图裂回退 SVG
  const showArt = m === "sleeping" && imgOk;
  const goFeed = () => {
    document.getElementById("wave-feed")?.scrollIntoView({ behavior: "smooth", block: "start" });
  };
  const art = showArt ? (
    <Image
      src="/mascots/sleepy-beast.png"
      alt=""
      aria-hidden="true"
      width={180}
      height={132}
      draggable={false}
      onError={() => setImgOk(false)}
      className="h-auto w-[72px] object-contain select-none"
    />
  ) : (
    <BeastSvg mood={m} />
  );
  const cls =
    "mascot-bob flex h-20 w-20 shrink-0 items-center justify-center rounded-2xl bg-white border-2 border-[var(--color-duo-swan)] select-none cursor-pointer active:scale-90 active:rotate-6 transition-transform";
  if (!interactive && !onPress) {
    return (
      <span aria-hidden="true" data-testid="beast-mascot" data-mood={m} className={cls}>
        {art}
      </span>
    );
  }
  return (
    <button
      type="button"
      onClick={onPress ?? goFeed}
      aria-label={label}
      data-testid="beast-feed"
      data-mood={m}
      className={cls}
    >
      {art}
    </button>
  );
}
