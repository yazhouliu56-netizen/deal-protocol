"use client";
import { useEffect, useMemo, useState } from "react";
import { MessageSquareText, Send, XCircle, Users } from "lucide-react";
import { useWaveStore } from "@/store/useWaveStore";
import { useIdentityStore } from "@/store/useIdentityStore";
import { yuan } from "@/base/money/customPricing";
import { MAX_ROUNDS, neededJoiners, nextSpeaker, type Claim, type Wave } from "@/base/order/wave";
import { ACTION_LABEL } from "@/base/risk/moderation";
import type { DepositPhase } from "@/base/money/deposit";
import DialCard from "./DialCard";
import ContactCard from "./ContactCard";
import ReviewSection from "./ReviewSection";
import DuoButton from "@/components/ui/DuoButton";
import ConfirmSheet from "@/components/ui/ConfirmSheet";
import DuoEmpty from "@/components/oto-ui/DuoEmpty";
import DuoPill from "@/components/ui/DuoPill";
import { useAppStore } from "@/store/useAppStore";
import { confirmedCount } from "@/base/order/moduleFulfilment";
import { visibleGuests } from "@/base/order/guest";
import GenericOrderCard from "./GenericOrderCard";

/**
 * 响应者视角：我接的单（claim story）。
 * 磋商线：等待需求方还价 / 回应还价（counterOffer actor=responder）/ 放弃。
 * 锁定后：一次性虚拟线路拨号卡。
 * 多人拼单局：拼位后等待满员成局（joined），成局后与锁定单同链路。
 */
export default function MyClaims() {
  const waves = useWaveStore((s) => s.waves);
  const claims = useWaveStore((s) => s.claims);
  const counterOffer = useWaveStore((s) => s.counterOffer);
  const withdraw = useWaveStore((s) => s.withdraw);
  const reportDone = useWaveStore((s) => s.reportDone);
  const submitReport = useWaveStore((s) => s.submitReport);
  const withdrawReport = useWaveStore((s) => s.withdrawReport);
  const identity = useIdentityStore((s) => s.identity);
  const syncDeposit = useIdentityStore((s) => s.syncDeposit);
  const setScreen = useAppStore((s) => s.setScreen);
  const deposits = useIdentityStore((s) => s.deposits);
  const runAutoFulfilments = useWaveStore((s) => s.runAutoFulfilments);
  const settleExpiredOpen = useWaveStore((s) => s.settleExpiredOpen);
  const reportModuleDone = useWaveStore((s) => s.reportModuleDone);
  const reports = useWaveStore((s) => s.reports);
  const leaveWaitlist = useWaveStore((s) => s.leaveWaitlist);
  const addGuest = useWaveStore((s) => s.addGuest);
  const removeGuest = useWaveStore((s) => s.removeGuest);
  // 举报二次确认：待确认的目标 authorId（null = 未弹层）
  const [reportConfirmId, setReportConfirmId] = useState<string | null>(null);

  // 自动放款：72h 未验收的申报在挂载/变更时结算（幂等）；顺带结算到期未成局的多人拼单局退款
  // waves 依赖：transport 降级恢复异步（首帧空 → degrade 回灌），数据迟到时补跑
  useEffect(() => {
    runAutoFulfilments();
    settleExpiredOpen();
  }, [runAutoFulfilments, settleExpiredOpen, waves]);

  // 我的候补：多人拼单局满员后排队（wave.waitlist 按加入顺序，有人退出自动补位）
  const myWaitlist = useMemo(
    () =>
      waves
        .filter(
          (w) =>
            w.status === "active" && (w.waitlist ?? []).some((r) => r.responderId === identity.id)
        )
        .map((w) => ({
          wave: w,
          pos: (w.waitlist ?? []).findIndex((r) => r.responderId === identity.id) + 1,
          total: (w.waitlist ?? []).length,
        }))
        .sort((a, b) => a.pos - b.pos),
    [waves, identity]
  );

  const mine = useMemo(
    () =>
      claims
        .filter((c) => c.responderId === identity.id)
        .map((c) => ({ claim: c, wave: waves.find((w) => w.id === c.waveId) }))
        .filter((x): x is { claim: Claim; wave: Wave } => !!x.wave)
        .sort((a, b) => b.claim.createdAt - a.claim.createdAt),
    [claims, waves, identity]
  );

  // 爽约保障险幂等记账：共享 claim 的 phase 驱动本地账户动账
  useEffect(() => {
    mine.forEach(({ claim, wave }) => {
      if (wave.deposit && claim.depositPhase) {
        syncDeposit(claim.id, claim.depositPhase);
      }
    });
  }, [mine, syncDeposit]);

  return (
    <div className="pointer-events-auto">
      <h2 className="text-[18px] font-extrabold text-[var(--color-duo-eel)]">我的接单</h2>
      <p className="text-xs text-[var(--color-duo-wolf)] mb-3">你响应过的信号波 · 抢单制：谁确认算谁的</p>

      {/* 候补队列：满员局排队中（有人退出自动补位转正） */}
      {myWaitlist.length > 0 && (
        <div className="flex flex-col gap-3 mb-3">
          {myWaitlist.map(({ wave, pos, total }) => (
            <div
              key={wave.id}
              className="bg-white border-2 border-[var(--color-duo-swan)] border-b-[6px] rounded-3xl p-4 border-[var(--color-duo-yellow-dark)]/50"
            >
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <h3 className="text-[13px] font-extrabold truncate">
                    {wave.basics.category}
                  </h3>
                  <p className="text-xs text-[var(--color-duo-hare)] mt-0.5 truncate">
                    {wave.basics.time} · {wave.basics.area} ·{" "}
                    {yuan(wave.budget)}
                    {wave.capacity >= 2 && "/人"}
                  </p>
                </div>
                <span className="text-xs font-bold px-2 py-0.5 rounded-full border-2 shrink-0 bg-[var(--color-duo-yellow)]/10 border-[var(--color-duo-yellow-dark)]/50 text-[var(--color-duo-yellow-ink)]">
                  候补中
                </span>
              </div>
              <div className="rounded-2xl bg-[var(--color-duo-yellow)]/[.06] border-2 border-[var(--color-duo-yellow-dark)]/50 p-3 mt-2.5 space-y-2">
                <p className="text-xs font-bold text-[var(--color-duo-yellow-ink)] flex items-center gap-1.5">
                  <Users size={11} /> 候补 · 第 {pos}/{total} 位
                </p>
                <p className="text-xs text-[var(--color-duo-hare)]">
                  满员排队中：有人退出拼位时按顺序自动补位转正（转正即扣拼位份额）。补位成功会收到通知，也可随时退出候补。
                </p>
                <button
                  onClick={() => leaveWaitlist({ waveId: wave.id, responderId: identity.id })}
                  className="flex items-center gap-1 text-xs text-[var(--color-duo-hare)] hover:text-[var(--color-duo-red)] transition-colors"
                >
                  <XCircle size={10} /> 退出候补
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {mine.length === 0 && (
        <DuoEmpty
          mascot="beast-empty"
          desc="还没接过单——去雷达 Feed 找适合你的需求"
          action="去雷达看看"
          onAction={() => setScreen("home")}
          testId="myclaims-empty-state"
          launchTestId="myclaims-empty-launch"
        />
      )}

      <div className="flex flex-col gap-3">
        {mine.map(({ claim, wave }) => {
          const turn = nextSpeaker(claim);
          const exhausted = claim.rounds >= MAX_ROUNDS;
          const isLocked =
            // wave.status 镜像可能被远端旧快照覆盖回退（active），
            // claim.status === "accepted" 是接单事实源 → 照常进入履约流
            (wave.status === "claimed" ||
              wave.status === "assembled" ||
              claim.status === "accepted") &&
            claim.status !== "withdrawn" &&
            claim.status !== "joined";
          const isJoined = claim.status === "joined";
          const joinedTotal = claims.filter(
            (c) => c.waveId === wave.id && c.status === "joined"
          ).length;

          return (
            <GenericOrderCard key={claim.id} waveId={wave.id}>
              {/* 概要 */}
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <h3 className="text-[13px] font-extrabold truncate">
                    {wave.basics.category}
                    {wave.capacity >= 2 && (
                      <DuoPill tone="yellow" className="ml-1.5 align-middle">
                        🎯 多人拼单局
                      </DuoPill>
                    )}
                  </h3>
                  <p className="text-xs text-[var(--color-duo-hare)] mt-0.5 truncate">
                    {wave.basics.time} · {wave.basics.area} ·{" "}
                    {claim.price ? yuan(claim.price) : yuan(wave.budget)}
                    {wave.capacity >= 2 && "/人"}
                  </p>
                </div>
                {claim.status === "negotiating" && (
                  <span className="text-xs font-bold px-2 py-0.5 rounded-full border-2 shrink-0 bg-[var(--color-duo-blue)]/10 border-[var(--color-duo-blue)]/40 text-[var(--color-duo-blue-ink)]">
                    第 {claim.rounds}/{MAX_ROUNDS} 轮
                  </span>
                )}
                {isJoined && (
                  <span className="text-xs font-bold px-2 py-0.5 rounded-full border-2 shrink-0 bg-[var(--color-duo-green)]/10 border-[var(--color-duo-green)]/40 text-[var(--color-duo-green-ink)]">
                    已拼位
                  </span>
                )}
              </div>

              {/* 拼位等待态：等满员成局（可退出） */}
              {isJoined && (
                <div className="rounded-2xl bg-[var(--color-duo-blue)]/[.06] border-2 border-[var(--color-duo-blue)]/40 p-3 space-y-2">
                  <p className="text-xs font-bold text-[var(--color-duo-blue-ink)] flex items-center gap-1.5">
                    <Users size={11} /> 已拼位 · 等待满员成局
                  </p>
                  <div className="flex items-center gap-1.5">
                    <div className="flex-1 h-1.5 rounded-full bg-[var(--color-duo-swan)] overflow-hidden">
                      <div
                        className="h-full rounded-full bg-[var(--color-duo-green)]"
                        style={{
                          width: `${Math.min(100, (joinedTotal / Math.max(1, neededJoiners(wave))) * 100)}%`,
                        }}
                      />
                    </div>
                    <span className="text-xs text-[var(--color-duo-hare)] shrink-0">
                      {Math.min(joinedTotal, neededJoiners(wave))}/{neededJoiners(wave)}
                    </span>
                  </div>
                  <p className="text-xs text-[var(--color-duo-hare)]">
                    {wave.status === "assembled"
                      ? "需求方已提前成局"
                      : wave.status === "expired"
                        ? "本局已失效（拼满前过期）—— 已自动全额退回拼位费"
                        : "满员后自动成局；需求方也可提前成局。成局前可随时退出。"}
                  </p>
                  <button
                    onClick={() => withdraw(claim.id)}
                    className="flex items-center gap-1 text-xs text-[var(--color-duo-hare)] hover:text-[var(--color-duo-red)] transition-colors"
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

              {/* 爽约保障险押金状态 */}
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

              {/* ADR-0010：隐私号 + 私信中枢 */}
              {isLocked && (
                <ContactCard waveId={wave.id} peerId={wave.authorId} />
              )}

              {/* 候补补位配套：成局后让位（履约开始前）→ 席位释放，候补首位自动转正 */}
              {isLocked && wave.capacity >= 2 && !claim.serviceDoneAt && (
                <div className="rounded-2xl bg-[var(--color-duo-polar)] border border-[var(--color-duo-swan)] p-2.5 flex items-center justify-between gap-2">
                  <p className="text-xs text-[var(--color-duo-hare)] flex items-center gap-1">
                    <Users size={9} /> 成局后需退出？让位给候补者（按 24h 档位退拼位份额）
                  </p>
                  <button
                    onClick={() => withdraw(claim.id)}
                    className="shrink-0 flex items-center gap-1 text-xs text-[var(--color-duo-hare)] hover:text-[var(--color-duo-red)] transition-colors"
                  >
                    <XCircle size={10} /> 让位退出
                  </button>
                </div>
              )}

              {/* Meetup 吸收项 ⑤：+1 携伴登记（实名 + ageGate 合规 + 电话脱敏） */}
              {isLocked && wave.capacity >= 2 && !claim.serviceDoneAt && (
                <GuestSection
                  claim={claim}
                  onAdd={(guest) => addGuest({ claimId: claim.id, guest })}
                  onRemove={(idx) => removeGuest(claim.id, idx)}
                />
              )}

              {/* ADR-0012 履约保险（N7）：投保 ¥X · 违约自动理赔给需求方 */}
              {isLocked && !claim.serviceDoneAt && (
                <InsureBar claim={claim} wave={wave} />
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
                      <p className="w-full py-2 rounded-xl text-center text-xs font-bold text-[var(--color-duo-green-ink)]">
                        ✓ 平台已处理：{ACTION_LABEL[myRep.action ?? "dismiss"]}
                        {myRep.verdictNote ? `（${myRep.verdictNote}）` : ""}
                      </p>
                    );
                  if (myRep?.status === "withdrawn")
                    return (
                      <button
                        onClick={() => setReportConfirmId(wave.authorId)}
                        className="w-full py-2 rounded-xl bg-[var(--color-duo-polar)] border-2 border-[var(--color-duo-swan)] text-xs font-bold text-[var(--color-duo-hare)] hover:text-[var(--color-duo-yellow-ink)] hover:border-[var(--color-duo-yellow-dark)]/60"
                      >
                        🚩 重新举报（上次已撤回）
                      </button>
                    );
                  if (myRep)
                    return (
                      <div className="w-full py-2 rounded-xl text-center">
                        <span className="text-xs font-bold text-[var(--color-duo-yellow-ink)]">
                          ⏳ 已举报，平台核查中
                        </span>
                        {!myRep.auto && (
                          <button
                            type="button"
                            onClick={() => withdrawReport(myRep.id, identity.id)}
                            data-testid="withdraw-report"
                            className="ml-2 text-xs font-bold text-[var(--color-duo-hare)] underline underline-offset-2"
                          >
                            撤回
                          </button>
                        )}
                      </div>
                    );
                  return (
                    <button
                      onClick={() => setReportConfirmId(wave.authorId)}
                      className="w-full py-2 rounded-xl bg-[var(--color-duo-polar)] border-2 border-[var(--color-duo-swan)] text-xs font-bold text-[var(--color-duo-hare)] hover:text-[var(--color-duo-yellow-ink)] hover:border-[var(--color-duo-yellow-dark)]/60"
                    >
                      🚩 举报对方
                    </button>
                  );
                })()}

              {/* 举报二次确认（Batch②） */}
              {reportConfirmId != null && (
                <ConfirmSheet
                  title="确认举报对方？"
                  body="举报将进入平台核查；请确认对方确有不当行为，误报会打扰对方。"
                  confirmLabel="确认举报"
                  onConfirm={() => {
                    submitReport({
                      targetId: reportConfirmId,
                      targetType: "responder",
                      reason: "harassment",
                      detail: "对方行为不当",
                      reporterId: identity.id,
                    });
                    setReportConfirmId(null);
                  }}
                  onCancel={() => setReportConfirmId(null)}
                />
              )}

              {/* 申报完成 → 请求放款（Airtasker 放款闸门） */}
              {isLocked &&
                claim.status === "accepted" &&
                !claim.serviceDoneAt &&
                !claim.modules && (
                  <DuoButton
                    onClick={() => reportDone(claim.id)}                    aria-label="申报完成"
                    variant="primary"
                    size="sm"
                    sound="correct"
                    fullWidth
                  >
                    🛎 服务完成 · 请求放款
                  </DuoButton>
                )}
              {isLocked &&
                claim.status === "accepted" &&
                claim.modules && (
                  <div className="space-y-1.5">
                    <p className="text-xs font-bold text-[var(--color-duo-wolf)]">
                      🔍 模块化交付（{confirmedCount(claim)}/{claim.modules.length} 已确认）
                    </p>
                    {claim.modules.map((m, i) => (
                      <button
                        key={i}
                        onClick={() => m.status === "pending" && reportModuleDone(claim.id, i)}
                        disabled={m.status !== "pending"}
                        aria-label={`申报模块 ${wave.modules?.[i]?.name ?? `模块${i + 1}`} 完成`}
                        className={`w-full py-1.5 rounded-xl border-2 text-xs font-bold transition-colors ${
                          m.status === "pending"
                            ? "bg-[var(--color-duo-green)]/10 border-[var(--color-duo-green)]/40 text-[var(--color-duo-green-ink)]"
                            : "bg-[var(--color-duo-polar)] border-[var(--color-duo-swan)] text-[var(--color-duo-hare)]"
                        }`}
                      >
                        {m.status === "pending"
                          ? `📦 申报「${wave.modules?.[i]?.name ?? `模块${i + 1}`}」完成`
                          : m.status === "done"
                          ? `⏳「${wave.modules?.[i]?.name ?? `模块${i + 1}`}」已申报，待需求方确认`
                          : `✓「${wave.modules?.[i]?.name ?? `模块${i + 1}`}」已确认放款`}
                      </button>
                    ))}
                  </div>
                )}
              {claim.serviceDoneAt && !claim.fulfilment && !claim.modules && (
                <p className="text-xs text-[var(--color-duo-green-ink)]">
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
              <ResponderDispute claim={claim} />

              {/* 终态 */}
              {claim.status === "withdrawn" && (
                <p className="text-xs text-[var(--color-duo-hare)]">已放弃该单</p>
              )}
              {claim.status === "breached" && (
                <p className="text-xs font-bold text-[var(--color-duo-red-dark)]">
                  违约记录 · 已影响信用与额度
                </p>
              )}
            </GenericOrderCard>
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
    <div className="rounded-2xl bg-[var(--color-duo-polar)] border-2 border-[var(--color-duo-swan)] p-3">
      <div className="flex items-center justify-between">
        <span className="text-xs font-bold text-[var(--color-duo-blue-ink)] flex items-center gap-1">
          <MessageSquareText size={11} /> 与需求方磋商中
          {claim.lastMessage && ` · "${claim.lastMessage.slice(0, 18)}"`}
        </span>
        <span className="text-xs text-[var(--color-duo-hare)]">
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
              i < claim.rounds ? "bg-[var(--color-duo-green)]" : "bg-[var(--color-duo-swan)]"
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
            className="w-20 shrink-0 rounded-xl bg-white border-2 border-[var(--color-duo-swan)] px-2.5 py-1.5 text-xs text-[var(--color-duo-eel)] outline-none focus:border-[var(--color-duo-green)]"
          />
          <input
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            placeholder="回应一句（可空）"
            aria-label="回应留言"
            className="flex-1 min-w-0 rounded-xl bg-white border-2 border-[var(--color-duo-swan)] px-2.5 py-1.5 text-xs placeholder:text-[var(--color-duo-hare)] text-[var(--color-duo-eel)] outline-none focus:border-[var(--color-duo-green)]"
          />
          <DuoButton variant="secondary" size="sm" sound="click" onClick={send} aria-label="发出回应" className="shrink-0">
            <Send size={11} />
          </DuoButton>
        </div>
      )}
      {sent && (
        <p className="text-xs text-[var(--color-duo-green-ink)] mt-1.5">
          ✓ 已回应，等待需求方决策
        </p>
      )}
      {exhausted && (
        <p className="text-xs text-[var(--color-duo-yellow-ink)] mt-1.5">
          3 轮已满 · 等待需求方谈成或婉拒
        </p>
      )}

      <button
        onClick={onWithdraw}
        className="mt-2 flex items-center gap-1 text-xs text-[var(--color-duo-hare)] hover:text-[var(--color-duo-red)] transition-colors"
      >
        <XCircle size={10} /> 放弃这单
      </button>
    </div>
  );
}

/** 爽约保障险押金状态行（响应者本地账务视角）。 */
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
      cls: "bg-[var(--color-duo-blue)]/10 border-[var(--color-duo-blue)]/40 text-[var(--color-duo-blue-ink)]",
    },
    confirmed: {
      text: "✅ 押金已解冻退回（含平台服务费 ¥0.5）",
      cls: "bg-[var(--color-duo-green)]/10 border-[var(--color-duo-green)]/40 text-[var(--color-duo-green-ink)]",
    },
    forfeited: {
      text: "🕊️ 押金已没收（赔付给需求方）",
      cls: "bg-[var(--color-duo-red)]/10 border-[var(--color-duo-red)]/40 text-[var(--color-duo-red-dark)]",
    },
    refunded: {
      text: "✅ 押金已全额退回（需求方谅解）",
      cls: "bg-[var(--color-duo-green)]/10 border-[var(--color-duo-green)]/40 text-[var(--color-duo-green-ink)]",
    },
  };
  const s = map[eff];
  return (
    <p className={`text-xs font-bold px-2.5 py-1.5 rounded-xl border-2 ${s.cls}`}>
      {s.text}
    </p>
  );
}

/** 响应者视角的争议处理：看到自动档位，可提出协商比例（响应者发起，需求方决定）。 */
function ResponderDispute({ claim }: { claim: Claim }) {
  const disputes = useWaveStore((s) => s.disputes);
  const settleDispute = useWaveStore((s) => s.settleDispute);
  const d = disputes.find((x) => x.claimId === claim.id);
  if (!d || d.outcome) return null;
  return (
    <div className="rounded-2xl bg-[var(--color-duo-yellow)]/[.06] border-2 border-[var(--color-duo-yellow-dark)]/50 p-2.5 space-y-1.5">
      <p className="text-xs font-bold text-[var(--color-duo-yellow-ink)]">
        ⚖️ 需求方发起了争议：{d.verdict.label}
      </p>
      <p className="text-xs text-[var(--color-duo-wolf)]">凭证：{d.evidence}</p>
      <DuoButton
        variant="secondary"
        size="sm"
        sound="click"
        fullWidth
        onClick={() =>
          settleDispute({
            claimId: claim.id,
            proposedPct: d.verdict.money.type === "negotiate" ? d.verdict.money.maxPct : 0,
            willAccept: true,
            note: "响应者提出协商方案",
          })
        }
      >
        {d.verdict.money.type === "negotiate"
          ? `提出协商：退 ${d.verdict.money.maxPct}% 结案`
          : "接受判定结案"}
      </DuoButton>
    </div>
  );
}

/**
 * Meetup 吸收项 ⑤：+1 携伴登记（实名 + ageGate 合规 + 电话脱敏展示）。
 * 座位锁定后（多人拼单局）可登记 1 位携伴；展示一律脱敏（宪法 #8）。
 */
function GuestSection({
  claim,
  onAdd,
  onRemove,
}: {
  claim: Claim;
  onAdd: (guest: { name: string; birthYear?: number; guardianConsent?: boolean; phone?: string }) => { ok: boolean; error?: string };
  onRemove: (idx: number) => void;
}) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [birthYear, setBirthYear] = useState("");
  const [phone, setPhone] = useState("");
  const [consent, setConsent] = useState(true);
  const [err, setErr] = useState("");
  const guests = visibleGuests(claim);

  const submit = () => {
    setErr("");
    const r = onAdd({
      name,
      ...(birthYear.trim() ? { birthYear: Number(birthYear) } : {}),
      ...(phone.trim() ? { phone: phone.trim() } : {}),
      guardianConsent: consent,
    });
    if (!r.ok) {
      setErr(r.error ?? "guest.add-failed");
      return;
    }
    setName("");
    setBirthYear("");
    setPhone("");
    setConsent(true);
    setOpen(false);
  };

  return (
    <div className="rounded-2xl bg-[var(--color-duo-polar)] border border-[var(--color-duo-swan)] overflow-hidden">
      <button
        onClick={() => setOpen((v) => !v)}
        className="w-full px-2.5 py-2 flex items-center justify-between hover:bg-[var(--color-duo-polar)] transition-colors"
        aria-expanded={open}
        aria-label="+1 携伴登记"
      >
        <span className="text-xs font-bold text-[var(--color-duo-wolf)] flex items-center gap-1.5">
          👥 +1 携伴
          {guests.length > 0 && (
            <DuoPill tone="blue">
              {guests.length} 位已登记
            </DuoPill>
          )}
        </span>
        <span className="text-xs text-[var(--color-duo-blue-ink)]">{open ? "收起 ▴" : guests.length > 0 ? `已登记：${guests[0].name}` : "登记 ▾"}</span>
      </button>
      {guests.length > 0 && (
        <div className="px-2.5 pb-2 flex items-center justify-between gap-2">
          <p className="text-xs text-[var(--color-duo-hare)] truncate">
            {guests[0].name}
            {guests[0].birthYear ? ` · ${guests[0].birthYear} 年生` : ""}
            {guests[0].phoneMask ? ` · ${guests[0].phoneMask}` : ""}
            {guests[0].birthYear != null &&
              new Date().getFullYear() - guests[0].birthYear < 14 && (
                <span className="text-[var(--color-duo-yellow-ink)]"> · 监护人同意在册</span>
              )}
          </p>
          <button
            onClick={() => onRemove(0)}
            className="shrink-0 text-xs font-bold text-[var(--color-duo-hare)] hover:text-[var(--color-duo-red)] transition-colors"
          >
            移除
          </button>
        </div>
      )}
      {open && (
        <div className="px-2.5 pb-2.5 space-y-1.5 border-t border-[var(--color-duo-swan)] pt-2">
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="携伴者称呼（必填）"
            maxLength={12}
            className="w-full px-2.5 py-1.5 rounded-xl bg-white border-2 border-[var(--color-duo-swan)] text-xs placeholder:text-[var(--color-duo-hare)] focus:outline-none focus:border-[var(--color-duo-blue)]"
          />
          <div className="flex gap-1.5">
            <input
              value={birthYear}
              onChange={(e) => setBirthYear(e.target.value)}
              placeholder="出生年（可填）"
              inputMode="numeric"
              maxLength={4}
              className="w-1/2 px-2.5 py-1.5 rounded-xl bg-white border-2 border-[var(--color-duo-swan)] text-xs placeholder:text-[var(--color-duo-hare)] focus:outline-none focus:border-[var(--color-duo-blue)]"
            />
            <input
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="联系方式（脱敏展示）"
              inputMode="tel"
              maxLength={11}
              className="w-1/2 px-2.5 py-1.5 rounded-xl bg-white border-2 border-[var(--color-duo-swan)] text-xs placeholder:text-[var(--color-duo-hare)] focus:outline-none focus:border-[var(--color-duo-blue)]"
            />
          </div>
          <label className="flex items-center gap-1.5 text-xs text-[var(--color-duo-hare)]">
            <input
              type="checkbox"
              checked={consent}
              onChange={(e) => setConsent(e.target.checked)}
              className="accent-[var(--color-duo-blue)]"
            />
            携伴者不满 14 周岁已获监护人同意（《未保法》§72）
          </label>
          {err && (
            <p className="text-xs font-bold text-[var(--color-duo-red)]">
              {err.includes("age-blocked")
                ? err.replace("guest.age-blocked:", "拦截：")
                : err === "guest.limit-reached"
                  ? "每位拼位者最多携带 1 位携伴"
                  : "携伴登记失败，请重试"}
            </p>
          )}
          <DuoButton variant="secondary" size="sm" sound="click" fullWidth onClick={submit}>
            登记携伴
          </DuoButton>
        </div>
      )}
    </div>
  );
}

/**
 * ADR-0012 履约保险（N7）：座位锁定后可投保（保费 = 座价 10%，保额 = 座价）。
 * 投保扣保费走本人钱包账本；违约 no-show 时保单自动理赔给需求方。
 */
function InsureBar({ claim, wave }: { claim: Claim; wave: Wave }) {
  const policies = useWaveStore((s) => s.policies);
  const insureClaim = useWaveStore((s) => s.insureClaim);
  const identity = useIdentityStore((s) => s.identity);
  const [msg, setMsg] = useState("");
  const pol = policies.find(
    (p) => p.waveId === wave.id && p.holderId === claim.responderId
  );
  const seatPrice = claim.price ?? 0;

  if (pol) {
    return (
      <p
        className={`text-xs font-bold px-2.5 py-1.5 rounded-xl border-2 ${
          pol.claimed
            ? "bg-[var(--color-duo-green)]/10 border-[var(--color-duo-green)]/40 text-[var(--color-duo-green-ink)]"
            : "bg-[var(--color-duo-blue)]/10 border-[var(--color-duo-blue)]/40 text-[var(--color-duo-blue-ink)]"
        }`}
      >
        🛡️ 履约保险：{pol.claimed
          ? `已理赔 ¥${pol.amount}（违约赔付已给需求方）`
          : `保单有效 · 保费 ¥${pol.premium} · 保额 ¥${pol.amount}`}
      </p>
    );
  }
  const premium = Math.max(1, Math.round(seatPrice * 0.1));
  return (
    <div className="rounded-2xl bg-[var(--color-duo-polar)] border-2 border-[var(--color-duo-swan)] p-2.5">
      <p className="text-xs text-[var(--color-duo-wolf)] mb-1.5">
        🛡️ 履约保险：投保 ¥{premium} · 违约自动赔需求方 ¥{seatPrice}
        （护航出勤承诺，双方安心）
      </p>
      <DuoButton
        variant="secondary"
        size="sm"
        sound="click"
        fullWidth
        onClick={() => {
          setMsg("");
          const r = insureClaim({ claimId: claim.id, initiatorId: identity.id });
          if (!r.ok) setMsg("投保失败（可能已投保或座位未锁定）");
        }}
      >
        投保履约保险
      </DuoButton>
      {msg && <p className="text-xs font-bold text-[var(--color-duo-red)] mt-1">{msg}</p>}
    </div>
  );
}