"use client";

/**
 * 组局社交特化插槽（Meetup Slot · 活力橙 theme-meetup）。
 *
 * 白皮书 §五 5.7 对比矩阵 · 组局列：
 * - 履约核心：实时座次表（到场/未到场）+ 500m 签到围栏 + 扫码到场验真（ArrivalCheckHook UI 形态）；
 * - 核销完工：组织者点选到场成员解冻定金（由 FulfillmentCockpit 底部 CTA 承载）；
 * - 争议售后：AA 多退少补对账卡 + 放鸽子申诉（爽约押金判归守约方，DELAY 引信投影）。
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

const SLOT_CSS = `
.mt-slot{display:flex;flex-direction:column;gap:10px;padding:14px;border-radius:16px;
  background:linear-gradient(135deg,rgba(251,146,60,.14),rgba(251,146,60,.04));
  border:1px solid rgba(251,146,60,.3);color:#e2e8f0;font-size:13px}
.mt-slot h4{margin:0 0 6px;font-size:14px;color:#fdba74}
.mt-seats{display:grid;grid-template-columns:repeat(auto-fill,minmax(64px,1fr));gap:8px}
.mt-seat{display:flex;flex-direction:column;align-items:center;gap:4px;padding:8px 4px;border-radius:12px;
  background:rgba(255,255,255,.06);border:1px solid rgba(255,255,255,.1);font-size:11px;color:#cbd5e1}
.mt-seat-arrived{border-color:rgba(74,222,128,.5);color:#4ade80}
.mt-avatar{width:34px;height:34px;border-radius:50%;display:flex;align-items:center;justify-content:center;
  font-size:16px;background:rgba(255,255,255,.1)}
.mt-fence{display:flex;justify-content:space-between;align-items:center;padding:9px 11px;border-radius:12px;
  background:rgba(255,255,255,.07);border:1px solid rgba(255,255,255,.12)}
.mt-btn{padding:7px 12px;border-radius:10px;border:none;font-size:12px;font-weight:700;cursor:pointer;
  background:linear-gradient(135deg,#fbbf24,#f97316);color:#05060f}
.mt-split{display:flex;flex-direction:column;gap:5px;padding:9px 11px;border-radius:12px;
  background:rgba(255,255,255,.06)}
.mt-split-row{display:flex;justify-content:space-between;font-size:12px}
.mt-pay{color:#4ade80}.mt-refund{color:#fbbf24}
.mt-dispute{width:100%;padding:9px 0;border-radius:12px;border:1px solid rgba(251,191,36,.4);
  background:rgba(251,191,36,.08);color:#fbbf24;font-size:13px;font-weight:700;cursor:pointer}
`;

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
    <div className="mt-slot" data-slot="meetup">
      <style>{SLOT_CSS}</style>
      <h4>🪑 实时座次表 · {arrived}/{seats.length} 已到场</h4>
      <div className="mt-seats">
        {seats.map((seat) => (
          <div
            key={seat.id}
            className={`mt-seat${seat.arrived ? " mt-seat-arrived" : ""}`}
            data-arrived={seat.arrived ? "1" : "0"}
          >
            <span className="mt-avatar">{seat.arrived ? "✅" : "⏳"}</span>
            <span>{seat.name}</span>
          </div>
        ))}
      </div>
      <div className="mt-fence">
        <span>📍 签到围栏 {fenceMeters}m · 扫码验真解锁定金</span>
        {onScanArrival && (
          <button type="button" className="mt-btn" onClick={onScanArrival}>
            📷 扫码到场
          </button>
        )}
      </div>
      {split && (
        <section className="mt-split">
          <strong style={{ color: "#fdba74" }}>
            💰 AA 分摊对账 · 合计 ¥{split.totalYuan}
          </strong>
          {split.entries.map((entry) => (
            <div key={entry.party} className="mt-split-row">
              <span>{entry.party}</span>
              <span className={entry.deltaYuan >= 0 ? "mt-pay" : "mt-refund"}>
                {entry.deltaYuan >= 0 ? `补缴 +¥${entry.deltaYuan}` : `退还 ¥${-entry.deltaYuan}`}
              </span>
            </div>
          ))}
          {onConfirmSplit && (
            <button type="button" className="mt-btn" onClick={onConfirmSplit} style={{ alignSelf: "flex-end" }}>
              ✓ 确认分摊
            </button>
          )}
        </section>
      )}
      {onDisputeNoShow && (
        <button type="button" className="mt-dispute" onClick={onDisputeNoShow}>
          🐦 放鸽子申诉（爽约押金判归守约方）
        </button>
      )}
    </div>
  );
}
