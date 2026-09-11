"use client";

import DuoButton from "@/components/ui/DuoButton";
import DuoCardShell from "@/components/ui/DuoCardShell";

/**
 * 组局社交特化插槽（Meetup Slot · 活力橙 theme-meetup）。
 *
 * 白皮书 §五 5.7 对比矩阵 · 组局列：
 * - 履约核心：实时座次表（到场/未到场）+ 500m 签到围栏 + 扫码到场验真（ArrivalCheckHook UI 形态）；
 * - 核销完工：组织者点选到场成员解冻定金（由 FulfillmentCockpit 底部 CTA 承载）；
 * - 争议售后：AA 多退少补对账卡 + 放鸽子申诉（爽约押金判归守约方，DELAY 引信投影）。
 *
 * Duo 化（Batch① 2026-09，Companion 先例）：活力橙暗岛 `<style>` 去除，白底
 * DuoCardShell + DuoButton；场景身份由父级 data-theme="meetup" 承载。
 * 扫码/确认分摊收敛 warning/primary，申诉收敛 outline。
 * 契约与埋点不变：data-slot="meetup" / data-arrived / 文案全保留。
 */

export interface MeetupSeat {
  id: string;
  /** 称呼（脱敏展示，宪法 #8）。 */
  name: string;
  arrived: boolean;
}

export interface MeetupSplitEntry {
  /** 成员称呼（脱敏）。 */
  party: string;
  /** 应付（正数=补缴，负数=退还）。 */
  deltaYuan: number;
}

export interface MeetupSlotProps {
  /** 实时座次表。 */
  seats: MeetupSeat[];
  /** 签到围栏半径（米），默认 500m（DELAY 引信 geoFence.radiusM）。 */
  fenceMeters?: number;
  /** 到场扫码验真（解锁定金）。 */
  onScanArrival?: () => void;
  /** AA 多退少补分摊明细。 */
  split?: { entries: MeetupSplitEntry[]; totalYuan: number };
  /** AA 对账确认（AASplitSettleHook 确认态）。 */
  onConfirmSplit?: () => void;
  /** 放鸽子申诉（爽约争议入口）。 */
  onDisputeNoShow?: () => void;
}

/** 组局社交插槽：座次表 + 500m 围栏签到 + AA 分摊对账 + 放鸽子申诉。 */
export default function MeetupSlot({
  seats,
  fenceMeters = 500,
  onScanArrival,
  split,
  onConfirmSplit,
  onDisputeNoShow,
}: MeetupSlotProps) {
  const arrived = seats.filter((s) => s.arrived).length;

  return (
    <DuoCardShell
      className="p-3.5 space-y-2.5"
      dataAttrs={{ "data-slot": "meetup" }}
    >
      <h4 className="text-sm font-extrabold text-[var(--color-duo-eel)]">
        🪑 实时座次表 · {arrived}/{seats.length} 已到场
      </h4>
      <div className="grid gap-2" style={{ gridTemplateColumns: "repeat(auto-fill,minmax(64px,1fr))" }}>
        {seats.map((seat) => (
          <div
            key={seat.id}
            data-arrived={seat.arrived ? "1" : "0"}
            className={`flex flex-col items-center gap-1 rounded-xl border-2 px-1 py-2 text-xs font-bold ${
              seat.arrived
                ? "bg-[var(--color-duo-green)]/10 border-[var(--color-duo-green-dark)]/60 text-[var(--color-duo-green-ink)]"
                : "bg-[var(--color-duo-polar)] border-[var(--color-duo-swan)] text-[var(--color-duo-eel)]"
            }`}
          >
            <span className="text-base">{seat.arrived ? "✅" : "⏳"}</span>
            <span>{seat.name}</span>
          </div>
        ))}
      </div>
      <div className="flex items-center justify-between gap-2 rounded-2xl bg-[var(--color-duo-polar)] border-2 border-[var(--color-duo-swan)] px-3 py-2">
        <span className="text-sm font-bold text-[var(--color-duo-eel)]">
          📍 签到围栏 {fenceMeters}m · 扫码验真解锁定金
        </span>
        {onScanArrival && (
          <DuoButton variant="warning" size="sm" onClick={onScanArrival} className="shrink-0">
            📷 扫码到场
          </DuoButton>
        )}
      </div>
      {split && (
        <section className="flex flex-col gap-1.5 rounded-2xl bg-[var(--color-duo-polar)] border-2 border-[var(--color-duo-swan)] px-3 py-2">
          <strong className="text-sm font-extrabold text-[var(--color-duo-eel)]">
            💰 AA 分摊对账 · 合计 ¥{split.totalYuan}
          </strong>
          {split.entries.map((entry) => (
            <div key={entry.party} className="flex justify-between text-[13px] font-bold">
              <span className="text-[var(--color-duo-eel)]">{entry.party}</span>
              <span
                className={
                  entry.deltaYuan >= 0
                    ? "text-[var(--color-duo-green-ink)]"
                    : "text-[var(--color-duo-yellow-ink)]"
                }
              >
                {entry.deltaYuan >= 0 ? `补缴 +¥${entry.deltaYuan}` : `退还 ¥${-entry.deltaYuan}`}
              </span>
            </div>
          ))}
          {onConfirmSplit && (
            <DuoButton
              variant="primary"
              size="sm"
              onClick={onConfirmSplit}
              className="self-end"
            >
              ✓ 确认分摊
            </DuoButton>
          )}
        </section>
      )}
      {onDisputeNoShow && (
        <DuoButton variant="outline" fullWidth onClick={onDisputeNoShow}>
          🐦 放鸽子申诉（爽约押金判归守约方）
        </DuoButton>
      )}
    </DuoCardShell>
  );
}
