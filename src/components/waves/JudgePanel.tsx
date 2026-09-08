"use client";

import { useState } from "react";
import { Scale } from "lucide-react";
import DuoButton from "@/components/ui/DuoButton";
import type { DisputeReason } from "@/base/order/dispute";
import type { VerdictSuggestion } from "@/base/ai/judge";

/**
 * 智能争议小法官（ADR-0008）—— 证据链 → 定责 → 赔付建议 + 话术。
 * 嵌入争议视图：解析「需求方凭证 vs 工作人员反驳」，LLM 语义比对，
 * 失败自动回落到确定性规则（宪法 #10）。一键发起协商采纳。
 */
/** 方向 1 接线 B：base 护栏产出的整数分守恒切分（红线 1）。 */
type JudgeVerdict = VerdictSuggestion & {
  settlement?: { refundCents: number; payoutCents: number };
};

export default function JudgePanel({
  reason,
  evidence,
  amountYuan,
  onSettle,
}: {
  claimId: string;
  reason: DisputeReason;
  evidence: string;
  amountYuan: number;
  onSettle: (proposedPct: number, note: string) => void;
}) {
  const [defense, setDefense] = useState("");
  const [verdict, setVerdict] = useState<JudgeVerdict | null>(null);
  const [loading, setLoading] = useState(false);

  const runJudge = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/judge", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          reason,
          evidence,
          responderText: defense.trim() || undefined,
          amountYuan,
        }),
      });
      const data = (await res.json()) as {
        verdict?: JudgeVerdict;
        source?: string;
        error?: string;
      };
      if (data.error || !data.verdict) {
        setVerdict(null);
        return;
      }
      setVerdict(data.verdict);
    } catch {
      setVerdict(null);
    } finally {
      setLoading(false);
    }
  };

  const stanceLabel: Record<string, string> = {
    "responder-full": "响应者全责",
    "responder-partial": "响应者部分责任",
    shared: "双方共担",
    demander: "需求方责任",
  };

  return (
    <div className="rounded-2xl bg-[#1cb0f6]/[.06] border-2 border-[#1cb0f6]/40 p-2.5 space-y-2">
      <p className="text-xs font-extrabold text-[#0a6ea8] flex items-center gap-1">
        <Scale size={11} /> AI 小法官 · 静态比对证据链给出赔付建议
      </p>

      {!verdict && (
        <div className="space-y-1.5">
          <input
            value={defense}
            onChange={(e) => setDefense(e.target.value)}
            placeholder="你的反驳（如：已免费返工，是甲方没等晾干）"
            aria-label="小法官审查·你的反驳"
            className="w-full rounded-xl bg-white border-2 border-[#e5e5e5] px-2.5 py-2 text-xs text-[#4b4b4b] placeholder:text-[#afafaf] outline-none focus:border-[#1cb0f6]"
          />
          <DuoButton
            variant="secondary"
            size="sm"
            sound="click"
            fullWidth
            onClick={runJudge}
            disabled={loading || !evidence.trim()}
          >
            {loading ? "小法官评议中…" : "请小法官判定 ⚖️"}
          </DuoButton>
        </div>
      )}

      {verdict && (
        <div className="space-y-2">
          <div className="rounded-xl bg-white border-2 border-[#e5e5e5] p-2.5 space-y-1.5">
            <p className="text-xs font-bold text-[#0a6ea8]">
              {stanceLabel[verdict.stance] ?? verdict.stance} · 建议赔付 ¥
              {verdict.settlement
                ? (verdict.settlement.refundCents / 100).toFixed(
                    verdict.settlement.refundCents % 100 ? 2 : 0,
                  )
                : verdict.amountYuan}
              （{verdict.refundPct}%）
            </p>
            <p className="text-xs text-[#777777]">{verdict.rationale}</p>
            <p className="text-xs text-[#4b4b4b] border-t-2 border-[#e5e5e5] pt-1.5">
              {verdict.replyScript}
            </p>
            <p className="text-xs text-[#afafaf]">
              置信 {Math.round(verdict.confidence * 100)}% ·{" "}
              {verdict.source === "llm" ? "LLM 语义比对" : "规则引擎（LLM 不可用回落）"}
              {verdict.settlement ? ` · 分币守恒 ✓（结清服务方 ¥${(verdict.settlement.payoutCents / 100).toFixed(verdict.settlement.payoutCents % 100 ? 2 : 0)}）` : ""}
            </p>
          </div>
          <div className="flex gap-2">
            {verdict.refundPct > 0 && (
              <DuoButton
                variant="primary"
                size="sm"
                sound="correct"
                className="flex-1"
                onClick={() =>
                  onSettle(verdict.refundPct, `采纳小法官建议：${verdict.rationale}`)
                }
              >
                采纳：退 {verdict.refundPct}%
              </DuoButton>
            )}
            {verdict.stance === "demander" && (
              <DuoButton
                variant="primary"
                size="sm"
                sound="correct"
                className="flex-1"
                onClick={() => onSettle(0, "小法官判定需求方责任，款项归服务方")}
              >
                采纳：不退款
              </DuoButton>
            )}
            <DuoButton variant="outline" size="sm" sound="click" onClick={() => setVerdict(null)}>
              重审
            </DuoButton>
          </div>
        </div>
      )}
    </div>
  );
}