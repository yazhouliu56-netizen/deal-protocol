"use client";
import type { CrisisLevel, CrisisRecord } from "@/base/safe/crisis";

interface SafetyCenterCardProps {
  crisisLevel: CrisisLevel;
  crisisNote: string;
  /** 本人未处置危机记录（处置中提示 + 「已平安，结束」按钮显隐）。 */
  myCrisis: CrisisRecord[];
  crisisTargets: string[];
  crisisSmsText: string;
  onSelectLevel: (lv: CrisisLevel) => void;
  onNoteChange: (v: string) => void;
  /** 发起求助（ProfilePage 原样 handler：raiseCrisis + EPA 目标 + SMS 预览组装）。 */
  onRaise: () => void;
  /** 已平安，结束（resolveCrisis(myCrisis[0].id)）。 */
  onResolve: () => void;
}

/** ADR-0013 安全中心：SOS 危机干预卡（N8/N10 接线；子组件化搬移，DOM 零漂移）。 */
export default function SafetyCenterCard({
  crisisLevel,
  crisisNote,
  myCrisis,
  crisisTargets,
  crisisSmsText,
  onSelectLevel,
  onNoteChange,
  onRaise,
  onResolve,
}: SafetyCenterCardProps) {
  return (
    <div className="glass-panel rounded-2xl p-3.5">
      <h3 className="text-xs font-bold text-white/88 mb-2 flex items-center gap-1.5">
        紧急求助
        <span className="text-xs px-1.5 py-0.5 rounded-full bg-white/[0.06] border border-white/10 text-white/68">
          EPA 递增通知
        </span>
      </h3>
      <p className="text-xs font-bold text-white/88 flex items-center gap-1">
        紧急求助（紧急联系人 → 平台值班 → 警方通道）
      </p>
      <div className="flex gap-1.5 mt-2">
        {([
          { lv: 1, label: "轻微不适" },
          { lv: 2, label: "危险信号" },
          { lv: 3, label: "极端紧急" },
        ] as const).map((o) => (
          <button
            key={o.lv}
            onClick={() => onSelectLevel(o.lv)}
            className={`flex-1 px-2 py-1.5 rounded-lg text-xs font-bold border transition-all ${
              crisisLevel === o.lv
                ? o.lv === 3
                  ? "bg-red-400/25 border-red-400/60 text-red-300"
                  : o.lv === 2
                    ? "bg-amber-400/20 border-amber-400/50 text-amber-300"
                    : "bg-white/[0.1] border-white/25 text-white/95"
                : "bg-white/[0.04] border-white/10 text-white/68"
            }`}
          >
            {o.label}
          </button>
        ))}
      </div>
      <input
        value={crisisNote}
        onChange={(e) => onNoteChange(e.target.value)}
        placeholder="备注（如：山野迷路，沿步道 2 号点等待）"
        className="mt-2 w-full rounded-lg bg-white/[0.06] border border-white/10 px-2.5 py-1.5 text-xs text-white/88 placeholder:text-white/68 focus:outline-none focus:border-red-400/50"
      />
      <div className="flex items-center gap-2 mt-2">
        <button
          onClick={onRaise}
          className="flex-1 px-3 py-2 rounded-lg bg-red-400/20 border border-red-400/50 text-red-300 text-xs font-extrabold hover:bg-red-400/30 active:scale-95 transition-all"
        >
          发起求助
        </button>
        {myCrisis.length > 0 && (
          <button
            onClick={onResolve}
            className="px-3 py-2 rounded-lg bg-emerald-400/15 border border-emerald-400/40 text-emerald-300 text-xs font-bold hover:bg-emerald-400/25 active:scale-95 transition-all"
          >
            已平安，结束
          </button>
        )}
      </div>
      {crisisTargets.length > 0 && (
        <div className="space-y-1 mt-2">
          <div className="flex flex-wrap gap-1">
            {crisisTargets.map((t) => (
              <span
                key={t}
                className="px-2 py-0.5 rounded-full bg-red-400/15 border border-red-400/40 text-xs font-bold text-red-300"
              >
                📢 已通知 {t}
              </span>
            ))}
          </div>
          {crisisSmsText && (
            <p className="text-xs text-white/68 bg-white/[0.03] rounded-lg px-2 py-1.5 leading-relaxed">
              {crisisSmsText}
            </p>
          )}
        </div>
      )}
      {myCrisis.length > 0 && (
        <p className="text-xs text-red-300/80 mt-2">
          处置中：{myCrisis[0].note}（登记于{" "}
          {new Date(myCrisis[0].at).toLocaleTimeString("zh-CN", { hour: "2-digit", minute: "2-digit" })}
          ）
        </p>
      )}
    </div>
  );
}
