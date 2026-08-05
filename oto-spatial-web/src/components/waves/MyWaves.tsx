"use client";
import { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import { MessageSquareText, AlertTriangle, HelpCircle, Send, Flag } from "lucide-react";
import { useWaveStore } from "@/store/useWaveStore";
import { useIdentityStore } from "@/store/useIdentityStore";
import { ACTION_LABEL } from "@/lib/moderation";
import { raiseSuggestion, yuan } from "@/lib/customPricing";
import { MAX_ROUNDS, nextSpeaker, type Claim, type Wave } from "@/lib/wave";
import { autoFulfilmentRemaining } from "@/lib/fulfilment";
import type { BlindRevealData } from "./BlindReveal";
import BlindReveal from "./BlindReveal";
import DialCard from "./DialCard";
import ReviewSection from "./ReviewSection";

/**
 * 需求方视角：我发出的信号波 + 接单状态 + 磋商往来 + 违约裁决。
 * 待接单者队列不呈现；已接单者呈现（脱敏 + 信用 + 盲盒揭晓）。
 */
export default function MyWaves() {
  const waves = useWaveStore((s) => s.waves);
  const claims = useWaveStore((s) => s.claims);
  const reports = useWaveStore((s) => s.reports);
  const acceptClaim = useWaveStore((s) => s.acceptClaim);
  const counterOffer = useWaveStore((s) => s.counterOffer);
  const withdraw = useWaveStore((s) => s.withdraw);
  const closeWave = useWaveStore((s) => s.closeWave);
  const acceptFulfilment = useWaveStore((s) => s.acceptFulfilment);
  const submitReport = useWaveStore((s) => s.submitReport);
  const runAutoFulfilments = useWaveStore((s) => s.runAutoFulfilments);
  const moveDeposit = useWaveStore((s) => s.moveDeposit);
  const receivePayout = useIdentityStore((s) => s.receivePayout);
  const identity = useIdentityStore((s) => s.identity);
  const settle = useIdentityStore((s) => s.settle);
  const [breachOpen, setBreachOpen] = useState<string | null>(null);
  const [verdictMsg, setVerdictMsg] = useState<Record<string, string>>({});
  const [acceptNote, setAcceptNote] = useState<Record<string, string>>({});
  const [now] = useState(() => Date.now());

  // 自动放款：72h 未验收的申报在挂载/变更时结算（幂等）
  useEffect(() => {
    runAutoFulfilments();
  }, [runAutoFulfilments]);

  const mine = useMemo(
    () =>
      waves
        .filter((w) => w.authorId === identity.id)
        .sort((a, b) => b.createdAt - a.createdAt),
    [waves, identity]
  );

  return (
    <div className="pointer-events-auto">
      <h2 className="text-[18px] font-extrabold text-white/95">我的需求</h2>
      <p className="text-[10px] text-white/45 mb-3">你发出的信号波 · 谁接单算谁的</p>

      {mine.length === 0 && (
        <div className="glass-panel rounded-3xl p-6 text-center">
          <span className="text-2xl">📡</span>
          <p className="text-[11px] text-white/50 mt-2">还没有发出过需求</p>
        </div>
      )}

      <div className="flex flex-col gap-3">
        {mine.map((wave) => {
          const waveClaims = claims.filter((c) => c.waveId === wave.id);
          const accepted = waveClaims.find((c) => c.status === "accepted");
          const negotiating = waveClaims.filter(
            (c) => c.status === "negotiating"
          );
          const revealData: BlindRevealData | undefined = accepted
            ? acceptedReveal(accepted)
            : undefined;

          return (
            <div key={wave.id} className="glass-panel rounded-3xl p-4 space-y-2.5">
              {/* 平台下架态 */}
              {wave.removed && (
                <p className="text-[10px] font-bold text-red-300/90 flex items-center gap-1.5">
                  <Flag size={10} /> 该需求已被平台下架（可于安全中心申诉）
                </p>
              )}
              {/* 概要 */}
              <div className="flex items-start justify-between gap-2">
                <div>
                  <h3 className="text-[13px] font-extrabold">{wave.basics.category}</h3>
                  <p className="text-[10px] text-white/50 mt-0.5">
                    {wave.basics.time} · {wave.basics.area} · 预算 {yuan(wave.budget)}
                  </p>
                  {wave.customs.map((c) => (
                    <span
                      key={c.text}
                      className="inline-block mt-1 mr-1.5 px-2 py-0.5 rounded-full bg-brandPurple/20 border border-brandPurple/40 text-[9px] font-bold text-brandPurple"
                    >
                      {c.text}
                    </span>
                  ))}
                </div>
                <div className="flex flex-col items-end gap-1 shrink-0">
                  <StatusBadge status={wave.status} />
                  {(wave.status === "active" || wave.status === "claimed") && (
                    <button
                      onClick={() => closeWave(wave.id)}
                      className="text-[9px] text-white/40 hover:text-white"
                    >
                      手动关闭
                    </button>
                  )}
                </div>
              </div>

              {/* 盲盒揭晓：一旦有真身接单 */}
              {accepted && revealData && (
                <BlindReveal data={revealData} />
              )}

              {/* 磋商中：双向还价（每对独立 3 轮，lastBy 交替） */}
              {negotiating.length > 0 && (
                <div className="space-y-1.5">
                  {negotiating.map((c) => (
                    <NegotiationThread
                      key={c.id}
                      claim={c}
                      wave={wave}
                      onAccept={() => acceptClaim(c.id)}
                      onWithdraw={() => withdraw(c.id)}
                      onCounter={({ price, message }) =>
                        counterOffer({
                          claimId: c.id,
                          price,
                          message,
                          actor: "demander",
                        })
                      }
                    />
                  ))}
                </div>
              )}

              {/* 已接单 → 见面 / 验收 / 违约 + 一次性虚拟线路 */}
              {wave.status === "claimed" && accepted && (
                <>
                  <DialCard
                    waveId={wave.id}
                    responderId={accepted.responderId}
                    demanderId={identity.id}
                    lockedAt={accepted.createdAt}
                  />
                  <div className="flex justify-end">
                    {(() => {
                      const myRep = reports.find(
                        (r) =>
                          r.reporterId === identity.id &&
                          r.targetId === accepted.responderId
                      );
                      return myRep?.status === "resolved" ? (
                        <span className="px-2.5 py-1.5 rounded-xl text-[9.5px] font-bold text-emerald-300/90">
                          ✓ 平台已处理：
                          {ACTION_LABEL[myRep.action ?? "dismiss"]}
                        </span>
                      ) : myRep ? (
                        <span className="px-2.5 py-1.5 rounded-xl text-[9.5px] font-bold text-amber-300/90">
                          ⏳ 已举报，核查中
                        </span>
                      ) : (
                        <button
                          onClick={() =>
                            submitReport({
                              targetId: accepted.responderId,
                              targetType: "responder",
                              reason: "harassment",
                              detail: "对方行为不当",
                              reporterId: identity.id,
                            })
                          }
                          className="px-2.5 py-1.5 rounded-xl bg-white/[0.04] border border-white/10 text-[9.5px] font-bold text-white/50 hover:text-amber-400 hover:border-amber-400/40"
                        >
                          🚩 举报对方
                        </button>
                      );
                    })()}
                  </div>
                  {!accepted.serviceDoneAt && (
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-[10px] text-white/50">
                        等待服务方申报完成（请求放款）…
                      </p>
                      <button
                        onClick={() => setBreachOpen(wave.id)}
                        className="shrink-0 px-2.5 py-1.5 rounded-xl glass-panel text-[9.5px] font-bold text-amber-400/90 flex items-center gap-1"
                      >
                        <AlertTriangle size={11} /> 对方违约
                      </button>
                    </div>
                  )}
                  {accepted.serviceDoneAt && !accepted.fulfilment && (
                    <div className="rounded-2xl bg-emerald-400/[0.06] border border-emerald-400/25 p-2.5">
                      <p className="text-[10px] font-bold text-emerald-300 mb-1.5">
                        服务方已申报完成 —— 验收确认后放款
                      </p>
                      <input
                        value={acceptNote[accepted.id] ?? ""}
                        onChange={(e) =>
                          setAcceptNote((m) => ({
                            ...m,
                            [accepted.id]: e.target.value,
                          }))
                        }
                        placeholder="验收凭证：交付了什么、完成情况（必填）"
                        aria-label="验收凭证"
                        className="w-full rounded-xl bg-white/[0.05] border border-white/10 px-2.5 py-2 text-[10px] outline-none focus:border-emerald-400/50 mb-1.5"
                      />
                      <div className="flex gap-2 items-center">
                        <button
                          onClick={() => {
                            const note = (acceptNote[accepted.id] ?? "").trim();
                            if (!note) return;
                            acceptFulfilment(accepted.id, note);
                          }}
                          className="flex-1 py-2 rounded-xl bg-emerald-400/15 border border-emerald-400/40 text-[10.5px] font-bold text-emerald-300"
                          aria-label="确认验收"
                        >
                          确认验收 ✅
                          {accepted.depositPhase === "held" && (
                            <span className="ml-1 text-[9px] opacity-70">
                              · 解冻押金
                            </span>
                          )}
                        </button>
                        <button
                          onClick={() => setBreachOpen(wave.id)}
                          className="px-2.5 py-2 rounded-xl glass-panel text-[9.5px] font-bold text-amber-400/90 flex items-center gap-1"
                        >
                          <AlertTriangle size={11} /> 对方违约
                        </button>
                      </div>
                      <p className="text-[9px] text-white/35 mt-1.5">
                        {Math.ceil(
                          autoFulfilmentRemaining(accepted, now) / 3600_000
                        )}{" "}
                        小时后未验收 → 自动放款（对齐默认好评 72h 闸）
                      </p>
                    </div>
                  )}
                  {accepted.fulfilment && (
                    <p className="text-[10px] text-white/50">
                      ✓ 已验收
                      {accepted.fulfilment.confirmedBy === "auto" && "（自动放款）"}
                      ：{accepted.fulfilment.note}
                    </p>
                  )}
                  {verdictMsg[wave.id] && (
                    <p className="text-[10px] font-bold text-emerald-300">
                      ✓ 已裁决：{verdictMsg[wave.id]}
                    </p>
                  )}

                  {/* 履约后互评（72h 窗口，脱敏展示） */}
                  <ReviewSection
                    claim={accepted}
                    wave={wave}
                    myId={identity.id}
                    peerId={accepted.responderId}
                  />
                </>
              )}

              {/* 违约裁决面板 */}
              {breachOpen === wave.id && accepted && (
                <motion.div
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="rounded-2xl bg-amber-400/[0.06] border border-amber-400/30 p-3 space-y-2"
                >
                  <p className="text-[10.5px] text-white/80 font-bold flex items-center gap-1">
                    <HelpCircle size={11} className="text-amber-300" />
                    响应方未履约，请裁决谅解与否
                    {accepted.depositPhase === "held" && (
                      <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full bg-sky-400/15 border border-sky-400/40 text-sky-300">
                        🕊️ 押金 ¥5 待定
                      </span>
                    )}
                  </p>
                  <div className="flex gap-2">
                    <button
                      onClick={() => {
                        settle(accepted.id, "forgive");
                        moveDeposit(accepted.id, "refunded");
                        setVerdictMsg((m) => ({
                          ...m,
                          [wave.id]:
                            "已谅解 · 扣 ¥5 轻微处罚，押金全额退回响应者",
                        }));
                        setBreachOpen(null);
                      }}
                      className="flex-1 py-2 rounded-xl bg-emerald-400/15 border border-emerald-400/40 text-emerald-300 text-[10px] font-bold"
                    >
                      谅解 · 轻罚 + 押金退回
                    </button>
                    <button
                      onClick={() => {
                        settle(accepted.id, "unforgiven");
                        moveDeposit(accepted.id, "forfeited");
                        receivePayout(accepted.id);
                        setVerdictMsg((m) => ({
                          ...m,
                          [wave.id]:
                            "不谅解 · 扣 ¥30 + 信用降级 + 额度减半，押金 ¥5 赔付到账",
                        }));
                        setBreachOpen(null);
                      }}
                      className="flex-1 py-2 rounded-xl bg-red-400/15 border border-red-400/40 text-red-300 text-[10px] font-bold"
                    >
                      不谅解 · 重罚 + 押金赔付
                    </button>
                  </div>
                </motion.div>
              )}

              {/* 无人响应 → LLM 诊断建议 */}
              {wave.status === "active" &&
                waveClaims.length === 0 &&
                wave.createdAt < now - 2 * 60_000 && (
                  <div className="rounded-2xl bg-brandPurple/10 border border-brandPurple/30 p-3">
                    <p className="text-[10px] font-bold text-brandPurple flex items-center gap-1">
                      <MessageSquareText size={11} /> AI 建议
                    </p>
                    <p className="text-[10px] text-white/60 mt-1 leading-relaxed">
                      这条需求还没人响应。可考虑：① 把报价提到{" "}
                      {yuan(raiseSuggestion(wave.budget, wave.customs.length))}
                      ；② 补充更清晰的定制条件；③ 扩大 5km 搜寻半径。
                    </p>
                  </div>
                )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, { label: string; cls: string }> = {
    active: { label: "广播中", cls: "bg-brandCyan/15 border-brandCyan/40 text-brandCyan" },
    claimed: { label: "已接单", cls: "bg-emerald-400/15 border-emerald-400/40 text-emerald-300" },
    locked: { label: "已锁定", cls: "bg-purple-400/15 border-purple-400/40 text-purple-200" },
    closed: { label: "已关闭", cls: "bg-white/10 border-white/15 text-white/40" },
    expired: { label: "已失效", cls: "bg-white/10 border-white/15 text-white/40" },
  };
  const s = map[status] ?? map.active!;
  return (
    <span className={`px-2 py-0.5 rounded-full border text-[9px] font-bold ${s.cls}`}>
      {s.label}
    </span>
  );
}

function acceptedReveal(claim: Claim): BlindRevealData {
  return {
    nickname: "神秘响应者",
    creditTier: 4,
    verified: true,
    responseTime: claim.rounds > 0 ? `商议 ${claim.rounds} 轮` : "秒接",
    meta: `${claim.price ? yuan(claim.price) : ""} · 上门服务 · 身份待解锁`,
  };
}

/**
 * 磋商线 — one negotiation pair rendered for the demander:
 * who moved last, who is next, counter-offer box (alternation enforced by
 * the pure layer), accept / withdraw. 3-round budget shown as steps.
 */
function NegotiationThread({
  claim,
  wave,
  onAccept,
  onWithdraw,
  onCounter,
}: {
  claim: Claim;
  wave: Wave;
  onAccept: () => void;
  onWithdraw: () => void;
  onCounter: (p: { price: number; message: string }) => void;
}) {
  const [price, setPrice] = useState(String(claim.price ?? wave.budget));
  const [message, setMessage] = useState("");
  const [sent, setSent] = useState(false);
  const [err, setErr] = useState("");
  const turn = nextSpeaker(claim); // who must move now
  const exhausted = claim.rounds >= MAX_ROUNDS;

  function send() {
    const n = parseInt(price, 10);
    if (!Number.isFinite(n) || n <= 0) {
      setErr("请输入有效金额");
      return;
    }
    setSent(true);
    setErr("");
    onCounter({ price: n, message: message.trim() });
  }

  return (
    <div className="rounded-2xl bg-white/[0.04] border border-white/10 p-3">
      <div className="flex items-center justify-between">
        <span className="text-[11px] font-bold text-brandCyan flex items-center gap-1">
          <MessageSquareText size={11} /> 响应者磋商
          {claim.lastMessage && ` · "${claim.lastMessage.slice(0, 18)}"`}
        </span>
        <span className="text-[9px] text-white/40">
          商议价 {claim.price ? yuan(claim.price) : ""} · 第 {claim.rounds}/{MAX_ROUNDS} 轮
        </span>
      </div>

      {/* 轮次步进 */}
      <div className="flex items-center gap-1 mt-2">
        {Array.from({ length: MAX_ROUNDS }, (_, i) => (
          <span
            key={i}
            className={`h-1 flex-1 rounded-full transition-colors ${
              i < claim.rounds ? "bg-brandPurple" : "bg-white/10"
            }`}
          />
        ))}
        <span
          className={`text-[9px] font-bold ml-1 ${
            turn === "demander" ? "text-brandPurple" : "text-white/40"
          }`}
        >
          {exhausted
            ? "3 轮已满 · 请直接谈成或婉拒"
            : turn === "demander"
              ? "轮到你还价"
              : "等待响应者回应"}
        </span>
      </div>

      {/* 还价输入（轮到需求方且未满 3 轮） */}
      {!exhausted && turn === "demander" && !sent && (
        <div className="mt-2 flex gap-1.5">
          <input
            value={price}
            onChange={(e) => setPrice(e.target.value)}
            inputMode="numeric"
            aria-label="还价金额"
            className="w-20 shrink-0 rounded-xl bg-white/[0.05] border border-white/10 px-2.5 py-1.5 text-[11px] text-white/90 outline-none focus:border-brandPurple/50"
          />
          <input
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            placeholder="回应一句（可空）"
            aria-label="还价留言"
            className="flex-1 min-w-0 rounded-xl bg-white/[0.05] border border-white/10 px-2.5 py-1.5 text-[10.5px] placeholder:text-white/25 text-white/90 outline-none focus:border-brandPurple/50"
          />
          <button
            onClick={send}
            className="px-2.5 rounded-xl bg-brandPurple/20 border border-brandPurple/40 text-brandPurple text-[10px] font-bold shrink-0"
            aria-label="发出还价"
          >
            <Send size={11} />
          </button>
        </div>
      )}
      {err && <p className="text-[9.5px] text-red-400 mt-1">{err}</p>}
      {sent && !exhausted && (
        <p className="text-[9.5px] text-emerald-300 mt-1.5">
          ✓ 已还价，等待响应者回应（下一轮轮到他）
        </p>
      )}

      <div className="flex gap-2 mt-2">
        <button
          onClick={onAccept}
          className="flex-1 py-2 rounded-xl btn-primary text-[10px] font-bold glow-purple-strong"
        >
          谈成 · 锁定
        </button>
        <button
          onClick={onWithdraw}
          className="px-3 py-2 rounded-xl glass-panel text-[10px] text-white/60"
        >
          婉拒
        </button>
      </div>
    </div>
  );
}