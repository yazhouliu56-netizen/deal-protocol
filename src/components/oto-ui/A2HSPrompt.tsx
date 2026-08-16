"use client";

import { useCallback, useEffect, useImperativeHandle, useState } from "react";
import type { Ref } from "react";

/**
 * A2HS 桌面安装价值时刻引导（Add-to-Home-Screen Prompt · 白皮书 §八）。
 *
 * - 捕获 `beforeinstallprompt`：默认 `preventDefault()` 并内部持有，
 *   把原生安装弹窗延迟到「价值时刻」（首单完成 / 服务者认证通过）
 *   再弹出，避免冷启动打扰；
 * - Android / Chrome：非模态价值卡片 + 【立即添加至桌面】→ 调用原生
 *   `deferredPrompt.prompt()`；
 * - iOS Safari（standalone === false）：底部悬浮气泡图示
 *   「分享图标 ➔ 滑动选择 添加至主屏幕」。
 *
 * SSR 安全：监听全部挂在 useEffect，初始零渲染。
 */

export type A2HSMilestone = "FIRST_ORDER_COMPLETED" | "PROVIDER_VERIFIED";

export const A2HS_MILESTONE_COPY: Record<
  A2HSMilestone,
  { title: string; body: string }
> = {
  FIRST_ORDER_COMPLETED: {
    title: "首单已圆满结算 🎉",
    body: "把 OTO 空间协议添加到桌面，下次发单 / 接单像原生 App 一样直达。",
  },
  PROVIDER_VERIFIED: {
    title: "服务者认证已通过 ✅",
    body: "把工作台添加到桌面，实时接单、履约打卡、钱包结算一步直达。",
  },
};

export interface A2HSPromptHandle {
  /** 在价值时刻主动呼出安装引导（Android 卡片 / iOS 气泡二选一）。 */
  showInstallPrompt: (milestone: A2HSMilestone) => void;
}

export interface IBeforeInstallPromptLike {
  prompt: () => Promise<void>;
  userChoice?: Promise<{ outcome: string; platform: string }>;
}

export interface IA2HSPromptProps {
  /** 安装成功回调（userChoice accepted 或手动关闭后由调用方判定）。 */
  onInstalled?: () => void;
  /** UserAgent 注入点（测试 / 真机校准）；缺省读 navigator.userAgent。 */
  ua?: string;
  /** React 19 ref-as-prop：暴露 showInstallPrompt 命令式接口。 */
  ref?: Ref<A2HSPromptHandle>;
}

/** iOS Safari 判定（iPhone / iPad + 非桌面 UA）。 */
export function isIosSafari(ua: string): boolean {
  return /iPhone|iPad|iPod/.test(ua) && /Safari/.test(ua) && !/CriOS|FxiOS|OPiOS/.test(ua);
}

/** 已安装为独立 PWA 的判定（navigator.standalone，仅 iOS 存在）。 */
export function isStandalonePwa(): boolean {
  if (typeof window === "undefined") return false;
  return (
    "standalone" in window.navigator &&
    (window.navigator as unknown as { standalone?: boolean }).standalone === true
  );
}

const PROMPT_CSS = `
.a2hs-card{position:fixed;left:50%;bottom:calc(84px + env(safe-area-inset-bottom));
  transform:translateX(-50%);width:min(340px,calc(100vw - 32px));z-index:80;
  border-radius:18px;background:rgba(15,18,35,.97);border:1px solid rgba(255,255,255,.16);
  padding:16px;box-shadow:0 12px 44px rgba(0,0,0,.55);backdrop-filter:blur(20px) saturate(160%);
  -webkit-tap-highlight-color:transparent}
.a2hs-card-title{font-size:14px;font-weight:800;color:#f1f5f9;margin-bottom:6px}
.a2hs-card-body{font-size:12px;line-height:1.6;color:#cbd5e1;margin-bottom:14px}
.a2hs-card-actions{display:flex;gap:10px}
.a2hs-btn{flex:1;display:flex;align-items:center;justify-content:center;min-height:48px;
  border-radius:13px;font-size:13px;font-weight:700;cursor:pointer;transition:transform .12s;
  -webkit-tap-highlight-color:transparent}
.a2hs-btn:active{transform:scale(.97)}
.a2hs-btn-skip{background:rgba(255,255,255,.07);color:#94a3b8;border:1px solid rgba(255,255,255,.1)}
.a2hs-btn-install{background:linear-gradient(135deg,#38bdf8,#6366f1);color:#fff;
  border:1px solid rgba(255,255,255,.2);box-shadow:0 4px 18px rgba(99,102,241,.35)}
.a2hs-bubble{position:fixed;left:50%;bottom:calc(72px + env(safe-area-inset-bottom));
  transform:translateX(-50%);width:min(330px,calc(100vw - 32px));z-index:80;
  border-radius:16px;background:rgba(15,18,35,.97);border:1px solid rgba(251,191,36,.4);
  padding:14px 16px;box-shadow:0 12px 44px rgba(0,0,0,.55);backdrop-filter:blur(20px) saturate(160%);
  -webkit-tap-highlight-color:transparent}
.a2hs-bubble-title{font-size:13px;font-weight:800;color:#fde68a;margin-bottom:6px}
.a2hs-bubble-step{font-size:12px;line-height:1.7;color:#e2e8f0}
.a2hs-bubble-arrow{position:absolute;left:24px;bottom:-7px;width:14px;height:14px;
  background:rgba(15,18,35,.97);border-right:1px solid rgba(251,191,36,.4);
  border-bottom:1px solid rgba(251,191,36,.4);transform:rotate(45deg)}
`;

export default function A2HSPrompt({ onInstalled, ua, ref }: IA2HSPromptProps) {
  const [deferred, setDeferred] = useState<IBeforeInstallPromptLike | null>(null);
  const [mode, setMode] = useState<"native" | "ios" | null>(null);
  const [milestone, setMilestone] = useState<A2HSMilestone>("FIRST_ORDER_COMPLETED");

  useEffect(() => {
    if (typeof window === "undefined" || !("BeforeInstallPromptEvent" in window)) {
      return;
    }
    const onBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      const ev = e as unknown as IBeforeInstallPromptLike;
      setDeferred(ev);
    };
    window.addEventListener("beforeinstallprompt", onBeforeInstallPrompt);
    return () => {
      window.removeEventListener("beforeinstallprompt", onBeforeInstallPrompt);
    };
  }, []);

  const showInstallPrompt = useCallback(
    (m: A2HSMilestone) => {
      setMilestone(m);
      if (deferred) {
        setMode("native");
        return;
      }
      const u = ua ?? (typeof navigator !== "undefined" ? navigator.userAgent : "");
      if (isIosSafari(u) && !isStandalonePwa()) {
        setMode("ios");
      }
    },
    [deferred, ua],
  );

  useImperativeHandle(ref, () => ({ showInstallPrompt }), [showInstallPrompt]);

  const close = useCallback(() => setMode(null), []);

  const install = useCallback(async () => {
    if (!deferred) return;
    try {
      await deferred.prompt();
      const choice = await deferred.userChoice;
      if (choice && choice.outcome === "accepted") {
        onInstalled?.();
      }
    } finally {
      setDeferred(null);
      setMode(null);
    }
  }, [deferred, onInstalled]);

  if (!mode) return null;

  const copy = A2HS_MILESTONE_COPY[milestone];

  if (mode === "native") {
    return (
      <div className="a2hs-card" role="dialog" aria-modal="true" data-mode="native">
        <style>{PROMPT_CSS}</style>
        <div className="a2hs-card-title">📲 {copy.title}</div>
        <div className="a2hs-card-body">{copy.body}</div>
        <div className="a2hs-card-actions">
          <button
            type="button"
            className="a2hs-btn a2hs-btn-skip"
            style={{ minHeight: 48 }}
            onClick={close}
            data-action="a2hs-later"
          >
            稍后再说
          </button>
          <button
            type="button"
            className="a2hs-btn a2hs-btn-install"
            style={{ minHeight: 48 }}
            onClick={() => void install()}
            data-action="a2hs-install"
          >
            立即添加至桌面
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="a2hs-bubble" role="status" data-mode="ios">
      <style>{PROMPT_CSS}</style>
      <div className="a2hs-bubble-title">🍎 添加至主屏幕，像 App 一样用</div>
      <div className="a2hs-bubble-step">
        {copy.title}。轻点底部 Safari 栏的
        <b>「分享」图标 ⬆️</b>
        ，滑动选择
        <b>「添加至主屏幕」</b>
        ——下次从桌面图标一键直达，无需重新登录。
      </div>
      <div className="a2hs-bubble-arrow" aria-hidden="true" />
    </div>
  );
}
