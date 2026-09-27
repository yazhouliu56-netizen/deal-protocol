"use client";

/**
 * 强制守护双可见条（ADR-0022）：双方信号态 + 电池上下文 + 报平安入口。
 * 无便捷开关（用户裁决）；失败静默保最后已知态（宪法 #10）。
 */
import { useGuardWatch, type GuardSideState } from "@/hooks/useGuardWatch";

export interface GuardDescription {
  tone: "standby" | "live" | "warn" | "lost" | "tamper";
  selfLine: string;
  peerLine: string | null;
  batteryLine: string | null;
  showCheckin: boolean;
}

function ageMin(serverNow: number | null, lastSeenMs: number): number {
  if (serverNow == null) return 0;
  return Math.max(0, Math.round((serverNow - lastSeenMs) / 60_000));
}

/** 纯文案映射（可单测；非法输入回 standby，永不抛）。 */
export function describeGuard(
  self: GuardSideState | null,
  peer: GuardSideState | null,
  serverNow: number | null,
  manualMode: boolean,
  batteryLow: boolean,
  batteryLevel: number | null,
): GuardDescription {
  const out: GuardDescription = {
    tone: "standby",
    selfLine: "🛡️ 行程守护待启动 · 出发后自动上报位置",
    peerLine: null,
    batteryLine: null,
    showCheckin: manualMode,
  };
  if (batteryLow) {
    const pct = batteryLevel != null ? `${Math.round(batteryLevel * 100)}%` : "低电量";
    out.batteryLine = `🔋 电量低（${pct}）· 请充电保持在线`;
  }
  if (!self) {
    if (manualMode) {
      out.selfLine = "📍 无定位权限 · 用「报平安」手动打卡";
      out.showCheckin = true;
    }
  } else if (self.state === "LIVE") {
    out.tone = "live";
    out.selfLine = "🛡️ 守护中 · 我的信号正常";
  } else if (self.state === "DEGRADED") {
    out.tone = "warn";
    out.selfLine = `⚠️ 我的信号中断 ${ageMin(serverNow, self.lastSeenMs)} 分钟 · 对方已收到提醒`;
    out.showCheckin = true;
  } else if (self.state === "LOST") {
    out.tone = "lost";
    out.selfLine = "🚨 我的信号丢失超 15 分钟 · 已升级，请报平安或联系对方";
    out.showCheckin = true;
  } else {
    out.tone = "tamper";
    out.selfLine = "⛔ 定位已关闭 · 请重新开启以恢复守护";
    out.showCheckin = true;
  }
  if (peer) {
    if (peer.state === "LIVE") out.peerLine = "对方信号正常";
    else if (peer.state === "DEGRADED")
      out.peerLine = `对方信号中断 ${ageMin(serverNow, peer.lastSeenMs)} 分钟 · 已互相提醒`;
    else if (peer.state === "LOST") out.peerLine = "对方信号丢失超 15 分钟 · 已升级";
    else out.peerLine = "对方关闭了定位 · 已标记";
    if (peer.batteryLow && peer.state !== "LIVE") {
      out.peerLine += "（对方电量低，失联可能与没电有关）";
    }
    if (out.tone === "standby") out.tone = "live";
  }
  return out;
}

const TONE_CLASS: Record<GuardDescription["tone"], string> = {
  standby: "border-zinc-200 bg-zinc-50 text-zinc-500",
  live: "border-[var(--color-duo-green)]/40 bg-[var(--color-duo-green)]/10 text-[var(--color-duo-green-ink)]",
  warn: "border-amber-300 bg-amber-50 text-amber-800",
  lost: "border-red-300 bg-red-50 text-red-700",
  tamper: "border-red-400 bg-red-50 text-red-800",
};

export default function GuardStrip({ demandId }: { demandId: string | null }) {
  const w = useGuardWatch(demandId);
  if (!demandId) return null;
  if (w.loading && !w.self && !w.peer) {
    return (
      <section data-testid="guard-strip" data-guard-tone="standby" className="rounded-2xl border px-3 py-2 text-xs font-bold border-zinc-200 bg-zinc-50 text-zinc-400">
        守护加载中…
      </section>
    );
  }
  const d = describeGuard(w.self, w.peer, w.serverNow, w.manualMode, w.batteryLow, w.batteryLevel);
  return (
    <section
      data-testid="guard-strip"
      data-guard-tone={d.tone}
      className={`rounded-2xl border px-3 py-2 text-xs font-bold ${TONE_CLASS[d.tone]}`}
    >
      <p>{d.selfLine}</p>
      {d.peerLine && <p className="mt-1 font-semibold opacity-90">对方 · {d.peerLine}</p>}
      {d.batteryLine && <p className="mt-1 font-semibold opacity-90">{d.batteryLine}</p>}
      {d.showCheckin && (
        <button
          type="button"
          data-testid="guard-checkin"
          disabled={w.checkingIn}
          onClick={() => void w.checkin()}
          className="touch-target mt-2 w-full rounded-xl bg-[var(--color-duo-green)] px-3 py-2 text-xs font-extrabold text-neutral-900 disabled:opacity-50"
        >
          {w.checkingIn ? "上报中…" : "✅ 我安全，报平安"}
        </button>
      )}
    </section>
  );
}
