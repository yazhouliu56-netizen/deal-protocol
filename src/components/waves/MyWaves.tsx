"use client";
import { useEffect, useMemo, useState, useSyncExternalStore } from "react";
import { motion } from "framer-motion";
import { MessageSquareText, AlertTriangle, HelpCircle, Send, Flag, Users, Gavel, Shield } from "lucide-react";
import { useWaveStore } from "@/store/useWaveStore";
import { useIdentityStore } from "@/store/useIdentityStore";
import { ACTION_LABEL } from "@/base/risk/moderation";
import { yuan } from "@/base/money/customPricing";
import { MAX_ROUNDS, neededJoiners, nextSpeaker, perSeatPrice, type Claim, type Wave } from "@/base/order/wave";
import { tierRatio } from "@/base/trust/trust";
import { autoFulfilmentRemaining } from "@/base/order/fulfilment";
import type { BlindRevealData } from "./BlindReveal";
import BlindReveal from "./BlindReveal";
import DialCard from "./DialCard";
import ReviewSection from "./ReviewSection";
import AcceptancePanel from "./AcceptancePanel";
import ShareKit from "./ShareKit";
import DiagnosisCard from "./DiagnosisCard";
import AttendancePanel from "./AttendancePanel";

/**
 * 需求方视角：我发出的信号波 + 接单状态 + 磋商往来 + 违约裁决。
 * 待接单者队列不呈现；已接单者呈现（脱敏 + 信用 + 盲盒揭晓）。
 */
export default function MyWaves() {
  const waves = useWaveStore((s) => s.waves);
  const claims = useWaveStore((s) => s.claims);
  const acceptClaim = useWaveStore((s) => s.acceptClaim);
const assembleWave = useWaveStore((s) => s.assembleWave);
  const decideRequest = useWaveStore((s) => s.decideRequest);
  const counterOffer = useWaveStore((s) => s.counterOffer);
  const withdraw = useWaveStore((s) => s.withdraw);
  const closeWave = useWaveStore((s) => s.closeWave);
  const cancelOpenWave = useWaveStore((s) => s.cancelOpenWave);
  const runAutoFulfilments = useWaveStore((s) => s.runAutoFulfilments);
  const settleExpiredOpen = useWaveStore((s) => s.settleExpiredOpen);
  const initiatorBuffs = useWaveStore((s) => s.initiatorBuffs);
  const identity = useIdentityStore((s) => s.identity);
  // SSR/首帧同构探针（page.tsx 同款 idiom）：首帧 now=0 两端一致防 Hydration Mismatch，
  // 挂载后立即采样真实时钟（render 期零时钟采样，红线 1）。
  const mounted = useSyncExternalStore(
    () => () => {},
    () => true,
    () => false
  );
  const [now, setNow] = useState(0);
  useEffect(() => {
    if (!mounted) return;
    const immediate = window.setTimeout(() => setNow(Date.now()), 0);
    return () => window.clearTimeout(immediate);
  }, [mounted]);

  const myBuffs = initiatorBuffs[identity.id] ?? 0;

  // 自动放款：72h 未验收的申报在挂载/变更时结算（幂等）；顺带结算到期未成局的多人拼单局退款
  // waves 依赖：transport 降级恢复是异步的（首帧空 → degrade 后回灌），
  // 若挂载时数据未到位，靠 waves 变化触发补跑，避免过期局漏结算（E2E flaky）
  useEffect(() => {
    runAutoFulfilments();
    settleExpiredOpen();
  }, [runAutoFulfilments, settleExpiredOpen, waves]);

  const cancelRefundLabel = (wave: Wave) => {
    if (wave.status !== "active") return "";
    // 无 startsAt（老数据）按 B 方案：无人拼位=全退，已成局=不退
    if (wave.startsAt === undefined || !Number.isFinite(wave.startsAt)) {
      const hasSeats = claims.some(
        (c) => c.waveId === wave.id && c.status === "accepted"
      );
      return hasSeats ? "取消不退（已有人拼位）" : "取消 · 未成局全额退";
    }
    const t = tierRatio(wave.startsAt, now);
    return t.tier === "none" ? "取消不退" : `取消 · ${t.label}`;
  };

  function onCancel(wave: Wave) {
    if (wave.capacity >= 2) {
      cancelOpenWave(wave.id);
    } else {
      closeWave(wave.id);
    }
  }

  const mine = useMemo(
    () =>
      waves
        .filter((w) => w.authorId === identity.id)
        .sort((a, b) => b.createdAt - a.createdAt),
    [waves, identity]
  );

  return (
    <div className="pointer-events-auto">
      {/* G-5 访客引导：演示身份说明 + 数据模式入口（EnvBadge 由全局事件唤起） */}
      <div className="flex items-center gap-2 px-3 py-2 rounded-2xl bg-brandPurple/[0.08] border border-brandPurple/25 mb-3">
        <span className="text-xs">💠</span>
        <p className="flex-1 min-w-0 text-xs text-white/55 leading-snug">
          访客演示模式 · 身份<span className="text-white/85 font-bold">{identity.nickname}</span>
          ，数据存本机浏览器
        </p>
        <button
          onClick={() => window.dispatchEvent(new Event("oto:env-info"))}
          aria-label="了解数据模式"
          className="shrink-0 px-2 py-1 rounded-full bg-white/5 border border-white/10 text-xs font-bold text-brandPurple-foreground hover:bg-white/10 transition-colors"
        >
          数据模式
        </button>
      </div>

      <h2 className="text-[18px] font-extrabold text-white/95">我的需求</h2>
      <p className="text-xs text-white/45 mb-3">你发出的信号波 · 谁接单算谁的</p>

      {myBuffs > 0 && (
        <p className="mb-3 px-3 py-2 rounded-2xl bg-emerald-400/10 border border-emerald-400/35 text-xs font-bold text-emerald-300 flex items-center gap-1.5">
          ✨ 持有 {myBuffs} 次「成局面降标准」：下次多人拼单局发布自动少拼 {myBuffs} 人
        </p>
      )}

      {mine.length === 0 && (
        <div className="glass-panel rounded-3xl p-6 text-center">
          <span className="text-2xl">📡</span>
          <p className="text-xs text-white/50 mt-2">还没有发出过需求</p>
        </div>
      )}

      <div className="flex flex-col gap-3">
        {mine.map((wave) => {
          const waveClaims = claims.filter((c) => c.waveId === wave.id);
          const accepted = waveClaims.find((c) => c.status === "accepted");
          const negotiating = waveClaims.filter(
            (c) => c.status === "negotiating"
          );
          const isOpen = wave.capacity >= 2;
          const joinedSeats = waveClaims.filter((c) => c.status === "joined");
          // 多人拼单局成局后，每位拼位者各自走拨号/验收/互评流程；
          // breached（no-show 违约未结清）的座位保留在局内 → 发起人可结清解锁
          const assembledClaims = isOpen
            ? waveClaims.filter(
                (c) => c.status === "accepted" || c.status === "breached"
              )
            : [];
          const revealData: BlindRevealData | undefined = accepted
            ? acceptedReveal(accepted)
            : undefined;

          // 多人拼单局成局后，每位拼位者各自走拨号/验收/互评流程
          const lockSeats = wave.status === "assembled" ? assembledClaims : [];

          return (
            <div key={wave.id} className="glass-panel rounded-3xl p-4 space-y-2.5">
              {/* 平台下架态 */}
              {wave.removed && (
                <p className="text-xs font-bold text-red-300/90 flex items-center gap-1.5">
                  <Flag size={10} /> 该需求已被平台下架（可于安全中心申诉）
                </p>
              )}
              {/* 概要 */}
              <div className="flex items-start justify-between gap-2">
                <div>
<h3 className="text-[13px] font-extrabold">
                    {wave.basics.category}
                    {isOpen && wave.status === "active" && (
                      <span className="ml-1.5 text-xs font-bold px-1.5 py-0.5 rounded-full bg-brandPurple/20 border border-brandPurple/40 text-brandPurple align-middle">
                        🎯 多人拼单局 · {neededJoiners(wave)} 位拼位
                      </span>
                    )}
                    {isOpen && (wave.buffSeats ?? 0) > 0 && (
                      <span className="ml-1.5 text-xs font-bold px-1.5 py-0.5 rounded-full bg-emerald-400/15 border border-emerald-400/40 text-emerald-300 align-middle">
                        ✨ 已降标准 −{(wave.buffSeats ?? 0)}
                      </span>
                    )}
                  </h3>
                  {wave.biddingSettled && (
                    <p className="mt-1 text-xs font-bold text-emerald-300 flex items-center gap-1">
                      <Gavel size={9} className="shrink-0" />
                      公开竞价已结算 · {wave.biddingSettled.winnerName} 中标 ¥
                      {wave.biddingSettled.price} · 佣金 ¥{wave.biddingSettled.feeYuan} · 净得 ¥
                      {wave.biddingSettled.netYuan}
                    </p>
                  )}
                  <p className="text-xs text-white/50 mt-0.5">
                    {wave.basics.time} · {wave.basics.area} · {isOpen ? `人均 ${yuan(perSeatPrice(wave))}` : `预算 ${yuan(wave.budget)}`}
                  </p>
                  {wave.customs.map((c) => (
                    <span
                      key={c.text}
                      className="inline-block mt-1 mr-1.5 px-2 py-0.5 rounded-full bg-brandPurple/20 border border-brandPurple/40 text-xs font-bold text-brandPurple"
                    >
                      {c.text}
                    </span>
                  ))}
                </div>
                <div className="flex flex-col items-end gap-1 shrink-0">
                  <StatusBadge status={wave.status} />
                  {wave.status === "active" && (
                    <button
                      onClick={() => onCancel(wave)}
                      title={cancelRefundLabel(wave)}
                      className="text-xs text-white/40 hover:text-white"
                    >
                      取消发布{isOpen ? " · " + cancelRefundLabel(wave) : ""}
                    </button>
                  )}
                </div>
              </div>

              {/* 组织者把关层：审批制多人拼单局的待审批申请（发起人批/拒） */}
              {isOpen && wave.status === "active" && wave.needApproval && (
                <div className="rounded-2xl bg-amber-400/[0.06] border border-amber-400/25 p-3 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-amber-200/80 flex items-center gap-1.5">
                      <Shield size={11} /> 待你审批的拼位申请
                    </span>
                    <span className="text-xs text-white/40">
                      {(wave.joinRequests ?? []).length} 人等待
                    </span>
                  </div>
                  {(wave.joinRequests ?? []).length === 0 ? (
                    <p className="text-xs text-white/35">
                      暂无申请 —— 审批制已开启，响应者申请后会在这里等你批准
                    </p>
                  ) : (
                    (wave.joinRequests ?? []).map((r) => (
                      <div
                        key={r.responderId}
                        className="flex items-center justify-between gap-2 rounded-xl bg-white/[0.04] border border-white/10 px-2.5 py-1.5"
                      >
                        <div className="min-w-0">
                          <p className="text-xs font-bold text-white/80 truncate">
                            用户 {r.responderId.slice(0, 4)} · 申请拼位
                          </p>
                          <p className="text-xs text-white/35">
                            {new Date(r.at).toLocaleTimeString("zh-CN", {
                              hour: "2-digit",
                              minute: "2-digit",
                            })} 提交申请
                          </p>
                        </div>
                        <div className="flex gap-1.5 shrink-0">
                          <button
                            onClick={() =>
                              decideRequest({
                                waveId: wave.id,
                                responderId: r.responderId,
                                approve: true,
                                initiatorId: identity.id,
                              })
                            }
                            className="px-2 py-1 rounded-lg bg-emerald-400/15 border border-emerald-400/40 text-emerald-300 text-xs font-bold hover:brightness-110"
                          >
                            批准入局
                          </button>
                          <button
                            onClick={() =>
                              decideRequest({
                                waveId: wave.id,
                                responderId: r.responderId,
                                approve: false,
                                initiatorId: identity.id,
                              })
                            }
                            className="px-2 py-1 rounded-lg bg-white/[0.06] border border-white/10 text-white/50 text-xs font-bold hover:text-red-300"
                          >
                            拒绝
                          </button>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              )}

              {/* 多人拼单局：拼位队列 + 提前成局 */}
              {isOpen && wave.status === "active" && (
                <div className="rounded-2xl bg-white/[0.04] border border-white/10 p-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-white/60 flex items-center gap-1.5">
                      <Users size={11} className="text-brandPurple" />
                      已拼 {joinedSeats.length}/{neededJoiners(wave)} 位
                    </span>
                    <div className="flex items-center gap-1.5">
                      <ShareKit wave={wave} />
                      <button
                        onClick={() => assembleWave(wave.id)}
                        disabled={joinedSeats.length === 0}
                        className="px-2.5 py-1 rounded-xl btn-primary text-xs font-bold glow-purple-strong disabled:opacity-40 disabled:cursor-not-allowed"
                        aria-label="提前成局"
                      >
                        人够了，提前成局 ⚡
                      </button>
                    </div>
                  </div>
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {Array.from({ length: neededJoiners(wave) }, (_, i) => (
                      <span
                        key={i}
                        className={`w-7 h-7 rounded-full flex items-center justify-center text-xs ${
                          i < joinedSeats.length
                            ? "btn-primary glow-purple-strong"
                            : "bg-white/[0.06] border border-dashed border-white/20 text-white/30"
                        }`}
                      >
                        {i < joinedSeats.length ? "🙋" : i + 1}
                      </span>
                    ))}
                  </div>
                </div>
              )}

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

              {/* 多人拼单局：已满员成局 → 每位拼位者各自走履约流程 */}
                {isOpen && wave.status === "assembled" && (
                  <p className="text-xs font-bold text-emerald-300 flex items-center gap-1.5">
                    <Users size={11} /> 已成局 · {lockSeats.length} 位拼位者
                    {wave.deposit && " · 押金已按位冻结"}
                  </p>
                )}

              {/* 组织者出勤档案（Meetup 吸收项 ④）：成局后查看成员跨局出勤历史 */}
              {isOpen && wave.status === "assembled" && (
                <AttendancePanel wave={wave} />
              )}

              {/* 已接单 → 见面 / 验收 / 违约 + 一次性虚拟线路
                  claims 是接单事实源；wave.status 镜像可能被远端旧快照
                  覆盖回退（active），此时 accepted claim 仍在 → 照常渲染
                  履约流，避免验收/申报卡间歇缺失（E2E flaky 根因） */}
              {!isOpen && accepted && (wave.status === "claimed" || wave.status === "active") && (
                <LockedSeatFlow wave={wave} claim={accepted} />
              )}

              {/* 多人拼单局成局 → 每个座位独立流程 */}
              {isOpen &&
                lockSeats.map((seat) => (
                  <LockedSeatFlow key={seat.id} wave={wave} claim={seat} />
                ))}

              {/* 无人响应 ≥2min → S2 AI 主动诊断（LLM 链 → mock 降级） */}
              {wave.status === "active" &&
                waveClaims.length === 0 &&
                wave.createdAt < now - 2 * 60_000 && (
                  <DiagnosisCard wave={wave} />
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
    assembled: { label: "已成局", cls: "bg-emerald-400/15 border-emerald-400/40 text-emerald-300" },
    closed: { label: "已关闭", cls: "bg-white/10 border-white/15 text-white/40" },
    expired: { label: "已失效·已退款", cls: "bg-white/10 border-white/15 text-white/40" },
  };
  const s = map[status] ?? map.active!;
  return (
    <span className={`px-2 py-0.5 rounded-full border text-xs font-bold ${s.cls}`}>
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
 * 一席的履约流程（需求方视角）：一次性虚拟线路 → 申报验收 → 违约裁决 →
 * 履约后互评。多人拼单局成局后每个座位各渲染一份；普通单也复用。
 */
function LockedSeatFlow({ wave, claim }: { wave: Wave; claim: Claim }) {
  const identity = useIdentityStore((s) => s.identity);
  const policies = useWaveStore((s) => s.policies);
  const submitReport = useWaveStore((s) => s.submitReport);
  const reports = useWaveStore((s) => s.reports);
  const acceptFulfilment = useWaveStore((s) => s.acceptFulfilment);
  const moveDeposit = useWaveStore((s) => s.moveDeposit);
  const resolveNoShow = useWaveStore((s) => s.resolveNoShow);
  const settleBreach = useWaveStore((s) => s.settleBreach);
  const settle = useIdentityStore((s) => s.settle);
  const receivePayout = useIdentityStore((s) => s.receivePayout);
  const [breachOpen, setBreachOpen] = useState(false);
  const [verdictMsg, setVerdictMsg] = useState("");
  const [acceptNote, setAcceptNote] = useState("");
  // SSR/首帧同构探针（同上 idiom）：首帧 now=0 防 Hydration Mismatch，挂载后立即采样。
  const mounted = useSyncExternalStore(
    () => () => {},
    () => true,
    () => false
  );
  const [now, setNow] = useState(0);
  useEffect(() => {
    if (!mounted) return;
    const immediate = window.setTimeout(() => setNow(Date.now()), 0);
    return () => window.clearTimeout(immediate);
  }, [mounted]);

  return (
    <div className="rounded-2xl bg-white/[0.03] border border-white/10 p-3 space-y-2.5">
      <DialCard
        waveId={wave.id}
        responderId={claim.responderId}
        demanderId={identity.id}
        lockedAt={claim.createdAt}
      />
      {/* 履约保险状态（ADR-0012 N7）：响应者投保后可查，违约理赔后显示到账 */}
      {(() => {
        const pol = policies.find(
          (p) => p.waveId === wave.id && p.holderId === claim.responderId
        );
        if (!pol) return null;
        return (
          <p
            className={`text-xs font-bold px-2.5 py-1.5 rounded-xl border ${
              pol.claimed
                ? "bg-cyan-400/10 border-cyan-400/40 text-cyan-300"
                : "bg-brandPurple/10 border-brandPurple/40 text-brandPurple"
            }`}
          >
            🛡️ 履约保险：{pol.claimed
              ? `已理赔 ¥${pol.amount}（违约赔付到账）`
              : `响应者已投保 · 保额 ¥${pol.amount}（违约自动理赔）`}
          </p>
        );
      })()}
      {(() => {
        const myRep = reports.find(
          (r) => r.reporterId === identity.id && r.targetId === claim.responderId
        );
        return myRep?.status === "resolved" ? (
          <p className="w-full text-right text-xs font-bold text-emerald-300/90">
            ✓ 平台已处理：{ACTION_LABEL[myRep.action ?? "dismiss"]}
            {myRep.verdictNote ? `（${myRep.verdictNote}）` : ""}
          </p>
        ) : myRep ? (
          <p className="w-full text-right text-xs font-bold text-amber-300/90">
            ⏳ 已举报，核查中
          </p>
        ) : (
          <div className="flex justify-end">
            <button
              onClick={() =>
                submitReport({
                  targetId: claim.responderId,
                  targetType: "responder",
                  reason: "harassment",
                  detail: "对方行为不当",
                  reporterId: identity.id,
                })
              }
              className="px-2.5 py-1.5 rounded-xl bg-white/[0.04] border border-white/10 text-xs font-bold text-white/50 hover:text-amber-400 hover:border-amber-400/40"
            >
              🚩 举报对方
            </button>
          </div>
        );
      })()}
      {!claim.serviceDoneAt && (
        <div className="flex items-center justify-between gap-2">
          <p className="text-xs text-white/50">
            等待服务方申报完成（请求放款）…
          </p>
          <div className="flex gap-1.5 shrink-0">
            {wave.capacity >= 2 && wave.status === "assembled" && (
              <button
                onClick={() => {
                  resolveNoShow(wave.id, claim.id);
                  setVerdictMsg("已标记未到场：该座位款项不退，已分摊补偿在场玩家，发起人下次成局面降标准");
                }}
                aria-label="标记未到场"
                className="px-2.5 py-1.5 rounded-xl bg-amber-400/10 border border-amber-400/40 text-xs font-bold text-amber-300 hover:brightness-110"
              >
                🚫 未到场
              </button>
            )}
            <button
              onClick={() => setBreachOpen(true)}
              className="px-2.5 py-1.5 rounded-xl glass-panel text-xs font-bold text-amber-400/90 flex items-center gap-1"
            >
              <AlertTriangle size={11} /> 对方违约
            </button>
          </div>
        </div>
      )}
      {claim.serviceDoneAt && !claim.fulfilment && (
        <div className="rounded-2xl bg-emerald-400/[0.06] border border-emerald-400/25 p-2.5">
          <p className="text-xs font-bold text-emerald-300 mb-1.5">
            服务方已申报完成 —— 验收确认后放款
          </p>
          <input
            value={acceptNote}
            onChange={(e) => setAcceptNote(e.target.value)}
            placeholder="验收凭证：交付了什么、完成情况（必填）"
            aria-label="验收凭证"
            className="w-full rounded-xl bg-white/[0.05] border border-white/10 px-2.5 py-2 text-xs outline-none focus:border-emerald-400/50 mb-1.5"
          />
          <div className="flex gap-2 items-center">
            <button
              onClick={() => {
                const note = acceptNote.trim();
                if (!note) return;
                acceptFulfilment(claim.id, note);
              }}
              className="flex-1 py-2 rounded-xl bg-emerald-400/15 border border-emerald-400/40 text-xs font-bold text-emerald-300"
              aria-label="确认验收"
            >
              确认验收 ✅
              {claim.depositPhase === "held" && (
                <span className="ml-1 text-xs opacity-70">· 解冻押金</span>
              )}
            </button>
            <button
              onClick={() => setBreachOpen(true)}
              className="px-2.5 py-2 rounded-xl glass-panel text-xs font-bold text-amber-400/90 flex items-center gap-1"
            >
              <AlertTriangle size={11} /> 对方违约
            </button>
          </div>
          <p className="text-xs text-white/35 mt-1.5">
            {Math.ceil(autoFulfilmentRemaining(claim, now) / 3600_000)}{" "}
            小时后未验收 → 自动放款（对齐默认好评 72h 闸）
          </p>
        </div>
      )}
      {claim.fulfilment && (
        <p className="text-xs text-white/50">
          ✓ 已验收
          {claim.fulfilment.confirmedBy === "auto" && "（自动放款）"}：
          {claim.fulfilment.note}
        </p>
      )}
      <AcceptancePanel claim={claim} wave={wave} />
      {claim.status === "breached" && (
        <div className="rounded-2xl bg-red-400/[0.07] border border-red-400/35 p-2.5">
          <p className="text-xs font-bold text-red-300 flex items-center gap-1.5">
            🚫 该座位 no-show 违约{claim.settled ? " · 已结清" : " · 未结清"}
          </p>
          {!claim.settled && (
            <button
              onClick={() => settleBreach(claim.id)}
              aria-label="结清违约"
              className="mt-2 w-full py-2 rounded-xl bg-emerald-400/15 border border-emerald-400/40 text-xs font-bold text-emerald-300"
            >
              已收赔偿 · 结清违约（解锁对方拼位/发波）
            </button>
          )}
        </div>
      )}
      {verdictMsg && (
        <p className="text-xs font-bold text-emerald-300">✓ 已裁决：{verdictMsg}</p>
      )}

      {/* 违约裁决面板（本席独立） */}
      {breachOpen && (
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          className="rounded-2xl bg-amber-400/[0.06] border border-amber-400/30 p-3 space-y-2"
        >
          <p className="text-xs text-white/80 font-bold flex items-center gap-1">
            <HelpCircle size={11} className="text-amber-300" />
            响应方未履约，请裁决谅解与否
            {claim.depositPhase === "held" && (
              <span className="text-xs font-bold px-1.5 py-0.5 rounded-full bg-sky-400/15 border border-sky-400/40 text-sky-300">
                🕊️ 押金 ¥5 待定
              </span>
            )}
          </p>
          <div className="flex gap-2">
            <button
              onClick={() => {
                settle(claim.id, "forgive");
                moveDeposit(claim.id, "refunded");
                setVerdictMsg("已谅解 · 扣 ¥5 轻微处罚，押金全额退回响应者");
                setBreachOpen(false);
              }}
              className="flex-1 py-2 rounded-xl bg-emerald-400/15 border border-emerald-400/40 text-emerald-300 text-xs font-bold"
            >
              谅解 · 轻罚 + 押金退回
            </button>
            <button
              onClick={() => {
                settle(claim.id, "unforgiven");
                moveDeposit(claim.id, "forfeited");
                receivePayout(claim.id);
                // 履约保险联动（ADR-0012 N7）：resolveNoShow 已把保单标记 claimed，
                // 此处理赔金入需求方钱包（幂等）
                const pol = policies.find(
                  (p) =>
                    p.waveId === wave.id &&
                    p.holderId === claim.responderId &&
                    p.claimed
                );
                if (pol) receivePayout(claim.id, pol.amount, "insurance");
                setVerdictMsg(
                  `不谅解 · 扣 ¥30 + 信用降级 + 额度减半，押金 ¥5 赔付到账${
                    pol ? `，履约保险理赔 ¥${pol.amount} 到账` : ""
                  }`
                );
                setBreachOpen(false);
              }}
              className="flex-1 py-2 rounded-xl bg-red-400/15 border border-red-400/40 text-red-300 text-xs font-bold"
            >
              不谅解 · 重罚 + 押金赔付
            </button>
          </div>
        </motion.div>
      )}

      {/* 履约后互评（72h 窗口，脱敏展示） */}
      <ReviewSection
        claim={claim}
        wave={wave}
        myId={identity.id}
        peerId={claim.responderId}
      />
    </div>
  );
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
        <span className="text-xs font-bold text-brandCyan flex items-center gap-1">
          <MessageSquareText size={11} /> 响应者磋商
          {claim.lastMessage && ` · "${claim.lastMessage.slice(0, 18)}"`}
        </span>
        <span className="text-xs text-white/40">
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
          className={`text-xs font-bold ml-1 ${
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
            className="w-20 shrink-0 rounded-xl bg-white/[0.05] border border-white/10 px-2.5 py-1.5 text-xs text-white/90 outline-none focus:border-brandPurple/50"
          />
          <input
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            placeholder="回应一句（可空）"
            aria-label="还价留言"
            className="flex-1 min-w-0 rounded-xl bg-white/[0.05] border border-white/10 px-2.5 py-1.5 text-xs placeholder:text-white/25 text-white/90 outline-none focus:border-brandPurple/50"
          />
          <button
            onClick={send}
            className="px-2.5 rounded-xl bg-brandPurple/20 border border-brandPurple/40 text-brandPurple text-xs font-bold shrink-0"
            aria-label="发出还价"
          >
            <Send size={11} />
          </button>
        </div>
      )}
      {err && <p className="text-xs text-red-400 mt-1">{err}</p>}
      {sent && !exhausted && (
        <p className="text-xs text-emerald-300 mt-1.5">
          ✓ 已还价，等待响应者回应（下一轮轮到他）
        </p>
      )}

      <div className="flex gap-2 mt-2">
        <button
          onClick={onAccept}
          className="flex-1 py-2 rounded-xl btn-primary text-xs font-bold glow-purple-strong"
        >
          谈成 · 锁定
        </button>
        <button
          onClick={onWithdraw}
          className="px-3 py-2 rounded-xl glass-panel text-xs text-white/60"
        >
          婉拒
        </button>
      </div>
    </div>
  );
}