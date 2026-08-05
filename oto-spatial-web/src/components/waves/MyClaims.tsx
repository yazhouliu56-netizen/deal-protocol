"use client";
import { useEffect, useMemo, useState } from "react";
import { MessageSquareText, Send, XCircle, Users } from "lucide-react";
import { useWaveStore } from "@/store/useWaveStore";
import { useIdentityStore } from "@/store/useIdentityStore";
import { yuan } from "@/lib/customPricing";
import { MAX_ROUNDS, neededJoiners, nextSpeaker, type Claim, type Wave } from "@/lib/wave";
import { ACTION_LABEL } from "@/lib/moderation";
import type { DepositPhase } from "@/lib/deposit";
import DialCard from "./DialCard";
import ReviewSection from "./ReviewSection";

/**
 * 响应者视角：我接的单（claim story）。
 * 磋商线：等待需求方还价 / 回应还价（counterOffer actor=responder）/ 放弃。
 * 锁定后：一次性虚拟线路拨号卡。
 * 开放局：拼位后等待满员成局（joined），成局后与锁定单同链路。
 */
export default function MyClaims() {
  const waves = useWaveStore((s) => s.waves);
  const claims = useWaveStore((s) => s.claims);
  const counterOffer = useWaveStore((s) => s.counterOffer);
  const withdraw = useWaveStore((s) => s.withdraw);
  const reportDone = useWaveStore((s) => s.reportDone);
  const submitReport = useWaveStore((s) => s.submitReport);
  const identity = useIdentityStore((s) => s.identity);
  const syncDeposit = useIdentityStore((s) => s.syncDeposit);
  const deposits = useIdentityStore((s) => s.deposits);
  const runAutoFulfilments = useWaveStore((s) => s.runAutoFulfilments);
  const reports = useWaveStore((s) => s.reports);

  // 自动放款：72h 未验收的申报在挂载/变更时结算（幂等）
  useEffect(() => {
    runAutoFulfilments();
  }, [runAutoFulfilments]);

  const mine = useMemo(
    () =>
      claims
        .filter((c) => c.responderId === identity.id)
        .map((c) => ({ claim: c, wave: waves.find((w) => w.id === c.waveId) }))
        .filter((x): x is { claim: Claim; wave: Wave } => !!x.wave)
        .sort((a, b) => b.claim.createdAt - a.claim.createdAt),
    [claims, waves, identity]
  );

  // 鸽子险幂等记账：共享 claim 的 phase 驱动本地账户动账
  useEffect(() => {
    mine.forEach(({ claim, wave }) => {
      if (wave.deposit && claim.depositPhase) {
        syncDeposit(claim.id, claim.depositPhase);
      }
    });
  }, [mine, syncDeposit]);

  return (
    <div className="pointer-events-auto">
      <h2 className="text-[18px] font-extrabold text-white/95">我的接单</h2>
      <p className="text-[10px] text-white/45 mb-3">你响应过的信号波 · 抢单制：谁确认算谁的</p>

      {mine.length === 0 && (
        <div className="glass-panel rounded-3xl p-6 text-center">
          <span className="text-2xl">🛎️</span>
          <p className="text-[11px] text-white/50 mt-2">
            还没接过单——去雷达 Feed 找适合你的需求
          </p>
        </div>
      )}

      <div className="flex flex-col gap-3">
        {mine.map(({ claim, wave }) => {
          const turn = nextSpeaker(claim);
          const exhausted = claim.rounds >= MAX_ROUNDS;
          const isLocked =
            (wave.status === "claimed" || wave.status === "assembled") &&
            claim.status !== "withdrawn" &&
            claim.status !== "joined";
          const isJoined = claim.status === "joined";
          const joinedTotal = claims.filter(
            (c) => c.waveId === wave.id && c.status === "joined"
          ).length;

          return (
            <div key={claim.id} className="glass-panel rounded-3xl p-4 space-y-2.5">
              {/* 概要 */}
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <h3 className="text-[13px] font-extrabold truncate">
                    {wave.basics.category}
                    {wave.capacity >= 2 && (
                      <span className="ml-1.5 text-[9px] font-bold px-1.5 py-0.5 rounded-full bg-brandPurple/20 border border-brandPurple/40 text-brandPurple align-middle">
                        🎯 开放局
                      </span>
                    )}
                  </h3>
                  <p className="text-[10px] text-white/50 mt-0.5 truncate">
                    {wave.basics.time} · {wave.basics.area} ·{" "}
                    {claim.price ? yuan(claim.price) : yuan(wave.budget)}
                    {wave.capacity >= 2 && "/人"}
                  </p>
                </div>
                {claim.status === "negotiating" && (
                  <span className="text-[9px] font-bold px-2 py-0.5 rounded-full border shrink-0 bg-brandCyan/15 border-brandCyan/40 text-brandCyan">
                    第 {claim.rounds}/{MAX_ROUNDS} 轮
                  </span>
                )}
                {isJoined && (
                  <span className="text-[9px] font-bold px-2 py-0.5 rounded-full border shrink-0 bg-brandPurple/15 border-brandPurple/40 text-brandPurple">
                    已拼位
                  </span>
                )}
              </div>

              {/* 拼位等待态：等满员成局（可退出） */}
              {isJoined && (
                <div className="rounded-2xl bg-brandPurple/10 border border-brandPurple/25 p-3 space-y-2">
                  <p className="text-[10.5px] font-bold text-brandPurple flex items-center gap-1.5">
                    <Users size={11} /> 已拼位 · 等待满员成局
                  </p>
                  <div className="flex items-center gap-1.5">
                    <div className="flex-1 h-1.5 rounded-full bg-white/10 overflow-hidden">
                      <div
                        className="h-full rounded-full bg-linear-to-r from-brandCyan to-brandPurple"
                        style={{
                          width: `${Math.min(100, (joinedTotal / Math.max(1, neededJoiners(wave))) * 100)}%`,
                        }}
                      />
                    </div>
                    <span className="text-[9px] text-white/50 shrink-0">
                      {Math.min(joinedTotal, neededJoiners(wave))}/{neededJoiners(wave)}
                    </span>
                  </div>
                  <p className="text-[9px] text-white/40">
                    {wave.status === "assembled"
                      ? "需求方已提前成局"
                      : "满员后自动成局；需求方也可提前成局。成局前可随时退出。"}
                  </p>
                  <button
                    onClick={() => withdraw(claim.id)}
                    className="flex items-center gap-1 text-[9.5px] text-white/40 hover:text-red-300 transition-colors"
                  >
                    <XCircle size={10} /> 退出拼位
                  </button>
                </div>
              )}

              {/* 磋商线 */}
              {claim.status === "negotiating" && (
                <ResponderThread
                  claim={claim}
                  wave={wave}
                  exhausted={exhausted}
                  turn={turn}
                  onCounter={(price, message) =>
                    counterOffer({
                      claimId: claim.id,
                      price,
                      message,
                      actor: "responder",
                    })
                  }
                  onWithdraw={() => withdraw(claim.id)}
                />
              )}

              {/* 鸽子险押金状态 */}
              {wave.deposit && (
                <DepositBadge
                  claimId={claim.id}
                  phase={claim.depositPhase}
                  deposits={deposits}
                />
              )}

              {/* 锁定 → 拨号卡 */}
              {isLocked && (
                <DialCard
                  waveId={wave.id}
                  responderId={identity.id}
                  demanderId={wave.authorId}
                  lockedAt={claim.createdAt}
                />
              )}

              {/* 平台治理：举报对方（行为举报 + 处理回执） */}
              {isLocked &&
                (() => {
                  const myRep = reports.find(
                    (r) =>
                      r.reporterId === identity.id &&
                      r.targetId === wave.authorId
                  );
                  if (myRep?.status === "resolved")
                    return (
                      <p className="w-full py-2 rounded-xl text-center text-[9.5px] font-bold text-emerald-300/90">
                        ✓ 平台已处理：{ACTION_LABEL[myRep.action ?? "dismiss"]}
                        {myRep.verdictNote ? `（${myRep.verdictNote}）` : ""}
                      </p>
                    );
                  if (myRep)
                    return (
                      <p className="w-full py-2 rounded-xl text-center text-[9.5px] font-bold text-amber-300/90">
                        ⏳ 已举报，平台核查中
                      </p>
                    );
                  return (
                    <button
                      onClick={() =>
                        submitReport({
                          targetId: wave.authorId,
                          targetType: "responder",
                          reason: "harassment",
                          detail: "对方行为不当",
                          reporterId: identity.id,
                        })
                      }
                      className="w-full py-2 rounded-xl bg-white/[0.04] border border-white/10 text-[9.5px] font-bold text-white/50 hover:text-amber-400 hover:border-amber-400/40"
                    >
                      🚩 举报对方
                    </button>
                  );
                })()}

              {/* 申报完成 → 请求放款（Airtasker 放款闸门） */}
              {isLocked &&
                claim.status === "accepted" &&
                !claim.serviceDoneAt && (
                  <button
                    onClick={() => reportDone(claim.id)}                    aria-label="申报完成"
                    className="w-full py-2.5 rounded-xl bg-emerald-400/12 border border-emerald-400/35 text-[10.5px] font-bold text-emerald-300"
                  >
                    🛎 服务完成 · 请求放款
                  </button>
                )}
              {claim.serviceDoneAt && !claim.fulfilment && (
                <p className="text-[10px] text-emerald-300/90">
                  ✓ 已申报完成 —— 等待需求方验收（72h 自动放款）
                </p>
              )}

              {/* 履约后互评（72h 窗口，脱敏展示） */}
              <ReviewSection
                claim={claim}
                wave={wave}
                myId={identity.id}
                peerId={wave.authorId}
              />

              {/* 终态 */}
              {claim.status === "withdrawn" && (
                <p className="text-[10px] text-white/40">已放弃该单</p>
              )}
              {claim.status === "breached" && (
                <p className="text-[10px] font-bold text-red-300">
                  违约记录 · 已影响信用与额度
                </p>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function ResponderThread({
  claim,
  wave,
  exhausted,
  turn,
  onCounter,
  onWithdraw,
}: {
  claim: Claim;
  wave: Wave;
  exhausted: boolean;
  turn: "responder" | "demander";
  onCounter: (price: number, message: string) => void;
  onWithdraw: () => void;
}) {
  const [price, setPrice] = useState(String(claim.price ?? wave.budget));
  const [message, setMessage] = useState("");
  const [sent, setSent] = useState(false);

  function send() {
    const n = parseInt(price, 10);
    if (!Number.isFinite(n) || n <= 0) return;
    setSent(true);
    onCounter(n, message.trim());
  }

  return (
    <div className="rounded-2xl bg-white/[0.04] border border-white/10 p-3">
      <div className="flex items-center justify-between">
        <span className="text-[11px] font-bold text-brandCyan flex items-center gap-1">
          <MessageSquareText size={11} /> 与需求方磋商中
          {claim.lastMessage && ` · "${claim.lastMessage.slice(0, 18)}"`}
        </span>
        <span className="text-[9px] text-white/40">
          {turn === "responder"
            ? "轮到你回应"
            : "等待需求方还价"}
        </span>
      </div>

      {/* 轮次步进 */}
      <div className="flex items-center gap-1 mt-2">
        {Array.from({ length: MAX_ROUNDS }, (_, i) => (
          <span
            key={i}
            className={`h-1 flex-1 rounded-full ${
              i < claim.rounds ? "bg-brandPurple" : "bg-white/10"
            }`}
          />
        ))}
      </div>

      {!exhausted && turn === "responder" && !sent && (
        <div className="mt-2 flex gap-1.5">
          <input
            value={price}
            onChange={(e) => setPrice(e.target.value)}
            inputMode="numeric"
            aria-label="回应金额"
            className="w-20 shrink-0 rounded-xl bg-white/[0.05] border border-white/10 px-2.5 py-1.5 text-[11px] text-white/90 outline-none focus:border-brandPurple/50"
          />
          <input
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            placeholder="回应一句（可空）"
            aria-label="回应留言"
            className="flex-1 min-w-0 rounded-xl bg-white/[0.05] border border-white/10 px-2.5 py-1.5 text-[10.5px] placeholder:text-white/25 text-white/90 outline-none focus:border-brandPurple/50"
          />
          <button
            onClick={send}
            className="px-2.5 rounded-xl bg-brandPurple/20 border border-brandPurple/40 text-brandPurple text-[10px] font-bold shrink-0"
            aria-label="发出回应"
          >
            <Send size={11} />
          </button>
        </div>
      )}
      {sent && (
        <p className="text-[9.5px] text-emerald-300 mt-1.5">
          ✓ 已回应，等待需求方决策
        </p>
      )}
      {exhausted && (
        <p className="text-[9.5px] text-amber-300/90 mt-1.5">
          3 轮已满 · 等待需求方谈成或婉拒
        </p>
      )}

      <button
        onClick={onWithdraw}
        className="mt-2 flex items-center gap-1 text-[9.5px] text-white/40 hover:text-red-300 transition-colors"
      >
        <XCircle size={10} /> 放弃这单
      </button>
    </div>
  );
}

/** 鸽子险押金状态行（响应者本地账务视角）。 */
function DepositBadge({
  claimId,
  phase,
  deposits,
}: {
  claimId: string;
  phase: DepositPhase | undefined;
  deposits: { claimId: string; phase: DepositPhase }[];
}) {
  const local = deposits.find((d) => d.claimId === claimId);
  const eff = local?.phase ?? phase;
  if (!eff) return null;
  const map: Record<DepositPhase, { text: string; cls: string }> = {
    held: {
      text: "🕊️ 押金已冻结 ¥5（履约后退回）",
      cls: "bg-sky-400/10 border-sky-400/30 text-sky-300",
    },
    confirmed: {
      text: "✅ 押金已解冻退回（含平台服务费 ¥0.5）",
      cls: "bg-emerald-400/10 border-emerald-400/30 text-emerald-300",
    },
    forfeited: {
      text: "🕊️ 押金已没收（赔付给需求方）",
      cls: "bg-red-400/10 border-red-400/30 text-red-300",
    },
    refunded: {
      text: "✅ 押金已全额退回（需求方谅解）",
      cls: "bg-emerald-400/10 border-emerald-400/30 text-emerald-300",
    },
  };
  const s = map[eff];
  return (
    <p className={`text-[9.5px] font-bold px-2.5 py-1.5 rounded-xl border ${s.cls}`}>
      {s.text}
    </p>
  );
}