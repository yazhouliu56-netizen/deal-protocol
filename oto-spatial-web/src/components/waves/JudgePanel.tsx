"use client";

import { useState } from "react";
import { Scale } from "lucide-react";
import type { DisputeReason } from "@/base/order/dispute";
import type { VerdictSuggestion } from "@/base/ai/judge";

/**
 * 智能争议小法官（ADR-0008）—— 证据链 → 定责 → 赔付建议 + 话术。
 * 嵌入争议视图：解析「需求方凭证 vs 工作人员反驳」，LLM 语义比对，
 * 失败自动回落到确定性规则（宪法 #10）。一键发起协商采纳。
 */
export default function JudgePanel({
  claimId,
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
  const [verdict, setVerdict] = useState<VerdictSuggestion | null>(null);
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
        verdict?: VerdictSuggestion;
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
    <div className="rounded-2xl bg-sky-400/[0.06] border border-sky-400/25 p-2.5 space-y-2">
      <p className="text-[10px] font-bold text-sky-300/90 flex items-center gap-1">
        <Scale size={11} /> AI 小法官 · 静态比对证据链给出赔付建议
      </p>

      {!verdict && (
        <div className="space-y-1.5">
          <input
            value={defense}
            onChange={(e) => setDefense(e.target.value)}
            placeholder="你的反驳（如：已免费返工，是甲方没等晾干）"
            aria-label="小法官审查·你的反驳"
            className="w-full rounded-xl bg-white/[0.05] border border-white/10 px-2.5 py-2 text-[10px] outline-none focus:border-sky-400/50"
          />
          <button
            onClick={runJudge}
            disabled={loading || !evidence.trim()}
            className={`w-full py-2 rounded-xl text-[10.5px] font-bold transition-colors ${
              loading
                ? "bg-white/[0.06] text-white/40"
                : "bg-sky-400/15 border border-sky-400/40 text-sky-300"
            }`}
          >
            {loading ? "小法官评议中…" : "请小法官判定 ⚖️"}
          </button>
        </div>
      )}

      {verdict && (
        <div className="space-y-2">
          <div className="rounded-xl bg-white/[0.05] border border-white/10 p-2.5 space-y-1.5">
            <p className="text-[10.5px] font-bold text-sky-200">
              {stanceLabel[verdict.stance] ?? verdict.stance} · 建议赔付 ¥
              {verdict.amountYuan}（{verdict.refundPct}%）
            </p>
            <p className="text-[9px] text-white/50">{verdict.rationale}</p>
            <p className="text-[9px] text-white/60 border-t border-white/10 pt-1.5">
              {verdict.replyScript}
            </p>
            <p className="text-[8.5px] text-white/30">
              置信 {Math.round(verdict.confidence * 100)}% ·{" "}
              {verdict.source === "llm" ? "LLM 语义比对" : "规则引擎（LLM 不可用回落）"}
            </p>
          </div>
          <div className="flex gap-2">
            {verdict.refundPct > 0 && (
              <button
                onClick={() =>
                  onSettle(verdict.refundPct, `采纳小法官建议：${verdict.rationale}`)
                }
                className="flex-1 py-2 rounded-xl bg-emerald-400/15 border border-emerald-400/40 text-[10px] font-bold text-emerald-300"
              >
                采纳：退 {verdict.refundPct}%
              </button>
            )}
            {verdict.stance === "demander" && (
              <button
                onClick={() => onSettle(0, "小法官判定需求方责任，款项归服务方")}
                className="flex-1 py-2 rounded-xl bg-emerald-400/15 border border-emerald-400/40 text-[10px] font-bold text-emerald-300"
              >
                采纳：不退款
              </button>
            )}
            <button
              onClick={() => setVerdict(null)}
              className="px-3 py-2 rounded-xl bg-white/[0.06] border border-white/15 text-[10px] font-bold text-white/60"
            >
              重审
            </button>
          </div>
        </div>
      )}
    </div>
  );
}