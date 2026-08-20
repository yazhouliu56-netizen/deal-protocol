"use client";

import { Radar } from "lucide-react";
import { useWaveStore } from "@/store/useWaveStore";

/**
 * 多因子反欺诈探针仪表盘（ADR-0009）。
 * 最近甄检分数环 + 四因子贡献 + 事件流。实时读取 store sentinelEvents。
 */
export default function SentinelDashboard() {
  const sentinelEvents = useWaveStore((s) => s.sentinelEvents);

  const latest = [...sentinelEvents].sort((a, b) => b.at - a.at)[0];

  const levelCls =
    latest?.level === "high"
      ? "text-red-300"
      : latest?.level === "watch"
        ? "text-amber-300"
        : "text-emerald-300";
  const ringColor =
    latest?.level === "high"
      ? "#f87171"
      : latest?.level === "watch"
        ? "#fbbf24"
        : "#34d399";

  return (
    <div className="rounded-2xl bg-gradient-to-br from-white/[0.05] to-transparent border border-white/10 p-3 space-y-2.5 mt-3">
      <h3 className="text-xs font-extrabold text-white/85 flex items-center gap-1.5">
        <Radar size={11} className="text-brandCyan" /> 反欺诈探针（ADR-0009）
      </h3>

      {!latest ? (
        <p className="text-xs text-white/40 px-2 py-3 text-center">
          暂无甄检记录 · 发布需求时自动触发
        </p>
      ) : (
        <>
          <div className="flex items-center gap-3">
            <svg width="64" height="64" viewBox="0 0 64 64" aria-hidden="true">
              <circle cx="32" cy="32" r="26" fill="none" stroke="rgba(255,255,255,0.1)" strokeWidth="6" />
              <circle
                cx="32"
                cy="32"
                r="26"
                fill="none"
                stroke={ringColor}
                strokeWidth="6"
                strokeLinecap="round"
                strokeDasharray={`${(latest.score / 100) * 163.36} 163.36`}
                transform="rotate(-90 32 32)"
              />
              <text x="32" y="36" textAnchor="middle" fontSize="13" fontWeight="bold" fill={ringColor}>
                {latest.score}
              </text>
            </svg>
            <div className="space-y-0.5 min-w-0">
              <p className={`text-xs font-bold ${levelCls}`}>
                最近甄检 · {latest.level === "high" ? "高危" : latest.level === "watch" ? "提醒" : "通过"}
              </p>
              <p className="text-xs text-white/45 leading-snug">{latest.note}</p>
              <p className="text-xs text-white/30">
                {new Date(latest.at).toLocaleString("zh-CN")}
              </p>
            </div>
          </div>

          <div className="space-y-1">
            {["设备多开", "信用与金额", "发布行为", "关联图谱"].map((label) => {
              const hit = latest.note.includes(label);
              return (
                <div
                  key={label}
                  className={`flex items-center justify-between text-xs px-2 py-1 rounded-lg border ${
                    hit
                      ? "bg-red-400/[0.08] border-red-400/25 text-red-200"
                      : "bg-white/[0.03] border-white/[0.06] text-white/40"
                  }`}
                >
                  <span>{label}</span>
                  <span>{hit ? "⚠ 触发" : "—"}</span>
                </div>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}