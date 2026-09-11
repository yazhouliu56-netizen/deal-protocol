"use client";

import Image from "next/image";
import { useState } from "react";
import type { INormalizedCustomIntent } from "@/types/ammo-schema";
import ProofCamera, { type IProofCaptureResult } from "@/components/oto-ui/controls/ProofCamera";
import DuoButton from "@/components/ui/DuoButton";
import DuoCardShell from "@/components/ui/DuoCardShell";
import DuoPill, { type DuoPillTone } from "@/components/ui/DuoPill";

/**
 * 家政保洁特化插槽（Housekeeping Slot · 清洁蓝 theme-housekeeping）。
 *
 * 白皮书 §五 5.7 对比矩阵 · 家政列：
 * - 履约核心：现场增项改价确认单（OnsiteQuoteHook 的 UI 形态）+ Before/After 双拍照片池；
 * - 核销完工：双方碰一碰 NFC / 雇主验收清单打钩（由 FulfillmentCockpit 底部 CTA 承载）；
 * - 争议售后：损坏包赔（财产险理赔直连，IMPACT 引信 propertyInsurance 投影）。
 * 自包含 CSS（外骨骼零改动，差异全收敛插槽区，红线 2）。
 * P0-3/P1-1 全链：原生相机直拍 ➔ 水印压制 ➔ SHA-256 ➔ 五信号快筛 ➔ 存证载荷结构化入账。
 *
 * Duo 化（Batch① 2026-09，Companion 先例）：清洁蓝暗岛 `<style>` 去除，白底
 * DuoCardShell + DuoButton/DuoPill；场景身份由父级 data-theme="housekeeping" 承载。
 * 确认增项/拍照打卡收敛 primary/secondary，拒绝对 outline，损坏包赔 danger；
 * 照片鉴真徽标用 DuoPill dark（深底 overlay 专用）。
 * 逻辑与埋点不变：props/state/ProofCamera 接线 + data-slot/testid/action 全保留。
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

/** 鉴真风险等级 → DuoPill tone（照片 overlay 用 dark 变体）。 */
function forgeryTone(level: string): DuoPillTone {
  switch (level) {
    case "MEDIUM":
      return "yellow";
    case "HIGH":
      return "orange";
    case "CRITICAL":
      return "red";
    case "LOW":
    default:
      return "green";
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
  // 拍照存证单号：开启拍照的事件回调里生成（render 期禁止 Date.now，React Compiler purity）。
  const [captureNo, setCaptureNo] = useState<string | null>(null);
  const openCapture = (phase: "before" | "after") => {
    setCapturing(phase);
    // eslint-disable-next-line react-hooks/purity -- 事件回调内生成拍照单号（用户手势时序），render 输出保持纯
    setCaptureNo(orderNo ?? `hk-${phase}-${Date.now().toString(36)}`);
  };
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

  const photoCell = (
    phase: "before" | "after",
    display: string | null,
    result: IProofCaptureResult | null,
    emptyLabel: string,
    forgeryTestId: string
  ) => (
    <div
      className="relative flex flex-col items-center justify-center gap-1.5 overflow-hidden rounded-xl border-2 border-dashed border-[var(--color-duo-swan)] bg-[var(--color-duo-polar)] text-xs font-bold text-[var(--color-duo-wolf)]"
      style={{ aspectRatio: "4/3" }}
      data-photo={phase}
    >
      {display ? (
        <>
          <Image src={display} alt={phase === "before" ? "服务前照片" : "服务后照片"} fill sizes="50vw" style={{ objectFit: "cover" }} />
          {result && (
            <DuoPill
              tone={forgeryTone(result.forgeryReport.riskLevel)}
              variant="dark"
              testId={forgeryTestId}
              className="absolute bottom-1.5 left-1.5 right-1.5 justify-center text-xs"
            >
              🔬 {Math.round(result.forgeryReport.overallConfidence * 100)}% · {result.forgeryReport.riskLevel}
            </DuoPill>
          )}
        </>
      ) : (
        <>
          <span>{emptyLabel}</span>
          <DuoButton
            size="sm"
            variant="secondary"
            data-action={phase === "before" ? "hk-proof-before" : "hk-proof-after"}
            onClick={() => openCapture(phase)}
          >
            拍照打卡
          </DuoButton>
        </>
      )}
    </div>
  );

  return (
    <DuoCardShell
      className="p-3.5 space-y-2.5"
      dataAttrs={{ "data-slot": "housekeeping" }}
    >
      {customTags.length > 0 && (
        <section className="flex flex-wrap gap-1.5" data-testid="hk-custom-requirements" data-custom-requirements>
          {customTags.map((tag) => (
            <DuoPill key={tag} tone="neutral" variant="soft" dataAttrs={{ "data-custom-tag": "" }}>
              {tag}
            </DuoPill>
          ))}
        </section>
      )}
      {hasBase && capYuan !== null && (
        <section
          data-cap-meta
          className={`rounded-xl border-2 px-2.5 py-1.5 text-xs font-bold leading-relaxed ${
            overCap
              ? "bg-[var(--color-duo-red-mist)] border-[var(--color-duo-red)]/40 text-[var(--color-duo-red-dark)]"
              : quote
                ? "bg-[var(--color-duo-green)]/10 border-[var(--color-duo-green-dark)]/50 text-[var(--color-duo-green-ink)]"
                : "bg-[var(--color-duo-polar)] border-[var(--color-duo-swan)] text-[var(--color-duo-wolf)]"
          }`}
        >
          {overCap
            ? `⚠️ 增项 +¥${quote.amountYuan} 超过上限 ¥${capYuan}（基础金额 ${maxSurchargeRatio * 100}%）——超出部分需双方重新确认，防坐地起价`
            : `🛡️ 现场加价上限为订单基础金额的 ${maxSurchargeRatio * 100}%（¥${capYuan}），超限增项将拦截（防坐地起价）`}
        </section>
      )}
      {quote && (
        <section className="flex items-center justify-between gap-2 rounded-2xl bg-[var(--color-duo-polar)] border-2 border-[var(--color-duo-swan)] px-3 py-2">
          <div>
            <strong className="text-sm font-extrabold text-[var(--color-duo-eel)]">
              现场增项：{quote.item}
            </strong>
            <div className="text-sm font-extrabold text-[var(--color-duo-yellow-ink)]">
              +¥{quote.amountYuan}
            </div>
          </div>
          <div className="flex shrink-0 gap-1.5">
            {quote.confirmed ? (
              <span className="text-xs font-bold text-[var(--color-duo-green-ink)]">已确认 ✓</span>
            ) : (
              <>
                <DuoButton size="sm" variant="primary" onClick={onAcceptQuote}>
                  确认增项
                </DuoButton>
                <DuoButton size="sm" variant="outline" onClick={onRejectQuote}>
                  拒绝
                </DuoButton>
              </>
            )}
          </div>
        </section>
      )}
      <section className="grid grid-cols-2 gap-2" data-testid="hk-photos">
        {photoCell("before", beforeDisplay, beforeResult, "📷 Before 待拍摄", "hk-before-forgery")}
        {photoCell("after", afterDisplay, afterResult, "📷 After 待拍摄", "hk-after-forgery")}
      </section>
      <div className="text-xs text-[var(--color-duo-wolf)]" data-testid="hk-proof-status">
        {twinVerified ? (
          twinCritical ? (
            <span className="font-bold text-[var(--color-duo-red-dark)]">⚠️ 伪造拦截：CRITICAL 照片已被系统标记，请重拍真实照片</span>
          ) : (
            <span className="font-bold text-[var(--color-duo-green-ink)]">✅ 双拍验真已通过（水印相机存证 + 🔬 鉴真）</span>
          )
        ) : (
          <span>⚠️ 完成双拍后方可验收（红线 4 零信任物理感知）</span>
        )}
      </div>
      {twinVerified && !twinCritical && beforeResult && afterResult && (
        <div
          data-testid="hk-sha-chain"
          className="rounded-xl border-2 border-[var(--color-duo-green-dark)]/50 bg-[var(--color-duo-green)]/10 px-2.5 py-1.5"
        >
          <div className="text-[11px] text-[var(--color-duo-green-ink)]" style={{ fontFamily: "ui-monospace, monospace", wordBreak: "break-all" }}>
            SHA-256 Before {beforeResult.sha256.slice(0, 12)}… · After {afterResult.sha256.slice(0, 12)}…
          </div>
        </div>
      )}
      {onClaimDamage && (
        <DuoButton variant="danger" fullWidth onClick={onClaimDamage}>
          🛡️ 损坏包赔 · 财产险理赔直连
        </DuoButton>
      )}

      {capturing && (
        <div
          data-testid="hk-proof-modal"
          onClick={() => setCapturing(null)}
          className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 p-4"
          style={{ backdropFilter: "blur(4px)" }}
        >
          <div onClick={(e) => e.stopPropagation()} className="w-full max-w-[420px] overflow-auto rounded-3xl border-2 border-[var(--color-duo-swan)] bg-white p-3.5" style={{ maxHeight: "88vh" }}>
            <div className="mb-2 flex items-center justify-between">
              <strong className="text-[13px] text-[var(--color-duo-eel)]">📷 {capturing === "before" ? "服务前" : "服务后"} 拍照存证 · 水印相机</strong>
              <button type="button" aria-label="关闭" onClick={() => setCapturing(null)} className="cursor-pointer border-none bg-none text-sm text-[var(--color-duo-hare)]">✕</button>
            </div>
            <ProofCamera
              orderNo={captureNo ?? `hk-${capturing}`}
              geo={geo}
              onCaptured={(result) => handleCaptured(capturing, result)}
            />
          </div>
        </div>
      )}
    </DuoCardShell>
  );
}
