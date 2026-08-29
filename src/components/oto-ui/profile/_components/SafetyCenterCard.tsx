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
    <div className="bg-white rounded-2xl border-2 border-[#e5e5e5] border-b-[6px] shadow-sm p-3.5">
      <h3 className="text-xs font-bold text-[#4b4b4b] mb-2 flex items-center gap-1.5">
        紧急求助
        <span className="text-xs px-1.5 py-0.5 rounded-full bg-[#f7f7f7] border-2 border-[#e5e5e5] text-[#afafaf] font-bold">
          EPA 递增通知
        </span>
      </h3>
      <p className="text-xs font-bold text-[#4b4b4b] flex items-center gap-1">
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
            className={`flex-1 px-2 py-1.5 rounded-xl text-xs font-bold border-b-4 border-x border-t transition-all shadow-sm active:translate-y-1 active:border-b-0 ${
              crisisLevel === o.lv
                ? o.lv === 3
                  ? "bg-[#ff4b4b] border-[#ea2b2b] text-white"
                  : o.lv === 2
                    ? "bg-[#ff9600] border-[#e58700] text-white"
                    : "bg-white border-[#e5e5e5] text-[#4b4b4b]"
                : "bg-[#f7f7f7] border-[#e5e5e5] text-[#afafaf]"
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
        className="mt-2 w-full rounded-xl bg-[#f7f7f7] border-2 border-[#e5e5e5] px-2.5 py-2 text-xs text-[#4b4b4b] placeholder:text-[#afafaf] focus:outline-none focus:border-[#ff4b4b]/50"
      />
      <div className="flex items-center gap-2 mt-2">
        <button
          onClick={onRaise}
          className="flex-1 px-3 py-3 rounded-xl bg-[#ff4b4b] border-b-4 border-[#ea2b2b] text-white text-xs font-extrabold shadow-sm hover:brightness-[1.03] active:translate-y-1 active:border-b-0 transition-[transform] min-h-12"
        >
          发起求助
        </button>
        {myCrisis.length > 0 && (
          <button
            onClick={onResolve}
            className="px-3 py-3 rounded-xl bg-[#58cc02] border-b-4 border-[#46a302] text-white text-xs font-bold shadow-sm hover:brightness-[1.03] active:translate-y-1 active:border-b-0 transition-[transform] min-h-12"
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
                className="px-2 py-0.5 rounded-full bg-[#ff4b4b]/10 border-2 border-[#ff4b4b]/20 text-xs font-bold text-[#ff4b4b]"
              >
                📢 已通知 {t}
              </span>
            ))}
          </div>
          {crisisSmsText && (
            <p className="text-xs text-[#4b4b4b] bg-[#f7f7f7] rounded-xl border-2 border-[#e5e5e5] px-2 py-1.5 leading-relaxed">
              {crisisSmsText}
            </p>
          )}
        </div>
      )}
      {myCrisis.length > 0 && (
        <p className="text-xs text-[#ff4b4b] mt-2 font-bold">
          处置中：{myCrisis[0].note}（登记于{" "}
          {new Date(myCrisis[0].at).toLocaleTimeString("zh-CN", { hour: "2-digit", minute: "2-digit" })}
          ）
        </p>
      )}
      {myCrisis[0]?.forensicSnapshot && (
        <p
          className="text-xs text-[#58cc02] bg-[#d7ffb8]/50 border-2 border-[#58cc02]/20 rounded-xl px-2 py-1.5 mt-1.5 font-bold"
          data-testid="sos-forensic-badge"
        >
          🛡️ 危机存证已封包（轨迹 {myCrisis[0].forensicSnapshot.trajectoryPayload.pointCount} 点 · 录音{" "}
          {myCrisis[0].forensicSnapshot.audioEvidenceSummary.chunkCount} 块 · 🔏 存证哈希已固化）
        </p>
      )}
    </div>
  );
}
