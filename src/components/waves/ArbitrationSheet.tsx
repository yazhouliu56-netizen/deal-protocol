"use client";

import { useEffect, useRef, useState } from "react";
import type { AtomicFiveState } from "@/types/ammo-schema";
import { useDragToDismiss } from "@/base/platform/useDragToDismiss";

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
}

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
  hashChain?: { chainValid: boolean; entries: unknown[] };
}

type ExportState = "idle" | "loading" | "done" | "error";

const SHEET_CSS = `
.arb-mask{position:fixed;inset:0;background:rgba(5,6,15,.62);backdrop-filter:blur(4px);z-index:80}
.arb-sheet{position:fixed;inset-inline:0;bottom:0;z-index:81;max-width:520px;margin:0 auto;
  background:linear-gradient(180deg,rgba(23,26,46,.96),rgba(13,16,32,.98));
  border-radius:24px 24px 0 0;border:1px solid rgba(255,255,255,.14);border-bottom:none;
  max-height:72vh;overflow-y:auto;padding:10px 16px 18px;color:#e2e8f0;font-size:13px;
  transition:transform .2s cubic-bezier(.16,1,.3,1),opacity .2s cubic-bezier(.16,1,.3,1)}
.arb-sheet-dismissing{transform:translateY(105%);opacity:0}
.arb-grip{width:44px;height:4px;border-radius:999px;background:rgba(255,255,255,.25);margin:4px auto 10px;cursor:grab;touch-action:none}
.arb-title{display:flex;justify-content:space-between;align-items:center;font-size:15px;font-weight:800}
.arb-close{border:none;background:rgba(255,255,255,.08);color:#cbd5e1;border-radius:10px;padding:4px 10px;
  font-size:11px;cursor:pointer}
.arb-section{margin-top:12px;padding:12px;border-radius:16px;background:rgba(255,255,255,.05);
  border:1px solid rgba(255,255,255,.1)}
.arb-section h4{margin:0 0 8px;font-size:12px;color:#94a3b8}
.arb-quote{font-size:13px;line-height:1.6;color:#f8fafc}
.arb-photo{display:flex;gap:10px;align-items:flex-start;padding:8px 10px;border-radius:12px;
  background:rgba(255,255,255,.05);border:1px dashed rgba(255,255,255,.16)}
.arb-photo-thumb{width:52px;height:52px;border-radius:10px;background:rgba(123,97,255,.22);
  display:flex;align-items:center;justify-content:center;font-size:20px;flex-shrink:0}
.arb-photo-ai{font-size:11px;color:#a5b4fc;line-height:1.5}
.arb-chat{font-size:11.5px;color:#cbd5e1;line-height:1.7;padding:6px 0;border-bottom:1px dashed rgba(255,255,255,.08)}
.arb-chat:last-child{border-bottom:none}
.arb-ai-card{margin-top:12px;padding:14px;border-radius:16px;
  background:linear-gradient(135deg,rgba(123,97,255,.16),rgba(0,240,255,.06));
  border:1px solid rgba(123,97,255,.4)}
.arb-ai-badge{display:inline-flex;align-items:center;gap:6px;font-size:10.5px;font-weight:800;
  color:#c4b5fd;padding:3px 9px;border-radius:999px;background:rgba(123,97,255,.18);
  border:1px solid rgba(123,97,255,.45)}
.arb-ai-row{display:flex;justify-content:space-between;padding:6px 0;border-bottom:1px dashed rgba(255,255,255,.1)}
.arb-ai-row:last-of-type{border-bottom:none}
.arb-ai-refund{font-size:17px;font-weight:900;color:#fca5a5}
.arb-ai-note{font-size:11px;color:#94a3b8;margin-top:6px}
.arb-reason{font-size:11px;color:#a5b4fc;line-height:1.6;margin-top:6px;padding-left:12px}
.arb-actions{display:flex;gap:10px;margin-top:14px}
.arb-btn{flex:1;padding:13px 0;border-radius:16px;border:none;font-size:14px;font-weight:800;cursor:pointer;
  transition:transform .15s,filter .15s}
.arb-btn:active{transform:scale(.98)}
.arb-btn-accept{background:linear-gradient(135deg,#4ade80,#16a34a);color:#04120a}
.arb-btn-escalate{background:linear-gradient(135deg,#f59e0b,#ef4444);color:#1a0b02}
.arb-level{margin-top:12px;padding:12px 14px;border-radius:16px;font-size:12px;line-height:1.6}
.arb-level-1{background:linear-gradient(135deg,rgba(74,222,128,.14),rgba(34,197,94,.05));
  border:1px solid rgba(74,222,128,.4)}
.arb-level-3{background:linear-gradient(135deg,rgba(248,113,113,.16),rgba(220,38,38,.06));
  border:1px solid rgba(248,113,113,.5)}
.arb-level-title{font-size:13px;font-weight:800}
.arb-level-note{font-size:11px;color:#94a3b8;margin-top:4px}
.arb-law-card{margin-top:10px;padding:11px 13px;border-radius:14px;font-size:11.5px;
  display:flex;align-items:center;gap:10px;border:1px solid rgba(255,255,255,.14);
  background:rgba(255,255,255,.06)}
.arb-law-card strong{font-size:12px}
.arb-law-pulse{width:9px;height:9px;border-radius:50%;background:#ef4444;
  animation:law-pulse 1.2s ease-in-out infinite;flex-shrink:0}
@keyframes law-pulse{0%,100%{box-shadow:0 0 0 0 rgba(239,68,68,.5);opacity:.8}
  50%{box-shadow:0 0 0 6px rgba(239,68,68,0);opacity:1}}
`;

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
      setDismissing(false);
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

  if (!open) return null;

  return (
    <div data-testid="arbitration-sheet" data-order={orderId}>
      <style>{SHEET_CSS}</style>
      <div className="arb-mask" onClick={onClose} data-action="mask" />
      <div
        className={`arb-sheet${dismissing ? " arb-sheet-dismissing" : ""}`}
        role="dialog"
        aria-label="争议调解"
      >
        <div className="arb-grip" ref={gripDragRef as React.Ref<HTMLDivElement>} data-action="drag-grip" />

        <div className="arb-title">
          <span>
            🧑‍⚖️ 争议调解 · 小法官
            {isLevel3 && (
              <span className="arb-ai-badge" style={{ marginLeft: 6, color: "#fca5a5" }}>
                🔴 Level 3 法务直通
              </span>
            )}
            {isLevel1 && (
              <span className="arb-ai-badge" style={{ marginLeft: 6, color: "#4ade80" }}>
                🟢 Level 1 极小额
              </span>
            )}
            {!isLevel1 && !isLevel3 && (
              <span className="arb-ai-badge" style={{ marginLeft: 6 }}>
                🟡 Level 2 双轨
              </span>
            )}
            {currentState ? (
              <span className="arb-ai-badge" style={{ marginLeft: 6 }}>
                争议窗口 {currentState}
              </span>
            ) : null}
            {ammoId ? (
              <span className="arb-ai-badge" style={{ marginLeft: 6 }}>
                弹药 {ammoId}
              </span>
            ) : null}
          </span>
          <button type="button" className="arb-close" data-action="close" onClick={onClose}>
            ✕ 关闭
          </button>
        </div>

        {/* 分级仲裁头卡（漏洞五 · 确定性分流） */}
        <div
          className={`arb-level ${isLevel1 ? "arb-level-1" : isLevel3 ? "arb-level-3" : ""}`}
          data-level={level}
          data-amount={disputeAmountYuan ?? ""}
        >
          {isLevel1 && (
            <>
              <div className="arb-level-title">🟢 Level 1 极小额争议 · 规则引擎自动秒赔</div>
              <div className="arb-level-note">
                争议金额 ¥{disputeAmountYuan} ≤ 30 元且无安全告警——符合小额速赔规则，
                由平台体验保障金直接补偿，不扣罚服务者信用与收入。
              </div>
            </>
          )}
          {isLevel3 && (
            <>
              <div className="arb-level-title">🔴 Level 3 重大争议/人身安全警报 · 已切入法务专家组</div>
              <div className="arb-level-note">
                {hasSafetyAlert
                  ? "检测到人身安全红色告警——线上调解自动切断，由安全法务组接管取证与处置。"
                  : `争议金额 ¥${disputeAmountYuan} > 500 元——超出线上调解额度，转入法务专家组审理。`}
              </div>
            </>
          )}
          {!isLevel1 && !isLevel3 && (
            <>
              <div className="arb-level-title">🟡 Level 2 中额争议 · AI + 人工双轨</div>
              <div className="arb-level-note">
                金额 {disputeAmountYuan === undefined ? "未知" : `¥${disputeAmountYuan}`}
                落在 30~500 元区间——AI 建议书先行，人工审核员复核双出口。
              </div>
            </>
          )}
        </div>

        {/* ① 物证比对链 */}
        <section className="arb-section" data-testid="evidence-chain">
          <h4>📋 物证比对链 · 数据湖存证锚点</h4>
          <div className="arb-quote" data-testid="evidence-complaint">
            🙋 {evidence.complaint}
          </div>
          {evidence.providerStatement && (
            <div className="arb-quote" style={{ color: "#93c5fd", marginTop: 8 }} data-testid="evidence-statement">
              🧑‍🔧 履约方陈述：{evidence.providerStatement}
            </div>
          )}
          {evidence.photos && evidence.photos.length > 0 && (
            <div style={{ display: "flex", flexDirection: "column", gap: 8, marginTop: 10 }}>
              {evidence.photos.map((p, i) => (
                <div key={i} className="arb-photo" data-testid="evidence-photo">
                  <div className="arb-photo-thumb">🖼️</div>
                  <div>
                    <div style={{ fontSize: 11, color: "#94a3b8" }}>完工照片 {i + 1} · 哈希锚点</div>
                    <div className="arb-photo-ai">🤖 AI 视觉标注：{p.aiNote}</div>
                  </div>
                </div>
              ))}
            </div>
          )}
          {evidence.chatTranscript && evidence.chatTranscript.length > 0 && (
            <div style={{ marginTop: 10 }} data-testid="evidence-chat">
              {evidence.chatTranscript.map((line, i) => (
                <div key={i} className="arb-chat">
                  💬 {line}
                </div>
              ))}
            </div>
          )}

          {/* 司法存证包导出（L2 证据链 → 司法级 SHA-256 审计证书） */}
          <div style={{ marginTop: 12 }}>
            <button
              type="button"
              className="arb-btn arb-btn-escalate"
              data-action="export-judicial"
              onClick={handleExportJudicial}
              disabled={exportState === "loading"}
            >
              {exportState === "loading" ? "⏳ 打包存证链…" : "📦 导出司法级存证包"}
            </button>
            {exportState === "error" && (
              <div className="arb-quote" style={{ marginTop: 8, color: "#fca5a5" }} data-testid="export-error">
                ⚠️ {exportError}
              </div>
            )}
            {exportState === "done" && certificate?.hashChain && (
              <div className="arb-ai-card" style={{ marginTop: 8 }} data-testid="judicial-certificate">
                <span className="arb-ai-badge">🔐 SHA-256 审计证书 · 司法级</span>
                <div className="arb-ai-row">
                  <span>存证链校验</span>
                  <strong style={{ color: certificate.hashChain.chainValid ? "#4ade80" : "#f87171" }}>
                    {certificate.hashChain.chainValid ? "链完整 · 未被篡改" : "链断裂 · 需人工复核"}
                  </strong>
                </div>
                <div className="arb-ai-row">
                  <span>证据锚点数</span>
                  <strong style={{ color: "#cbd5e1" }}>{certificate.hashChain.entries.length} 条</strong>
                </div>
                {certificate.hashChain.entries.length > 0 && (
                  <div className="arb-ai-note" style={{ wordBreak: "break-all" }}>
                    📜 链首哈希：{String((certificate.hashChain.entries[0] as { hash?: string }).hash ?? "-").slice(0, 24)}…
                  </div>
                )}
              </div>
            )}
          </div>
        </section>

        {/* ② 分级仲裁区：L2 = AI 小法官建议卡（Advisory）；L1/L3 自动切断线上调解 */}
        {isLevel2 ? (
          <section className="arb-ai-card" data-testid="ai-proposal-card">
            <span className="arb-ai-badge">🤖 AI 小法官裁定 · 仅 Advisory（红线 1）</span>
            <div className="arb-ai-row">
              <span>责任认定</span>
              <strong data-testid="proposal-liability">{LIABILITY_LABEL[proposal.liability]}</strong>
            </div>
            <div className="arb-ai-row">
              <span>责任说明</span>
              <span style={{ color: "#cbd5e1" }}>{proposal.liabilityNote}</span>
            </div>
            <div className="arb-ai-row">
              <span>建议退款</span>
              <span className="arb-ai-refund" data-testid="proposal-refund">
                ¥{proposal.refundAmount.toFixed(proposal.refundAmount % 1 ? 2 : 0)}
              </span>
            </div>
            <div className="arb-ai-row">
              <span>平台补偿券</span>
              <strong style={{ color: "#fbbf24" }} data-testid="proposal-coupon">
                ¥{proposal.compensationCouponYuan}
              </strong>
            </div>
            <div className="arb-ai-row">
              <span>信用扣减</span>
              <strong style={{ color: "#fca5a5" }} data-testid="proposal-credit">
                -{proposal.creditDeduct} 分
              </strong>
            </div>
            <div className="arb-ai-note">📐 理由链（LLM 失败回落确定性规则）：</div>
            <ul className="arb-reason" data-testid="proposal-reasons">
              {proposal.reasonChain.map((r, i) => (
                <li key={i}>{r}</li>
              ))}
            </ul>
          </section>
        ) : isLevel1 ? (
          <section className="arb-ai-card" data-testid="instant-compensate-card" style={{ borderColor: "rgba(74,222,128,.4)", background: "linear-gradient(135deg,rgba(74,222,128,.12),rgba(16,185,129,.04))" }}>
            <span className="arb-ai-badge" style={{ color: "#4ade80" }}>⚡ 规则引擎秒赔 · 确定性规则（红线 1）</span>
            <div className="arb-ai-row">
              <span>争议金额</span>
              <span className="arb-ai-refund" style={{ color: "#4ade80" }} data-testid="instant-amount">
                ¥{disputeAmountYuan}
              </span>
            </div>
            <div className="arb-ai-row">
              <span>赔付来源</span>
              <strong style={{ color: "#fbbf24" }}>平台体验保障金（不扣罚服务者）</strong>
            </div>
            <div className="arb-ai-row">
              <span>服务者处置</span>
              <strong style={{ color: "#4ade80" }}>零扣罚 · 零信用减分 · 即时结案</strong>
            </div>
          </section>
        ) : (
          <section className="arb-ai-card" data-testid="legal-direct-card" style={{ borderColor: "rgba(248,113,113,.5)", background: "linear-gradient(135deg,rgba(248,113,113,.14),rgba(127,29,29,.05))" }}>
            <span className="arb-ai-badge" style={{ color: "#fca5a5" }}>⚖️ 法务专家组接管 · 线上调解已切断</span>
            <div className="arb-law-card" data-testid="legal-connect-card">
              <span className="arb-law-pulse" />
              <div>
                <strong>紧急连线安全法务组</strong>
                <div style={{ fontSize: 10.5, color: "#94a3b8", marginTop: 2 }}>
                  法务专家在线值班中 · 平均响应 &lt; 5 分钟
                </div>
              </div>
            </div>
            <div className="arb-law-card" data-testid="legal-insurance-card">
              <span style={{ flexShrink: 0 }}>🛡️</span>
              <div>
                <strong>联动保险公司现场勘查</strong>
                <div style={{ fontSize: 10.5, color: "#94a3b8", marginTop: 2 }}>
                  定损理赔通道已预置 · 勘查员调度中
                </div>
              </div>
            </div>
          </section>
        )}

        {/* ③ 分级出口：L2 隔离墙双出口 / L1 一键秒赔 / L3 法务直连 */}
        {isLevel1 ? (
          <div className="arb-actions">
            <button
              type="button"
              className="arb-btn arb-btn-accept"
              data-action="instant-compensate"
              onClick={onInstantCompensate}
            >
              ⚡ 一键秒级补偿（扣除平台体验保障金）
            </button>
          </div>
        ) : isLevel3 ? (
          <div className="arb-actions">
            <button
              type="button"
              className="arb-btn arb-btn-escalate"
              data-action="connect-legal"
              onClick={onConnectLegal}
            >
              🚨 紧急连线安全法务组
            </button>
          </div>
        ) : (
          <div className="arb-actions">
            <button
              type="button"
              className="arb-btn arb-btn-accept"
              data-action="accept-proposal"
              onClick={onAcceptProposal}
            >
              🤝 接受调解方案
            </button>
            <button
              type="button"
              className="arb-btn arb-btn-escalate"
              data-action="escalate-manual"
              onClick={onEscalateManual}
            >
              🧑‍⚖️ 申请人工客服
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
