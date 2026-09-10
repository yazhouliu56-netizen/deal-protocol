"use client";

import { useState } from "react";
import { useWaveStore } from "@/store/useWaveStore";
import { toast } from "@/base/platform/toast";
import { trackMetric } from "@/lib/track-metric";
import {
  canAddItem,
  canFreeCancel,
  canReschedule,
  sanitizeNewCustom,
  sanitizeNewTime,
} from "@/base/order/intervene";
import type { AtomicFiveState } from "@/types/ammo-schema";

/**
 * 需求方干预区（P2-T1）：改期 / 加项 / 无责撤回。
 * 每个按钮背后都是真实store动作（rescheduleWave/addWaveCustom/closeWave）；
 * 催单无送达路径，不设按钮（假按钮禁令）。
 * 挂载点：FulfillmentCenter 争议行下方。
 */
export default function DemanderInterveneBar({
  waveId,
  fiveState,
  createdAt,
  currentTime,
  existingCustoms,
}: {
  waveId: string;
  fiveState: AtomicFiveState;
  createdAt: number;
  currentTime: string;
  existingCustoms: string[];
}) {
  const rescheduleWave = useWaveStore((s) => s.rescheduleWave);
  const addWaveCustom = useWaveStore((s) => s.addWaveCustom);
  const closeWave = useWaveStore((s) => s.closeWave);
  const [mode, setMode] = useState<"idle" | "time" | "custom">("idle");
  const [val, setVal] = useState("");

  const allowTime = canReschedule(fiveState);
  const allowCustom = canAddItem(fiveState);
  const freeCancel = canFreeCancel(createdAt);
  if (!allowTime && !allowCustom && !freeCancel) return null;

  function submitTime() {
    const t = sanitizeNewTime(val);
    if (!t) return;
    rescheduleWave(waveId, t);
    try {
      trackMetric("panel.intervene", 1, { kind: "reschedule" });
    } catch {}
    toast(`已改期 · ${t}`, "success");
    setMode("idle");
    setVal("");
  }

  function submitCustom() {
    const t = sanitizeNewCustom(val, existingCustoms);
    if (!t) return;
    addWaveCustom(waveId, t);
    try {
      trackMetric("panel.intervene", 1, { kind: "additem" });
    } catch {}
    toast(`已加项 · ${t}`, "success");
    setMode("idle");
    setVal("");
  }

  return (
    <div data-testid="intervene-bar" className="mb-2 flex flex-wrap items-center gap-1.5">
      {allowTime && mode !== "time" && (
        <button
          onClick={() => {
            setMode("time");
            setVal(currentTime);
          }}
          aria-label="改期"
          className="px-2.5 min-h-8 rounded-full text-xs font-bold bg-white border-2 border-[var(--color-duo-swan)] text-[var(--color-duo-blue-ink)]"
        >
          📅 改期
        </button>
      )}
      {allowCustom && mode !== "custom" && (
        <button
          onClick={() => {
            setMode("custom");
            setVal("");
          }}
          aria-label="加项"
          className="px-2.5 min-h-8 rounded-full text-xs font-bold bg-white border-2 border-[var(--color-duo-swan)] text-[var(--color-duo-blue-ink)]"
        >
          ➕ 加项
        </button>
      )}
      {freeCancel && (
        <button
          onClick={() => {
            closeWave(waveId);
            toast("已无责撤回", "success");
          }}
          aria-label="无责撤回"
          className="px-2.5 min-h-8 rounded-full text-xs font-bold bg-white border-2 border-red-200 text-red-500"
        >
          ↩ 无责撤回
        </button>
      )}
      {mode !== "idle" && (
        <span className="flex flex-1 min-w-36 items-center gap-1.5">
          <input
            value={val}
            onChange={(e) => setVal(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") (mode === "time" ? submitTime : submitCustom)();
            }}
            aria-label={mode === "time" ? "新时间" : "加项内容"}
            placeholder={mode === "time" ? "如：明晚 7 点" : "如：顺手洗油烟机"}
            className="flex-1 min-w-0 rounded-2xl bg-[var(--color-duo-polar)] border border-[var(--color-duo-swan)] px-3 py-1.5 text-xs text-[var(--color-duo-eel)] outline-none focus:border-[var(--color-duo-blue)]"
          />
          <button
            onClick={mode === "time" ? submitTime : submitCustom}
            aria-label="确认干预"
            className="px-2.5 min-h-8 rounded-full text-xs font-extrabold bg-[var(--color-duo-green)] text-white shrink-0"
          >
            定
          </button>
        </span>
      )}
    </div>
  );
}
