"use client";

import { useEffect, useRef, useState } from "react";
import DarkSheetShell from "@/components/ui/DarkSheetShell";
import DuoButton from "@/components/ui/DuoButton";
import DuoPill, { type DuoPillTone } from "@/components/ui/DuoPill";
import type { AtomicFiveState } from "@/types/ammo-schema";
import { useDragToDismiss } from "@/adapters/ui/useDragToDismiss";
import type { ForgeryRiskLevel } from "@/base/ai/forgery";

/**
 * 争议调解 · AI 小法官半屏抽屉（Dispute & AI Arbitration Sheet · 白皮书 §五 5.6.3）。
 *
 * 漏洞五闭环 · 三级人机双轨仲裁分流（resolveArbitrationLevel 确定性纯函数）：
 * - Level 1（≤30 元 且 无安全告警）：🟢 规则引擎自动秒赔，一键补偿结案，
 *   不扣罚服务者（平台体验保障金出账）；
 * - Level 2（30 < 金额 ≤ 500）：🤖 AI 小法官建议卡（Advisory）+ 人工审核
 *   双出口（接受方案 / 驳回修正升级人工）；
 * - Level 3（>500 元 或 红色报警）：🔴 法务专家组直通，自动切断线上调解，
 *   展示紧急连线安全法务组 + 联动保险公司现场勘查状态卡。
 *
 * 三区组装：
 * 1. 物证比对链 —— 客户投诉诉求 / 履约完工照片（含 AI 视觉标注）/ 关键聊天记录；
 * 2. 分级仲裁区 —— L1 秒赔卡 / L2 AI 建议卡 / L3 法务直连卡（互斥渲染）；
 * 3. 分级出口 —— L1 一键补偿 / L2 双出口 / L3 法务 + 保险联动。
 * 红线 1：分流判定与 L1 秒赔为确定性纯函数，LLM 仅存在于 L2 Advisory。
 *
 * Duo 化（Batch① 2026-09）：暗岛 SHEET_CSS 删除。DarkSheetShell 保留
 * （深色遮罩/z80-81/拖拽离场/Esc/data-action 契约均为行为资产），面板视觉换
 * Duo 白底 + 内层 polar/DuoPill/DuoButton；把手经 arbitrary variant 浅色化。
 * 契约与埋点不变：data-testid/data-action/data-level/data-order/文案全保留。
 */

/** 三级仲裁层级（漏洞五 · 确定性分流结果）。 */
export type ArbitrationLevel = "LEVEL_1" | "LEVEL_2" | "LEVEL_3";

/**
 * 三级仲裁分流判定（确定性纯函数，红线 1）：
 * - 金额 ≤ 30 且无安全告警 → LEVEL_1（小额秒赔）；
 * - 金额 > 500 或 触发安全告警 → LEVEL_3（重大/高危，法务直通）；
 * - 其余（30 < 金额 ≤ 500）→ LEVEL_2（AI + 人工双轨）。
 * 金额未提供（undefined）→ 保守按 LEVEL_2（维持既有行为）。
 */
export function resolveArbitrationLevel(
  disputeAmountYuan: number | undefined,
  hasSafetyAlert = false,
): ArbitrationLevel {
  if (hasSafetyAlert) return "LEVEL_3";
  if (disputeAmountYuan === undefined) return "LEVEL_2";
  if (!Number.isFinite(disputeAmountYuan) || disputeAmountYuan <= 0) return "LEVEL_2";
  if (disputeAmountYuan <= 30) return "LEVEL_1";
  if (disputeAmountYuan > 500) return "LEVEL_3";
  return "LEVEL_2";
}

/** 履约完工照片证据（含 AI 视觉标注）。 */
export interface ArbitrationPhotoEvidence {
  /** 履约方上传的完工照片（URL / 占位标识）。 */
  photo: string;
  /** AI 视觉标注（多模态审图结果，仅 Advisory）。 */
  aiNote: string;
  /** L3-M4 AIGC 深度鉴真报告（物证链展示；可缺省 = 未鉴真）。 */
  forgeryReport?: {
    riskLevel: ForgeryRiskLevel;
    overallConfidence: number;
    tamperFlags: string[];
  };
}

/** 鉴真风险等级 → DuoPill tone + 标签（浅底用 soft 变体）。 */
const FORGERY_RISK_META: Record<ForgeryRiskLevel, { tone: DuoPillTone; label: string }> = {
  LOW: { tone: "green", label: "LOW 可信" },
  MEDIUM: { tone: "yellow", label: "MEDIUM 存疑" },
  HIGH: { tone: "orange", label: "HIGH 嫌疑" },
  CRITICAL: { tone: "red", label: "CRITICAL 伪造" },
};

export interface ArbitrationEvidence {
  /** 客户投诉诉求（原始诉求文本）。 */
  complaint: string;
  /** 履约方陈述（可缺省）。 */
  providerStatement?: string;
  /** 履约完工照片及 AI 视觉标注（可缺省）。 */
  photos?: ArbitrationPhotoEvidence[];
  /** 关键聊天记录（脱敏锚点行）。 */
  chatTranscript?: string[];
}

/** AI 小法官建议卡（L3-M3 · 仅 Advisory）。 */
export interface ArbitrationProposal {
  /** 责任认定：雇方 / 履约方 / 双方按比。 */
  liability: "employer" | "provider" | "split";
  /** 责任认定一句话。 */
  liabilityNote: string;
  /** 建议退款金额（¥，0 = 无需退款）。 */
  refundAmount: number;
  /** 平台补偿券（¥，安抚性补偿）。 */
  compensationCouponYuan: number;
  /** 建议信用扣减（分）。 */
  creditDeduct: number;
  /** 理由链（规则引擎逐条，LLM 失败回落确定性规则）。 */
  reasonChain: string[];
}

export interface ArbitrationSheetProps {
  /** 抽屉开合。 */
  open: boolean;
  /** 争议订单 id。 */
  orderId: string;
  /** 弹药 id（展示场景主题微色）。 */
  ammoId?: string;
  /** 当前五态（展示争议发生窗口）。 */
  currentState?: AtomicFiveState;
  /** 物证比对链。 */
  evidence: ArbitrationEvidence;
  /** AI 小法官建议卡（Advisory；L1/L3 级自动隐藏）。 */
  proposal: ArbitrationProposal;
  /** 双出口 A：接受调解方案（执行退款 + 流转 SETTLED）。 */
  onAcceptProposal: () => void;
  /** 双出口 B：申请人工客服（冻结资金进人工仲裁队列）。 */
  onEscalateManual: () => void;
  /** 关闭抽屉。 */
  onClose: () => void;
  /** 争议金额（¥；驱动三级分流，缺省 = 保守 LEVEL_2）。 */
  disputeAmountYuan?: number;
  /** 红色安全报警（人身安全告警；触发即 LEVEL_3 法务直通）。 */
  hasSafetyAlert?: boolean;
  /** L1 秒赔回调（一键秒级补偿，扣平台体验保障金，不扣罚服务者）。 */
  onInstantCompensate?: () => void;
  /** L3 法务直通回调（紧急连线安全法务组）。 */
  onConnectLegal?: () => void;
}

/** 司法存证包导出状态（api/evidence/export-judicial-package 审计证书）。 */
export interface JudicialCertificate {
  caseInfo?: { disputeId: string; orderId: string };
  hashChain?: {
    chainValid: boolean;
    entries: unknown[];
    /** 方向 1 接线 A③：断点明细（base/safe/evidence-chain 三断因） */
    verification?: {
      brokenAtIndex: number;
      reason: "HASH_MISMATCH" | "PREV_LINK_BREAK" | "TIMESTAMP_REGRESSION" | null;
      brokenId: string | null;
    };
  };
}

/** 链断裂原因 → 人话标签（接线 A③ 红色警示定位）。 */
export const CHAIN_BREAK_REASON_LABEL: Record<string, string> = {
  HASH_MISMATCH: "哈希重算不符（内容疑似被篡改）",
  PREV_LINK_BREAK: "前驱链接断裂（链条被插入/替换）",
  TIMESTAMP_REGRESSION: "时间戳回退（时序异常）",
};

type ExportState = "idle" | "loading" | "done" | "error";

/** Duo 白底面板（把手浅色化；定位/圆角顶沿 bottom-sheet 形态）。 */
const PANEL_CLASS =
  "bg-white border-2 border-[var(--color-duo-swan)] border-b-0 rounded-t-3xl " +
  "max-h-[72vh] overflow-y-auto px-4 pt-2.5 pb-4 text-[13px] text-[var(--color-duo-eel)] " +
  "shadow-[0_-8px_32px_rgba(0,0,0,0.18)] [&_.dsheet-grip]:bg-[var(--color-duo-swan)]";

const SECTION_CLASS =
  "mt-3 p-3 rounded-2xl bg-[var(--color-duo-polar)] border-2 border-[var(--color-duo-swan)]";
const SECTION_TITLE = "m-0 mb-2 text-xs font-extrabold text-[var(--color-duo-hare)]";
const KV_ROW =
  "flex justify-between gap-2 py-1.5 border-b border-dashed border-[var(--color-duo-swan)] last:border-b-0 text-[13px]";

const LIABILITY_LABEL: Record<ArbitrationProposal["liability"], string> = {
  employer: "雇方责任",
  provider: "履约方责任",
  split: "双方按比担责",
};

/** 争议调解半屏抽屉（bottom-sheet 上滑 · 三级人机双轨分流）。 */
export default function ArbitrationSheet({
  open,
  orderId,
  ammoId,
  currentState,
  evidence,
  proposal,
  onAcceptProposal,
  onEscalateManual,
  onClose,
  disputeAmountYuan,
  hasSafetyAlert = false,
  onInstantCompensate,
  onConnectLegal,
}: ArbitrationSheetProps) {
  const [exportState, setExportState] = useState<ExportState>("idle");
  const [certificate, setCertificate] = useState<JudicialCertificate | null>(null);
  const [exportError, setExportError] = useState("");

  /** P2：顶部把手下拉 >35% → 平滑下滑离场 → 关闭（enabled=open 使 open 时重绑把手） */
  const [dismissing, setDismissing] = useState(false);
  const dismissTimerRef = useRef<number | null>(null);
  const { dragRef: gripDragRef } = useDragToDismiss({
    onDismiss: () => {
      if (dismissing) return;
      setDismissing(true);
      dismissTimerRef.current = window.setTimeout(() => {
        dismissTimerRef.current = null;
        setDismissing(false);
        onClose();
      }, 200);
    },
    enabled: open,
  });

  // 重开抽屉时清除残留过渡态与定时器
  useEffect(() => {
    if (open) {
      const reset = async () => {
        await Promise.resolve()
        setDismissing(false)
      }
      reset()
      if (dismissTimerRef.current !== null) {
        window.clearTimeout(dismissTimerRef.current);
        dismissTimerRef.current = null;
      }
    }
  }, [open]);

  useEffect(
    () => () => {
      if (dismissTimerRef.current !== null) window.clearTimeout(dismissTimerRef.current);
    },
    [],
  );

  const level = resolveArbitrationLevel(disputeAmountYuan, hasSafetyAlert);
  const isLevel1 = level === "LEVEL_1";
  const isLevel2 = level === "LEVEL_2";
  const isLevel3 = level === "LEVEL_3";

  const handleExportJudicial = async () => {
    setExportState("loading");
    setExportError("");
    try {
      const res = await fetch(
        `/api/evidence/export-judicial-package?disputeId=${encodeURIComponent(orderId)}`,
      );
      const body = await res.json();
      if (!res.ok || !body.success) {
        setExportError(body.error ?? "司法存证包导出失败");
        setExportState("error");
        return;
      }
      setCertificate(body.judicialPackage as JudicialCertificate);
      setExportState("done");
    } catch {
      setExportError("网络异常：司法存证包导出失败，请稍后重试");
      setExportState("error");
    }
  };

  // 接线 A③：抽屉打开即自动锚定司法证据链（每次开合至多一次）
  const autoAnchorRef = useRef(false);
  useEffect(() => {
    if (open && !autoAnchorRef.current) {
      autoAnchorRef.current = true;
      void handleExportJudicial();
    }
    if (!open) autoAnchorRef.current = false;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  if (!open) return null;

  const chainBroken = exportState === "done" && !certificate?.hashChain?.chainValid;

  return (
    <div data-testid="arbitration-sheet" data-order={orderId}>
      <DarkSheetShell
        onClose={onClose}
        maskZ={80}
        panelZ={81}
        panelClass={PANEL_CLASS}
        dismissing={dismissing}
        gripRef={gripDragRef as React.Ref<HTMLDivElement>}
        ariaLabel="争议调解"
        panelTestId="arbitration-panel"
      >

        <div className="flex items-center justify-between gap-2 text-[15px] font-extrabold">
          <span className="flex flex-wrap items-center gap-1.5">
            🧑‍⚖️ 争议调解 · 小法官
            {isLevel3 && (
              <DuoPill tone="red" variant="solid">🔴 Level 3 法务直通</DuoPill>
            )}
            {isLevel1 && (
              <DuoPill tone="green" variant="solid">🟢 Level 1 极小额</DuoPill>
            )}
            {!isLevel1 && !isLevel3 && (
              <DuoPill tone="yellow" variant="solid">🟡 Level 2 双轨</DuoPill>
            )}
            {currentState ? (
              <DuoPill tone="neutral" variant="soft">争议窗口 {currentState}</DuoPill>
            ) : null}
            {ammoId ? (
              <DuoPill tone="neutral" variant="soft">弹药 {ammoId}</DuoPill>
            ) : null}
          </span>
          <DuoButton variant="ghost" size="sm" data-action="close" onClick={onClose} className="shrink-0">
            ✕ 关闭
          </DuoButton>
        </div>

        {/* 接线 A③：司法证据链常驻锚定徽标（打开即校验，断裂显式定位） */}
        <div
          data-testid="chain-anchor"
          data-state={exportState}
          className={`mt-2 flex w-full items-center justify-center rounded-xl border-2 px-2.5 py-1.5 text-xs font-bold ${
            chainBroken
              ? "bg-[var(--color-duo-red-mist)] border-[var(--color-duo-red)]/40 text-[var(--color-duo-red-dark)]"
              : exportState === "done"
                ? "bg-[var(--color-duo-green)]/10 border-[var(--color-duo-green-dark)]/50 text-[var(--color-duo-green-ink)]"
                : "bg-[var(--color-duo-polar)] border-[var(--color-duo-swan)] text-[var(--color-duo-wolf)]"
          }`}
        >
          {exportState === "loading" && "🛡️ 司法证据链校验中…"}
          {exportState === "idle" && "🛡️ 司法证据链待锚定"}
          {exportState === "error" && "🛡️ 存证链暂不可达（可手动重试导出）"}
          {exportState === "done" &&
            (certificate?.hashChain?.chainValid ? (
              <>🛡️ 司法证据链已锚定（{certificate.hashChain.entries.length} 环连续 · 校验通过）</>
            ) : (
              <>
                ⚠️ 证据链断裂：
                {CHAIN_BREAK_REASON_LABEL[certificate?.hashChain?.verification?.reason ?? ""] ??
                  "未知原因"}
                {certificate?.hashChain?.verification &&
                  certificate.hashChain.verification.brokenAtIndex >= 0 &&
                  ` · 断点 #${certificate.hashChain.verification.brokenAtIndex}`}
              </>
            ))}
        </div>

        {/* 分级仲裁头卡（漏洞五 · 确定性分流） */}
        <div
          data-level={level}
          data-amount={disputeAmountYuan ?? ""}
          className={`mt-3 px-3.5 py-3 rounded-2xl border-2 text-xs leading-relaxed ${
            isLevel1
              ? "bg-[var(--color-duo-green)]/10 border-[var(--color-duo-green-dark)]/50"
              : isLevel3
                ? "bg-[var(--color-duo-red-mist)] border-[var(--color-duo-red)]/40"
                : "bg-[var(--color-duo-polar)] border-[var(--color-duo-swan)]"
          }`}
        >
          {isLevel1 && (
            <>
              <div className="text-[13px] font-extrabold text-[var(--color-duo-eel)]">🟢 Level 1 极小额争议 · 规则引擎自动秒赔</div>
              <div className="mt-1 text-xs text-[var(--color-duo-wolf)]">
                争议金额 ¥{disputeAmountYuan} ≤ 30 元且无安全告警——符合小额速赔规则，
                由平台体验保障金直接补偿，不扣罚服务者信用与收入。
              </div>
            </>
          )}
          {isLevel3 && (
            <>
              <div className="text-[13px] font-extrabold text-[var(--color-duo-eel)]">🔴 Level 3 重大争议/人身安全警报 · 已切入法务专家组</div>
              <div className="mt-1 text-xs text-[var(--color-duo-wolf)]">
                {hasSafetyAlert
                  ? "检测到人身安全红色告警——线上调解自动切断，由安全法务组接管取证与处置。"
                  : `争议金额 ¥${disputeAmountYuan} > 500 元——超出线上调解额度，转入法务专家组审理。`}
              </div>
            </>
          )}
          {!isLevel1 && !isLevel3 && (
            <>
              <div className="text-[13px] font-extrabold text-[var(--color-duo-eel)]">🟡 Level 2 中额争议 · AI + 人工双轨</div>
              <div className="mt-1 text-xs text-[var(--color-duo-wolf)]">
                金额 {disputeAmountYuan === undefined ? "未知" : `¥${disputeAmountYuan}`}
                落在 30~500 元区间——AI 建议书先行，人工审核员复核双出口。
              </div>
            </>
          )}
        </div>

        {/* ① 物证比对链 */}
        <section className={SECTION_CLASS} data-testid="evidence-chain">
          <h4 className={SECTION_TITLE}>📋 物证比对链 · 数据湖存证锚点</h4>
          <div className="text-[13px] font-bold leading-relaxed text-[var(--color-duo-eel)]" data-testid="evidence-complaint">
            🙋 {evidence.complaint}
          </div>
          {evidence.providerStatement && (
            <div className="mt-2 text-[13px] font-bold leading-relaxed text-[var(--color-duo-blue-ink)]" data-testid="evidence-statement">
              🧑‍🔧 履约方陈述：{evidence.providerStatement}
            </div>
          )}
          {evidence.photos && evidence.photos.length > 0 && (
            <div className="mt-2.5 flex flex-col gap-2">
              {evidence.photos.map((p, i) => (
                <div key={i} className="flex items-start gap-2.5 rounded-xl border-2 border-dashed border-[var(--color-duo-swan)] bg-white p-2" data-testid="evidence-photo">
                  <div className="flex h-[52px] w-[52px] shrink-0 items-center justify-center rounded-xl bg-[var(--color-duo-polar)] border-2 border-[var(--color-duo-swan)] text-xl">🖼️</div>
                  <div className="min-w-0">
                    <div className="text-xs text-[var(--color-duo-wolf)]">完工照片 {i + 1} · 哈希锚点</div>
                    <div className="text-xs font-bold text-[var(--color-duo-blue-ink)]">🤖 AI 视觉标注：{p.aiNote}</div>
                    {p.forgeryReport ? (
                      <div data-testid="photo-forgery">
                        <DuoPill
                          tone={FORGERY_RISK_META[p.forgeryReport.riskLevel].tone}
                          variant="soft"
                          testId="forgery-risk"
                          className="mt-1.5"
                        >
                          🔬 AIGC 鉴真 {Math.round(p.forgeryReport.overallConfidence * 100)}% ·{" "}
                          {FORGERY_RISK_META[p.forgeryReport.riskLevel].label}
                        </DuoPill>
                        {p.forgeryReport.tamperFlags.length > 0 && (
                          <div className="mt-1 text-xs text-[var(--color-duo-wolf)]">
                            疑点标签：{p.forgeryReport.tamperFlags.join("、")}
                          </div>
                        )}
                      </div>
                    ) : null}
                  </div>
                </div>
              ))}
            </div>
          )}
          {evidence.chatTranscript && evidence.chatTranscript.length > 0 && (
            <div className="mt-2.5" data-testid="evidence-chat">
              {evidence.chatTranscript.map((line, i) => (
                <div key={i} className="border-b border-dashed border-[var(--color-duo-swan)] py-1.5 text-xs leading-relaxed text-[var(--color-duo-wolf)] last:border-b-0">
                  💬 {line}
                </div>
              ))}
            </div>
          )}

          {/* 司法存证包导出（L2 证据链 → 司法级 SHA-256 审计证书） */}
          <div className="mt-3">
            <DuoButton
              variant="outline"
              fullWidth
              data-action="export-judicial"
              onClick={handleExportJudicial}
              disabled={exportState === "loading"}
            >
              {exportState === "loading" ? "⏳ 打包存证链…" : "📦 导出司法级存证包"}
            </DuoButton>
            {exportState === "error" && (
              <div className="mt-2 text-[13px] font-bold text-[var(--color-duo-red-dark)]" data-testid="export-error">
                ⚠️ {exportError}
              </div>
            )}
            {exportState === "done" && certificate?.hashChain && (
              <div className={`${SECTION_CLASS} bg-white`} data-testid="judicial-certificate">
                <DuoPill tone="neutral" variant="soft">🔐 SHA-256 审计证书 · 司法级</DuoPill>
                <div className={KV_ROW}>
                  <span className="text-[var(--color-duo-wolf)]">存证链校验</span>
                  <strong className={certificate.hashChain.chainValid ? "text-[var(--color-duo-green-ink)]" : "text-[var(--color-duo-red-dark)]"}>
                    {certificate.hashChain.chainValid ? "链完整 · 未被篡改" : "链断裂 · 需人工复核"}
                  </strong>
                </div>
                <div className={KV_ROW}>
                  <span className="text-[var(--color-duo-wolf)]">证据锚点数</span>
                  <strong className="text-[var(--color-duo-eel)]">{certificate.hashChain.entries.length} 条</strong>
                </div>
                {certificate.hashChain.entries.length > 0 && (
                  <div className="mt-1.5 text-xs text-[var(--color-duo-wolf)]" style={{ wordBreak: "break-all" }}>
                    📜 链首哈希：{String((certificate.hashChain.entries[0] as { hash?: string }).hash ?? "-").slice(0, 24)}…
                  </div>
                )}
              </div>
            )}
          </div>
        </section>

        {/* ② 分级仲裁区：L2 = AI 小法官建议卡（Advisory）；L1/L3 自动切断线上调解 */}
        {isLevel2 ? (
          <section className={`${SECTION_CLASS} bg-white`} data-testid="ai-proposal-card">
            <DuoPill tone="blue" variant="soft">🤖 AI 小法官裁定 · 仅 Advisory（红线 1）</DuoPill>
            <div className={KV_ROW}>
              <span className="text-[var(--color-duo-wolf)]">责任认定</span>
              <strong className="text-[var(--color-duo-eel)]" data-testid="proposal-liability">{LIABILITY_LABEL[proposal.liability]}</strong>
            </div>
            <div className={KV_ROW}>
              <span className="text-[var(--color-duo-wolf)]">责任说明</span>
              <span className="text-right text-[var(--color-duo-eel)]">{proposal.liabilityNote}</span>
            </div>
            <div className={KV_ROW}>
              <span className="text-[var(--color-duo-wolf)]">建议退款</span>
              <span className="text-[17px] font-black text-[var(--color-duo-red-dark)]" data-testid="proposal-refund">
                ¥{proposal.refundAmount.toFixed(proposal.refundAmount % 1 ? 2 : 0)}
              </span>
            </div>
            <div className={KV_ROW}>
              <span className="text-[var(--color-duo-wolf)]">平台补偿券</span>
              <strong className="text-[var(--color-duo-yellow-ink)]" data-testid="proposal-coupon">
                ¥{proposal.compensationCouponYuan}
              </strong>
            </div>
            <div className={KV_ROW}>
              <span className="text-[var(--color-duo-wolf)]">信用扣减</span>
              <strong className="text-[var(--color-duo-red-dark)]" data-testid="proposal-credit">
                -{proposal.creditDeduct} 分
              </strong>
            </div>
            <div className="mt-1.5 text-xs text-[var(--color-duo-wolf)]">📐 理由链（LLM 失败回落确定性规则）：</div>
            <ul className="mt-1.5 list-disc space-y-1 pl-3 text-xs leading-relaxed text-[var(--color-duo-blue-ink)]" data-testid="proposal-reasons">
              {proposal.reasonChain.map((r, i) => (
                <li key={i}>{r}</li>
              ))}
            </ul>
          </section>
        ) : isLevel1 ? (
          <section className={`${SECTION_CLASS} bg-[var(--color-duo-green)]/10 border-[var(--color-duo-green-dark)]/50`} data-testid="instant-compensate-card">
            <DuoPill tone="green" variant="solid">⚡ 规则引擎秒赔 · 确定性规则（红线 1）</DuoPill>
            <div className={KV_ROW}>
              <span className="text-[var(--color-duo-wolf)]">争议金额</span>
              <span className="text-[17px] font-black text-[var(--color-duo-green-ink)]" data-testid="instant-amount">
                ¥{disputeAmountYuan}
              </span>
            </div>
            <div className={KV_ROW}>
              <span className="text-[var(--color-duo-wolf)]">赔付来源</span>
              <strong className="text-[var(--color-duo-yellow-ink)]">平台体验保障金（不扣罚服务者）</strong>
            </div>
            <div className={KV_ROW}>
              <span className="text-[var(--color-duo-wolf)]">服务者处置</span>
              <strong className="text-[var(--color-duo-green-ink)]">零扣罚 · 零信用减分 · 即时结案</strong>
            </div>
          </section>
        ) : (
          <section className={`${SECTION_CLASS} bg-[var(--color-duo-red-mist)] border-[var(--color-duo-red)]/40`} data-testid="legal-direct-card">
            <DuoPill tone="red" variant="solid">⚖️ 法务专家组接管 · 线上调解已切断</DuoPill>
            <div className="mt-2.5 flex items-center gap-2.5 rounded-xl border-2 border-[var(--color-duo-swan)] bg-white p-2.5" data-testid="legal-connect-card">
              <span className="relative flex h-2.5 w-2.5 shrink-0">
                <span className="absolute inline-flex h-full w-full rounded-full bg-[var(--color-duo-red)] opacity-75 motion-safe:animate-ping" />
                <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-[var(--color-duo-red)]" />
              </span>
              <div>
                <strong className="text-xs text-[var(--color-duo-eel)]">紧急连线安全法务组</strong>
                <div className="mt-0.5 text-xs text-[var(--color-duo-wolf)]">
                  法务专家在线值班中 · 平均响应 &lt; 5 分钟
                </div>
              </div>
            </div>
            <div className="mt-2.5 flex items-center gap-2.5 rounded-xl border-2 border-[var(--color-duo-swan)] bg-white p-2.5" data-testid="legal-insurance-card">
              <span className="shrink-0">🛡️</span>
              <div>
                <strong className="text-xs text-[var(--color-duo-eel)]">联动保险公司现场勘查</strong>
                <div className="mt-0.5 text-xs text-[var(--color-duo-wolf)]">
                  定损理赔通道已预置 · 勘查员调度中
                </div>
              </div>
            </div>
          </section>
        )}

        {/* ③ 分级出口：L2 隔离墙双出口 / L1 一键秒赔 / L3 法务直连 */}
        {isLevel1 ? (
          <div className="mt-3.5 flex gap-2.5">
            <DuoButton
              variant="primary"
              fullWidth
              data-action="instant-compensate"
              onClick={onInstantCompensate}
            >
              ⚡ 一键秒级补偿（扣除平台体验保障金）
            </DuoButton>
          </div>
        ) : isLevel3 ? (
          <div className="mt-3.5 flex gap-2.5">
            <DuoButton
              variant="danger"
              fullWidth
              data-action="connect-legal"
              onClick={onConnectLegal}
            >
              🚨 紧急连线安全法务组
            </DuoButton>
          </div>
        ) : (
          <div className="mt-3.5 flex gap-2.5">
            <DuoButton
              variant="primary"
              data-action="accept-proposal"
              onClick={onAcceptProposal}
              className="flex-1"
            >
              🤝 接受调解方案
            </DuoButton>
            <DuoButton
              variant="outline"
              data-action="escalate-manual"
              onClick={onEscalateManual}
              className="flex-1"
            >
              🧑‍⚖️ 申请人工客服
            </DuoButton>
          </div>
        )}
      </DarkSheetShell>
    </div>
  );
}
