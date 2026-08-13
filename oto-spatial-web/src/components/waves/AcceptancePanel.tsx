"use client";
import { useMemo, useState } from "react";
import { AlertTriangle } from "lucide-react";
import { useWaveStore } from "@/store/useWaveStore";
import { DISPUTE_REASONS, type DisputeRecord, type DisputeReason } from "@/base/order/dispute";
import JudgePanel from "./JudgePanel";
import { confirmedCount } from "@/base/order/moduleFulfilment";
import type { Claim, Wave } from "@/base/order/wave";
import { checkTextEvidence } from "@/base/ai/forgery";
import { verifyDoc } from "@/base/platform/signInsure";

/**
 * 验收 + 争议面板（需求方视角）：模块化验收（复杂任务）逐模块确认；
 * 验收冲突时按原因开争议 —— 自动判责 + 48h 申诉窗，全过程留痕可查。
 * 简单任务（无 modules）沿用父组件原有 fulfilment 验收，本面板只承担争议。
 */
export default function AcceptancePanel({
  claim,
  wave,
}: {
  claim: Claim;
  wave: Wave;
}) {
  const approveModule = useWaveStore((s) => s.approveModule);
  const openDispute = useWaveStore((s) => s.openDispute);
  const disputes = useWaveStore((s) => s.disputes);
  const myDispute = disputes.find((d) => d.claimId === claim.id && !d.outcome);
  const [reason, setReason] = useState<DisputeReason | "">("");
  const [evidence, setEvidence] = useState("");

  const defs = wave.modules ?? [];
  const modules = claim.modules;
  const done = defs.length || modules?.length || 0;
  const confirmed = confirmedCount(claim);

  if (!modules || modules.length === 0) {
    // 简单任务：只提供争议入口（验收在父组件）
    if (myDispute)
      return (
        <DisputeVerdictView
          dispute={myDispute}
          claimId={claim.id}
          amountYuan={claim.price ?? wave.budget}
        />
      );
    return (
      <DisputeForm
        reason={reason}
        evidence={evidence}
        setReason={setReason}
        setEvidence={setEvidence}
        claimId={claim.id}
        onOpen={(r, e) => {
          openDispute({ claimId: claim.id, reason: r, evidence: e });
          setReason("");
          setEvidence("");
        }}
      />
    );
  }

  // 复杂任务：逐模块验收 + 争议
  return (
    <div className="space-y-2.5">
      <p className="text-[10px] font-bold text-white/70 flex items-center justify-between">
        <span>🔍 模块化验收（{confirmed}/{done} 已确认）</span>
        <span className="text-white/35 font-normal">逐模块放款 · 全确认才放全款</span>
      </p>
      {modules.map((m, i) => {
        const def = defs[i];
        const label =
          m.status === "confirmed" ? "已确认 ✓ 放款" : m.status === "done" ? "待你确认" : "未开始";
        return (
          <div
            key={i}
            className="rounded-xl bg-white/[0.04] border border-white/10 p-2.5"
          >
            <div className="flex items-center justify-between gap-2">
              <span className="text-[10.5px] font-bold text-white/85 flex-1 truncate">
                模块 {i + 1} · {def?.name ?? `模块${i + 1}`}
              </span>
              <span
                className={`text-[9px] font-bold shrink-0 px-1.5 py-0.5 rounded-full ${
                  m.status === "confirmed"
                    ? "bg-emerald-400/15 text-emerald-300"
                    : m.status === "done"
                    ? "bg-amber-400/15 text-amber-300"
                    : "bg-white/10 text-white/40"
                }`}
              >
                {label}
              </span>
            </div>
            <p className="text-[9.5px] text-white/40 mt-1">{def?.acceptance}</p>
            {m.status === "done" && (
              <button
                onClick={() => approveModule(claim.id, i)}
                aria-label={`确认模块 ${def?.name ?? `模块${i + 1}`}`}
                className="mt-1.5 w-full py-1.5 rounded-xl bg-emerald-400/12 border border-emerald-400/35 text-[10px] font-bold text-emerald-300"
              >
                确认此模块 ✅
              </button>
            )}
          </div>
        );
      })}
      {confirmed === done && (
        <p className="text-[10px] text-emerald-300/90">
          ✓ 全部模块已确认 —— 履约完成，全款已放
        </p>
      )}

      {myDispute ? (
        <DisputeVerdictView dispute={myDispute} claimId={claim.id} amountYuan={claim.price ?? wave.budget} />
      ) : (
        <DisputeForm
          reason={reason}
          evidence={evidence}
          setReason={setReason}
          setEvidence={setEvidence}
          claimId={claim.id}
          onOpen={(r, e) => {
            openDispute({ claimId: claim.id, reason: r, evidence: e });
            setReason("");
            setEvidence("");
          }}
        />
      )}
    </div>
  );
}

/** 争议发起表单：原因拆分（公平公正公开）+ 凭证。 */
function DisputeForm({
  reason,
  evidence,
  setReason,
  setEvidence,
  onOpen,
  claimId,
}: {
  reason: DisputeReason | "";
  evidence: string;
  setReason: (r: DisputeReason | "") => void;
  setEvidence: (e: string) => void;
  onOpen: (reason: DisputeReason, evidence: string) => void;
  claimId: string;
}) {
  // AIGC 伪造鉴真（ADR-0012，N4 接线）：凭证文本与历史凭证比对，识别复用/异常
  const pastEvidence = useWaveStore((s) =>
    s.disputes.filter((d) => d.claimId === claimId).map((d) => d.evidence)
  );
  const forgery = useMemo(
    () => (evidence.trim() ? checkTextEvidence([...pastEvidence, evidence.trim()]) : null),
    [evidence, pastEvidence]
  );
  return (
    <div className="rounded-2xl bg-amber-400/[0.05] border border-amber-400/25 p-2.5 space-y-2">
      <p className="text-[10px] font-bold text-amber-300/90 flex items-center gap-1">
        <AlertTriangle size={11} /> 发起争议（原因拆分优先 · 公平公正公开）
      </p>
      <div className="flex flex-wrap gap-1.5">
        {DISPUTE_REASONS.map((r) => (
          <button
            key={r.value}
            onClick={() => setReason(r.value)}
            className={`px-2 py-1 rounded-full text-[9px] font-bold transition-colors ${
              reason === r.value
                ? "bg-amber-400/25 border border-amber-400/60 text-amber-200"
                : "bg-white/[0.04] border border-white/10 text-white/50"
            }`}
          >
            {r.label}
          </button>
        ))}
      </div>
      <input
        value={evidence}
        onChange={(e) => setEvidence(e.target.value)}
        placeholder="凭证：发生了什么、与你预期的偏差（必填）"
        aria-label="争议凭证"
        className="w-full rounded-xl bg-white/[0.05] border border-white/10 px-2.5 py-2 text-[10px] outline-none focus:border-amber-400/50"
      />
      {forgery && (
        <p
          className={`text-[8.5px] font-bold rounded-lg px-2 py-1 ${
            forgery.level === "highly-suspicious"
              ? "bg-red-400/10 border border-red-400/40 text-red-300"
              : forgery.level === "suspicious"
                ? "bg-amber-400/10 border border-amber-400/40 text-amber-300"
                : "bg-emerald-400/10 border border-emerald-400/30 text-emerald-300"
          }`}
        >
          {forgery.level === "clean"
            ? "✅ 凭证鉴真：未见异常（规则分 0）"
            : `⚠️ 凭证鉴真：${forgery.level === "highly-suspicious" ? "高度疑似伪造" : "疑似复用/异常"}（疑点分 ${forgery.score}）`}
        </p>
      )}
      <button
        onClick={() => {
          if (!reason || !evidence.trim()) return;
          onOpen(reason, evidence.trim());
        }}
        className="w-full py-2 rounded-xl bg-amber-400/15 border border-amber-400/40 text-[10.5px] font-bold text-amber-300"
      >
        提交争议 · 按原因自动判责
      </button>
    </div>
  );
}

/** 争议判定展示：自动档位 + 协商进度。 */
function DisputeVerdictView({
  dispute,
  claimId,
  amountYuan,
}: {
  dispute: DisputeRecord;
  claimId: string;
  amountYuan: number;
}) {
  const settleDispute = useWaveStore((s) => s.settleDispute);
  const signedDocs = useWaveStore((s) => s.signedDocs);
  const [proposed, setProposed] = useState("30");
  // Capture now once per mount (steady-clock friendly); avoids impure Date.now()
  // calls in the render body.
  const [now] = useState(() => Date.now());
  const outcome = dispute.outcome;
  // ADR-0012 签章（N7 接线）：验收后生成的签章存根 → 验签展示
  const signed = signedDocs[signedDocs.length - 1];
  const sealCheck = signed ? verifyDoc(signed) : null;

  return (
    <div className="rounded-2xl bg-amber-400/[0.06] border border-amber-400/30 p-3 space-y-2">
      <p className="text-[10.5px] font-bold text-amber-200">
        ⚖️ 争议进行中 · {dispute.verdict.label}
      </p>
      <p className="text-[9px] text-white/40">
        凭证：{dispute.evidence} ·{" "}
        {dispute.appealDeadline > now
          ? "响应方 48h 内可申诉"
          : "申诉窗已过，自动按档位终局"}
      </p>
      {sealCheck && (
        <p
          className={`text-[8.5px] font-bold rounded-lg px-2 py-1 border ${
            sealCheck.ok
              ? "bg-emerald-400/10 border-emerald-400/30 text-emerald-300"
              : "bg-red-400/10 border-red-400/40 text-red-300"
          }`}
        >
          🔏 验收签章：{sealCheck.note}
        </p>
      )}
      {!outcome && (
        <>
          <JudgePanel
            claimId={claimId}
            reason={dispute.reason}
            evidence={dispute.evidence}
            amountYuan={amountYuan}
            onSettle={(proposedPct, note) => {
              settleDispute({
                claimId,
                proposedPct,
                willAccept: true,
                note,
              });
            }}
          />
          <div className="flex items-center gap-2 flex-wrap">
          <p className="text-[9.5px] text-white/60 flex-1">协商部分退款比例（%）：</p>
          <button
            onClick={() => setProposed("30")}
            className={`px-2 py-1 rounded-full text-[9px] font-bold ${
              proposed === "30"
                ? "bg-brandPurple/30 text-brandPurple border border-brandPurple/50"
                : "bg-white/[0.04] border border-white/10 text-white/50"
            }`}
          >
            30%
          </button>
          <button
            onClick={() => setProposed("60")}
            className={`px-2 py-1 rounded-full text-[9px] font-bold ${
              proposed === "60"
                ? "bg-brandPurple/30 text-brandPurple border border-brandPurple/50"
                : "bg-white/[0.04] border border-white/10 text-white/50"
            }`}
          >
            60%
          </button>
          <button
            onClick={() =>
              settleDispute({
                claimId,
                proposedPct: Number(proposed),
                willAccept: true,
                note: "需求方接受协商",
              })
            }
            className="px-2.5 py-1 rounded-xl bg-emerald-400/15 border border-emerald-400/40 text-[9px] font-bold text-emerald-300"
          >
            接受协商
          </button>
          <button
            onClick={() =>
              settleDispute({
                claimId,
                proposedPct: 0,
                willAccept: false,
                note: "需求方拒绝协商",
              })
            }
            className="px-2.5 py-1 rounded-xl bg-white/[0.06] border border-white/15 text-[9px] font-bold text-white/60"
          >
            拒绝回自动
          </button>
        </div>
        </>
      )}
      {outcome && (
        <p className="text-[9.5px] font-bold text-emerald-300">
          ✓ 已结算：{outcome.note}
          {outcome.kind === "negotiated" && ` · 按 ${outcome.agreedAmount}% 退款`}
        </p>
      )}
    </div>
  );
}