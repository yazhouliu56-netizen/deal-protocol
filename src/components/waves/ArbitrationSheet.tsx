"use client";

import { useState } from "react";
import type { AtomicFiveState } from "@/types/ammo-schema";

/**
 * 争议调解 · AI 小法官半屏抽屉（Dispute & AI Arbitration Sheet · 白皮书 §五 5.6.3）。
 *
 * 三区组装：
 * 1. 物证比对链 —— 客户投诉诉求 / 履约完工照片（含 AI 视觉标注）/ 关键聊天记录；
 * 2. AI 小法官建议卡（L3-M3）—— 退款金额 + 平台补偿券 + 责任认定 + 信用扣减 + 理由链，
 *    仅 Advisory（红线 1：LLM 结果不直接落库，写入由用户确认动作执行）；
 * 3. 隔离墙双出口（红线 1）——
 *    【🤝 接受调解方案】onAcceptProposal：扣扳机执行退款并流转 SETTLED（BREACH_SETTLED 载荷）；
 *    【🧑⚖️ 申请人工客服】onEscalateManual：冻结资金进入人工仲裁队列。
 */

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
  /** AI 小法官建议卡（Advisory）。 */
  proposal: ArbitrationProposal;
  /** 双出口 A：接受调解方案（执行退款 + 流转 SETTLED）。 */
  onAcceptProposal: () => void;
  /** 双出口 B：申请人工客服（冻结资金进人工仲裁队列）。 */
  onEscalateManual: () => void;
  /** 关闭抽屉。 */
  onClose: () => void;
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
  box-shadow:0 -18px 60px rgba(0,0,0,.55)}
.arb-grip{width:44px;height:4px;border-radius:999px;background:rgba(255,255,255,.25);margin:4px auto 10px}
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
`;

const LIABILITY_LABEL: Record<ArbitrationProposal["liability"], string> = {
  employer: "雇方责任",
  provider: "履约方责任",
  split: "双方按比担责",
};

/** 争议调解半屏抽屉（bottom-sheet 上滑）。 */
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
}: ArbitrationSheetProps) {
  const [exportState, setExportState] = useState<ExportState>("idle");
  const [certificate, setCertificate] = useState<JudicialCertificate | null>(null);
  const [exportError, setExportError] = useState("");

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
      <div className="arb-sheet" role="dialog" aria-label="争议调解">
        <div className="arb-grip" />

        <div className="arb-title">
          <span>
            🧑‍⚖️ 争议调解 · 小法官
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

        {/* ② AI 小法官建议卡（Advisory） */}
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

        {/* ③ 隔离墙双出口（红线 1：写入由用户确认动作执行） */}
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
      </div>
    </div>
  );
}
