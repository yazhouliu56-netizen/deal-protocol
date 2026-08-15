"use client";

import Image from "next/image";

/**
 * 家政保洁特化插槽（Housekeeping Slot · 清洁蓝 theme-housekeeping）。
 *
 * 白皮书 §五 5.7 对比矩阵 · 家政列：
 * - 履约核心：现场增项改价确认单（OnsiteQuoteHook 的 UI 形态）+ Before/After 双拍照片池；
 * - 核销完工：双方碰一碰 NFC / 雇主验收清单打钩（由 FulfillmentCockpit 底部 CTA 承载）；
 * - 争议售后：损坏包赔（财产险理赔直连，IMPACT 引信 propertyInsurance 投影）。
 * 自包含 CSS（外骨骼零改动，差异全收敛插槽区，红线 2）。
 */

export interface HousekeepingQuote {
  /** 增项项目名（如「深度除螨」「空调清洗」）。 */
  item: string;
  /** 增项金额（¥）。 */
  amountYuan: number;
  /** 是否已被雇主确认。 */
  confirmed: boolean;
}

export interface HousekeepingSlotProps {
  /** 现场增项改价确认单（未提供则不渲染增项卡）。 */
  quote?: HousekeepingQuote;
  /** Before/After 双拍照片（验真徽标依据 fuze trace.photoProof 语义）。 */
  photos?: { before: string | null; after: string | null };
  /** 增项确认（OnsiteQuoteHook 放行语义）。 */
  onAcceptQuote?: () => void;
  /** 增项拒绝（BLOCK 语义：不确认则履约卡在 IN_SERVICE）。 */
  onRejectQuote?: () => void;
  /** 损坏包赔理赔直连（财产险入口）。 */
  onClaimDamage?: () => void;
}

const SLOT_CSS = `
.hk-slot{display:flex;flex-direction:column;gap:10px;padding:14px;border-radius:16px;
  background:linear-gradient(135deg,rgba(56,132,255,.14),rgba(56,132,255,.04));
  border:1px solid rgba(56,132,255,.3);color:#e2e8f0;font-size:13px}
.hk-slot h4{margin:0 0 6px;font-size:14px;color:#7fb2ff}
.hk-quote{display:flex;justify-content:space-between;align-items:center;gap:8px;padding:9px 11px;
  border-radius:12px;background:rgba(255,255,255,.07);border:1px solid rgba(255,255,255,.12)}
.hk-quote-btns{display:flex;gap:6px}
.hk-btn{padding:6px 12px;border-radius:10px;border:none;font-size:12px;font-weight:600;cursor:pointer}
.hk-btn-accept{background:linear-gradient(135deg,#38bdf8,#2563eb);color:#fff}
.hk-btn-reject{background:rgba(255,255,255,.1);color:#cbd5e1;border:1px solid rgba(255,255,255,.2)}
.hk-photos{display:grid;grid-template-columns:1fr 1fr;gap:8px}
.hk-photo{position:relative;aspect-ratio:4/3;border-radius:12px;border:1px dashed rgba(255,255,255,.25);
  display:flex;align-items:center;justify-content:center;font-size:11px;color:#94a3b8;
  overflow:hidden;background:rgba(255,255,255,.05)}
.hk-photo img{width:100%;height:100%;object-fit:cover;border-radius:12px}
.hk-verified{margin-left:4px;font-size:11px;color:#4ade80}
.hk-damage{width:100%;padding:9px 0;border-radius:12px;border:none;font-size:13px;font-weight:700;
  cursor:pointer;background:linear-gradient(135deg,#f97316,#dc2626);color:#fff}
`;

/** 家政保洁插槽：增项改价确认单 + 双拍照片池 + 损坏包赔直连。 */
export default function HousekeepingSlot({
  quote,
  photos,
  onAcceptQuote,
  onRejectQuote,
  onClaimDamage,
}: HousekeepingSlotProps) {
  return (
    <div className="hk-slot" data-slot="housekeeping">
      <style>{SLOT_CSS}</style>
      {quote && (
        <section className="hk-quote">
          <div>
            <strong>现场增项：{quote.item}</strong>
            <div style={{ color: "#fbbf24" }}>+¥{quote.amountYuan}</div>
          </div>
          <div className="hk-quote-btns">
            {quote.confirmed ? (
              <span style={{ color: "#4ade80", fontSize: 12 }}>已确认 ✓</span>
            ) : (
              <>
                <button type="button" className="hk-btn hk-btn-accept" onClick={onAcceptQuote}>
                  确认增项
                </button>
                <button type="button" className="hk-btn hk-btn-reject" onClick={onRejectQuote}>
                  拒绝
                </button>
              </>
            )}
          </div>
        </section>
      )}
      <section className="hk-photos">
        <div className="hk-photo">
          {photos?.before ? (
            <Image src={photos.before} alt="服务前照片" fill sizes="50vw" style={{ objectFit: "cover" }} />
          ) : (
            <span>📷 Before 待拍摄</span>
          )}
        </div>
        <div className="hk-photo">
          {photos?.after ? (
            <Image src={photos.after} alt="服务后照片" fill sizes="50vw" style={{ objectFit: "cover" }} />
          ) : (
            <span>📷 After 待拍摄</span>
          )}
        </div>
      </section>
      <div style={{ fontSize: 11, color: "#94a3b8" }}>
        {photos?.before && photos.after ? (
          <span className="hk-verified">✅ 双拍验真已通过</span>
        ) : (
          <span>⚠️ 完成双拍后方可验收（红线 4 零信任物理感知）</span>
        )}
      </div>
      {onClaimDamage && (
        <button type="button" className="hk-damage" onClick={onClaimDamage}>
          🛡️ 损坏包赔 · 财产险理赔直连
        </button>
      )}
    </div>
  );
}
