"use client";

/**
 * 需求方到达确认钮（R-0928-08 双确认之第二票）：
 * 师傅已推进 ARRIVED 且需求方尚未确认时露出；确认后 A 档（ENHANCED）
 * 自动进入录音保护（服务端落锚，本钮变"已确认"态）。
 */
import { useState } from "react";

export default function ConfirmArrivalButton({ demandId }: { demandId: string }) {
  const [phase, setPhase] = useState<"idle" | "sending" | "done" | "error">("idle");
  const [autoRecord, setAutoRecord] = useState(false);

  const confirm = () => {
    if (phase === "sending" || phase === "done") return;
    setPhase("sending");
    void fetch(`/api/demands/${encodeURIComponent(demandId)}/confirm-arrival`, { method: "POST" })
      .then(async (res) => {
        if (!res.ok) throw new Error(`confirm ${res.status}`);
        const json = (await res.json()) as { autoRecord?: boolean; already?: boolean };
        setAutoRecord(json.autoRecord === true);
        setPhase("done");
      })
      .catch(() => setPhase("error"));
  };

  if (phase === "done") {
    return (
      <p data-testid="arrival-confirmed" className="text-xs font-bold text-[var(--color-duo-green-ink)]">
        ✅ 已确认师傅到达{autoRecord ? " · 🔴 录音保护中" : ""}
      </p>
    );
  }

  return (
    <div>
      <button
        type="button"
        data-testid="confirm-arrival"
        disabled={phase === "sending"}
        onClick={confirm}
        className="touch-target w-full rounded-xl bg-[var(--color-duo-green)] px-3 py-2.5 text-xs font-extrabold text-neutral-900 disabled:opacity-50"
      >
        {phase === "sending" ? "确认中…" : "📍 师傅到了，我确认"}
      </button>
      {phase === "error" && (
        <p className="mt-1 text-xs font-bold text-red-700">确认失败，请重试</p>
      )}
    </div>
  );
}
