"use client";

import Image from "next/image";
import { useState } from "react";
import type { INormalizedCustomIntent } from "@/types/ammo-schema";
import ProofCamera, { type IProofCaptureResult } from "@/components/oto-ui/controls/ProofCamera";

/**
 * 家政保洁特化插槽（Housekeeping Slot · 清洁蓝 theme-housekeeping）。
 *
 * 白皮书 §五 5.7 对比矩阵 · 家政列：
 * - 履约核心：现场增项改价确认单（OnsiteQuoteHook 的 UI 形态）+ Before/After 双拍照片池；
 * - 核销完工：双方碰一碰 NFC / 雇主验收清单打钩（由 FulfillmentCockpit 底部 CTA 承载）；
 * - 争议售后：损坏包赔（财产险理赔直连，IMPACT 引信 propertyInsurance 投影）。
 * 自包含 CSS（外骨骼零改动，差异全收敛插槽区，红线 2）。
 * P0-3/P1-1 全链：原生相机直拍 ➔ 水印压制 ➔ SHA-256 ➔ 五信号快筛 ➔ 存证载荷结构化入账。
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
  /** 订单基础金额（¥；用于展示防坐地起价上限，缺省 0 不显示）。 */
  baseAmountYuan?: number;
  /** 现场加价上限比例（对齐弹药 maxSurchargeRatio；缺省 0.5 = 50%）。 */
  maxSurchargeRatio?: number;
  /** 需求方定制要求（阶段3 语义驯化产物）：结构化渲染中性定制标签（着装/年龄/性别）。 */
  customRequirements?: INormalizedCustomIntent;
  /** 关联订单号（水印订单哈希，P0-3 全链透传）。 */
  orderNo?: string;
  /** 当前 GPS（水印坐标，缺省占位）。 */
  geo?: { lat: number; lng: number; accuracyMeters?: number };
  /** 存证捕获回调（Before/After 结构化载荷入账）。 */
  onProofCaptured?: (phaseKey: "before" | "after", result: IProofCaptureResult) => void;
}

const SLOT_CSS = `
.hk-slot{display:flex;flex-direction:column;gap:10px;padding:14px;border-radius:16px;
  background:linear-gradient(135deg,rgba(56,132,255,.14),rgba(56,132,255,.04));
  border:1px solid rgba(56,132,255,.3);color:#e2e8f0;font-size:14px;line-height:1.5}
.hk-slot h4{margin:0 0 6px;font-size:15px;font-weight:600;color:#8ec3ff}
.hk-quote{display:flex;justify-content:space-between;align-items:center;gap:8px;padding:9px 11px;
  border-radius:12px;background:rgba(255,255,255,.07);border:1px solid rgba(255,255,255,.12)}
.hk-quote-btns{display:flex;gap:6px}
.hk-btn{padding:6px 12px;border-radius:10px;border:none;font-size:13px;font-weight:600;cursor:pointer}
.hk-btn-accept{background:linear-gradient(135deg,#38bdf8,#2563eb);color:#fff}
.hk-btn-reject{background:rgba(255,255,255,.1);color:#dbe4f0;border:1px solid rgba(255,255,255,.2)}
.hk-photos{display:grid;grid-template-columns:1fr 1fr;gap:8px}
.hk-photo{position:relative;aspect-ratio:4/3;border-radius:12px;border:1px dashed rgba(255,255,255,.25);
  display:flex;align-items:center;justify-content:center;font-size:12px;color:#cbd5e1;
  overflow:hidden;background:rgba(255,255,255,.05);font-weight:500;flex-direction:column;gap:6px}
.hk-photo img{width:100%;height:100%;object-fit:cover;border-radius:12px}
.hk-photo-btn{min-height:44px;padding:7px 12px;border-radius:12px;border:none;font-size:12px;font-weight:800;
  cursor:pointer;color:#fff;background:linear-gradient(135deg,#38bdf8,#2563eb);box-shadow:0 4px 14px rgba(37,99,235,.35)}
.hk-verified{margin-left:4px;font-size:12px;color:#4ade80;font-weight:600}
.hk-damage{width:100%;padding:9px 0;border-radius:12px;border:none;font-size:14px;font-weight:700;
  cursor:pointer;background:linear-gradient(135deg,#f97316,#dc2626);color:#fff}
.hk-cap{font-size:12px;color:#cbd5e1;padding:6px 10px;border-radius:10px;line-height:1.5;
  background:rgba(251,191,36,.08);border:1px solid rgba(251,191,36,.25)}
.hk-cap-ok{color:#4ade80;background:rgba(74,222,128,.08);border-color:rgba(74,222,128,.25)}
.hk-cap-over{color:#f87171;background:rgba(248,113,113,.1);border-color:rgba(248,113,113,.4)}
.hk-custom{display:flex;flex-wrap:wrap;gap:6px}
.hk-custom-tag{font-size:12px;font-weight:700;padding:3px 9px;border-radius:999px;
  background:rgba(123,97,255,.14);border:1px solid rgba(123,97,255,.4);color:#c4b5fd}
.hk-proof-modal{position:fixed;inset:0;z-index:60;background:rgba(0,0,0,.6);backdrop-filter:blur(4px);
  display:flex;align-items:center;justify-content:center;padding:16px}
.hk-proof-sheet{width:100%;max-width:420px;max-height:88vh;overflow:auto;background:linear-gradient(160deg,#0f172a,#1e293b);
  border:1px solid rgba(255,255,255,.12);border-radius:20px;padding:14px}
.hk-forgery{font-size:11px;font-weight:700;padding:3px 8px;border-radius:999px;border:1px solid}
.hk-forgery-low{background:rgba(34,197,94,.14);border-color:rgba(34,197,94,.35);color:#86efac}
.hk-forgery-medium{background:rgba(251,191,36,.14);border-color:rgba(251,191,36,.4);color:#fde68a}
.hk-forgery-high{background:rgba(249,115,22,.14);border-color:rgba(249,115,22,.4);color:#fed7aa}
.hk-forgery-critical{background:rgba(239,68,68,.18);border-color:rgba(239,68,68,.5);color:#fecaca}
`;

/** 家政保洁插槽：增项改价确认单 + 双拍照片池 + 损坏包赔直连。 */
const DRESS_LABEL_HK: Record<string, string> = {
  THEMED_MAID: "女仆主题",
  THEMED_COSPLAY: "角色扮演/制服",
  FORMAL_UNIFORM: "正装/礼服",
  CUSTOM: "指定着装",
};

/** 定制契约 → 插槽中性标签（纯函数，结构化投影）。 */
export function describeSlotCustomTags(
  custom?: INormalizedCustomIntent,
): string[] {
  if (!custom) return [];
  const tags: string[] = [];
  if (custom.dressCode?.required) {
    tags.push(`[工作着装: ${DRESS_LABEL_HK[custom.dressCode.type] ?? "指定着装"}]`);
  }
  if (custom.ageRange) {
    tags.push(`[期望年龄: ${custom.ageRange[0]}-${custom.ageRange[1]}岁]`);
  }
  if (custom.genderPreference && custom.genderPreference !== "ANY") {
    tags.push(`[性别偏好: ${custom.genderPreference === "FEMALE" ? "女性" : "男性"}]`);
  }
  return tags;
}

function forgeryClass(level: string): string {
  switch (level) {
    case "LOW":
      return "hk-forgery-low";
    case "MEDIUM":
      return "hk-forgery-medium";
    case "HIGH":
      return "hk-forgery-high";
    case "CRITICAL":
      return "hk-forgery-critical";
    default:
      return "hk-forgery-low";
  }
}

export default function HousekeepingSlot({
  quote,
  photos,
  onAcceptQuote,
  onRejectQuote,
  onClaimDamage,
  baseAmountYuan = 0,
  maxSurchargeRatio = 0.5,
  customRequirements,
  orderNo,
  geo,
  onProofCaptured,
}: HousekeepingSlotProps) {
  const hasBase = baseAmountYuan > 0;
  const capYuan = hasBase ? Math.round(baseAmountYuan * maxSurchargeRatio * 100) / 100 : null;
  const overCap =
    capYuan !== null && quote && !quote.confirmed && quote.amountYuan > capYuan;
  const customTags = describeSlotCustomTags(customRequirements);
  const [capturing, setCapturing] = useState<"before" | "after" | null>(null);
  const [beforeResult, setBeforeResult] = useState<IProofCaptureResult | null>(null);
  const [afterResult, setAfterResult] = useState<IProofCaptureResult | null>(null);

  const beforeDisplay = beforeResult?.dataUrl ?? photos?.before ?? null;
  const afterDisplay = afterResult?.dataUrl ?? photos?.after ?? null;
  const twinVerified = Boolean(beforeDisplay && afterDisplay);
  const twinCritical = beforeResult?.forgeryReport.riskLevel === "CRITICAL" || afterResult?.forgeryReport.riskLevel === "CRITICAL";

  const handleCaptured = (phase: "before" | "after", result: IProofCaptureResult) => {
    if (phase === "before") setBeforeResult(result);
    else setAfterResult(result);
    onProofCaptured?.(phase, result);
    setCapturing(null);
  };

  return (
    <div className="hk-slot" data-slot="housekeeping">
      <style>{SLOT_CSS}</style>
      {customTags.length > 0 && (
        <section className="hk-custom" data-testid="hk-custom-requirements" data-custom-requirements>
          {customTags.map((tag) => (
            <span key={tag} className="hk-custom-tag" data-custom-tag>
              {tag}
            </span>
          ))}
        </section>
      )}
      {hasBase && capYuan !== null && (
        <section
          className={`hk-cap ${overCap ? "hk-cap-over" : quote ? "hk-cap-ok" : ""}`}
          data-cap-meta
        >
          {overCap
            ? `⚠️ 增项 +¥${quote.amountYuan} 超过上限 ¥${capYuan}（基础金额 ${maxSurchargeRatio * 100}%）——超出部分需双方重新确认，防坐地起价`
            : `🛡️ 现场加价上限为订单基础金额的 ${maxSurchargeRatio * 100}%（¥${capYuan}），超限增项将拦截（防坐地起价）`}
        </section>
      )}
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
      <section className="hk-photos" data-testid="hk-photos">
        <div className="hk-photo" data-photo="before">
          {beforeDisplay ? (
            <>
              <Image src={beforeDisplay} alt="服务前照片" fill sizes="50vw" style={{ objectFit: "cover" }} />
              {beforeResult && (
                <span className={`hk-forgery ${forgeryClass(beforeResult.forgeryReport.riskLevel)}`} style={{ position: "absolute", bottom: 6, left: 6, right: 6, textAlign: "center" }} data-testid="hk-before-forgery">
                  🔬 {Math.round(beforeResult.forgeryReport.overallConfidence * 100)}% · {beforeResult.forgeryReport.riskLevel}
                </span>
              )}
            </>
          ) : (
            <>
              <span>📷 Before 待拍摄</span>
              <button type="button" className="hk-photo-btn" data-action="hk-proof-before" onClick={() => setCapturing("before")}>
                拍照打卡
              </button>
            </>
          )}
        </div>
        <div className="hk-photo" data-photo="after">
          {afterDisplay ? (
            <>
              <Image src={afterDisplay} alt="服务后照片" fill sizes="50vw" style={{ objectFit: "cover" }} />
              {afterResult && (
                <span className={`hk-forgery ${forgeryClass(afterResult.forgeryReport.riskLevel)}`} style={{ position: "absolute", bottom: 6, left: 6, right: 6, textAlign: "center" }} data-testid="hk-after-forgery">
                  🔬 {Math.round(afterResult.forgeryReport.overallConfidence * 100)}% · {afterResult.forgeryReport.riskLevel}
                </span>
              )}
            </>
          ) : (
            <>
              <span>📷 After 待拍摄</span>
              <button type="button" className="hk-photo-btn" data-action="hk-proof-after" onClick={() => setCapturing("after")}>
                拍照打卡
              </button>
            </>
          )}
        </div>
      </section>
      <div style={{ fontSize: 12, color: "#cbd5e1" }} data-testid="hk-proof-status">
        {twinVerified ? (
          twinCritical ? (
            <span style={{ color: "#fca5a5", fontWeight: 700 }}>⚠️ 伪造拦截：CRITICAL 照片已被系统标记，请重拍真实照片</span>
          ) : (
            <span className="hk-verified">✅ 双拍验真已通过（水印相机存证 + 🔬 鉴真）</span>
          )
        ) : (
          <span>⚠️ 完成双拍后方可验收（红线 4 零信任物理感知）</span>
        )}
      </div>
      {twinVerified && !twinCritical && beforeResult && afterResult && (
        <div className="hk-cap hk-cap-ok" data-testid="hk-sha-chain">
          <div style={{ fontFamily: "ui-monospace, monospace", fontSize: 11, wordBreak: "break-all" }}>
            SHA-256 Before {beforeResult.sha256.slice(0, 12)}… · After {afterResult.sha256.slice(0, 12)}…
          </div>
        </div>
      )}
      {onClaimDamage && (
        <button type="button" className="hk-damage" onClick={onClaimDamage}>
          🛡️ 损坏包赔 · 财产险理赔直连
        </button>
      )}

      {capturing && (
        <div className="hk-proof-modal" data-testid="hk-proof-modal" onClick={() => setCapturing(null)}>
          <div className="hk-proof-sheet" onClick={(e) => e.stopPropagation()}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
              <strong style={{ fontSize: 13, color: "#e2e8f0" }}>📷 {capturing === "before" ? "服务前" : "服务后"} 拍照存证 · 水印相机</strong>
              <button type="button" aria-label="关闭" onClick={() => setCapturing(null)} style={{ color: "#94a3b8", background: "none", border: "none", fontSize: 14, cursor: "pointer" }}>✕</button>
            </div>
            <ProofCamera
              orderNo={orderNo ?? `hk-${capturing}-${Date.now().toString(36)}`}
              geo={geo}
              onCaptured={(result) => handleCaptured(capturing, result)}
            />
          </div>
        </div>
      )}
    </div>
  );
}
