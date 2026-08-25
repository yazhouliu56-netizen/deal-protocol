"use client";
import { useMemo, useState } from "react";
import { useMountedNow } from "@/lib/use-mounted-now";
import { Clock, Clock3, MapPin, Zap, Users, Flag, UserPlus, Heart } from "lucide-react";
import type { Wave } from "@/base/order/wave";
import { neededJoiners, perSeatPrice } from "@/base/order/wave";
import { suggestedPrice, yuan } from "@/base/money/customPricing";
import { ACTION_LABEL } from "@/base/risk/moderation";
import { displayInterest, useWaveStore } from "@/store/useWaveStore";
import { useIdentityStore } from "@/store/useIdentityStore";
import NegotiationBox from "./NegotiationBox";

/**
 * A signal-wave demand card — shown in the radar feed to responders.
 * Custom conditions glow (they're the emotional-value surcharge drivers);
 * the interest number mixes real claims with a virtual base.
 * 多人拼单局 (capacity ≥ 2) renders a join-seat CTA + seat progress instead of
 * the solo 抢单 CTA.
 */
export default function WaveCard({
  wave,
  interests,
  joined,
  joinedByMe,
  requested,
  requestedByMe,
  waitlistedByMe,
  waitlistPos,
  waitlistCount,
  onClaim,
  onJoin,
  onRequestJoin,
  onWaitlist,
}: {
  wave: Wave;
  /** Real claim count for this wave. */
  interests: number;
  /** 多人拼单局：当前拼位数（已占座）。 */
  joined?: number;
  /** 多人拼单局：我是否已占座。 */
  joinedByMe?: boolean;
  /** 审批制多人拼单局：待审批申请数。 */
  requested?: number;
  /** 审批制多人拼单局：我是否已提交申请（待审批）。 */
  requestedByMe?: boolean;
  /** 多人拼单局：我是否在候补队列。 */
  waitlistedByMe?: boolean;
  /** 多人拼单局：我的候补排队位置（1 起）。 */
  waitlistPos?: number;
  /** 多人拼单局：当前候补人数。 */
  waitlistCount?: number;
  onClaim: (p: { price: number; note?: string }) => { error?: string } | void;
  onJoin?: () => void;
  /** 审批制多人拼单局：提交拼位申请。 */
  onRequestJoin?: () => void;
  /** 多人拼单局：满员后进入候补队列。 */
  onWaitlist?: () => void;
}) {
  const identity = useIdentityStore((s) => s.identity);
  const submitReport = useWaveStore((s) => s.submitReport);
  const reports = useWaveStore((s) => s.reports);
  const favorites = useWaveStore((s) => s.favorites);
  const toggleFavorite = useWaveStore((s) => s.toggleFavorite);
  const [note, setNote] = useState("");
  const [committed, setCommitted] = useState(false);
  // SSR/首帧同构探针（use-mounted-now 共享范式）：首帧 now=0 两端一致防 Hydration
  // Mismatch，挂载后立即采样真实时钟（render 期零时钟采样，红线 1）。
  const now = useMountedNow();

  const isFav = favorites.includes(wave.id);

  const isOpen = (wave.capacity ?? 1) >= 2;
  const needsApproval = !!wave.needApproval;
  const needed = neededJoiners(wave);
  const ownSeat = joinedByMe || committed;
  // 已成局（assembled）不再直接拼位 —— 一律走候补等让位（Meetup waitlist）
  const full = (joined ?? 0) >= needed || wave.status === "assembled";

  const recommend = useMemo(
    () => suggestedPrice(wave.budget, wave.customs.length),
    [wave]
  );
  const heat = displayInterest([], wave, 3) + interests;
  const live = wave.expiresAt - now;
  const mins = Math.max(0, Math.ceil(live / 60_000));
  const expireLabel =
    mins >= 60 * 24
      ? `${Math.floor(mins / (60 * 24))} 天`
      : mins >= 60
        ? `${Math.floor(mins / 60)} 小时`
        : `${mins} 分`;

  const isMine = wave.authorId === identity.id;

  // 我的举报 → 平台处理回执（Airtasker 差评修复：举报必须有下文）
  const myReport = reports.find(
    (r) => r.reporterId === identity.id && r.targetId === wave.id
  );

  return (
    <div className="glass-panel rounded-3xl p-4 hover:border-brandPurple/40 transition-colors">
      {/* 头部：品类 + 热度 + 倒计时 */}
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <span className="w-9 h-9 rounded-2xl btn-primary glow-purple-strong flex items-center justify-center text-base shrink-0">
            {CATEGORY_EMOJI(wave.basics.category)}
          </span>
          <div className="min-w-0">
            <h3 className="text-[13px] font-extrabold text-white/95 truncate">
              {wave.basics.category}
            </h3>
            <p className="text-xs text-white/50 flex items-center gap-1 truncate">
              <MapPin size={9} className="shrink-0 text-brandCyan" />
              {wave.basics.area}
            </p>
          </div>
        </div>
        <div className="flex flex-col items-end gap-1 shrink-0">
          <span className="flex items-center gap-1 text-xs font-bold text-white/70">
            <Users size={10} className="text-brandPurple" /> {heat} 人感兴趣
          </span>
          <span className="flex items-center gap-2">
            <span className="flex items-center gap-1 text-xs text-white/40">
              <Clock3 size={9} /> {expireLabel}后失效
            </span>
            <button
              type="button"
              onClick={() => toggleFavorite(wave.id)}
              aria-label={isFav ? `取消关注 ${wave.basics.category}` : `关注 ${wave.basics.category}`}
              className={`transition-colors ${isFav ? "text-amber-400" : "text-white/30 hover:text-amber-400"}`}
            >
              <Heart size={10} className={isFav ? "fill-amber-400" : ""} />
            </button>
          </span>
        </div>
      </div>

      {/* 时间 */}
      <p className="text-xs text-white/70 mt-2 flex items-center gap-1">
        <Clock3 size={10} className="text-brandCyan shrink-0" /> {wave.basics.time}
        {isOpen && (
          <span className="text-xs font-bold px-1.5 py-0.5 rounded-full bg-brandPurple/20 border border-brandPurple/40 text-brandPurple ml-0.5">
            🎯 多人拼单局 {wave.capacity} 人
          </span>
        )}
      </p>

      {/* 多人拼单局：拼位进度条 */}
      {isOpen && (
        <div className="mt-2">
          <div className="flex items-center justify-between text-xs mb-1">
            <span className="text-white/50">
              已拼 {Math.min(joined ?? 0, needed)}/{needed} 位
              {needsApproval && (requested ?? 0) > 0 && (
                <span className="text-amber-300/80">
                  {" "}· 待审批 {(requested ?? 0)}
                </span>
              )}
            </span>
            <span className="text-brandPurple font-bold">
              {wave.status === "assembled"
                ? "已成局 · 候补等让位"
                : full
                  ? "已满员"
                  : `还差 ${needed - (joined ?? 0)} 人成局`}
              {(waitlistCount ?? 0) > 0 && (
                <span className="text-amber-300/90 font-bold"> · 候补 {(waitlistCount ?? 0)} 人</span>
              )}
            </span>
          </div>
          <div className="h-1.5 rounded-full bg-white/10 overflow-hidden">
            <div
              className={`h-full rounded-full transition-all ${
                full ? "bg-emerald-400" : "bg-linear-to-r from-brandCyan to-brandPurple"
              }`}
              style={{ width: `${Math.min(100, ((joined ?? 0) / needed) * 100)}%` }}
            />
          </div>
        </div>
      )}

      {/* 定制条件：高亮 + 加价提示 */}
      {wave.customs.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-1.5">
          {wave.customs.map((c, i) => (
            <span
              key={i}
              className="px-2 py-0.5 rounded-full bg-brandPurple/20 border border-brandPurple/40 text-xs font-bold text-brandPurple"
            >
              {c.text} +{15 * (i + 1)}%
            </span>
          ))}
        </div>
      )}

      {/* 价格行 */}
      <div className="flex items-baseline gap-2 mt-3">
        <span className="text-[15px] font-extrabold bg-clip-text text-transparent bg-linear-to-r from-brandCyan to-brandPurple">
          {isOpen
            ? yuan(perSeatPrice(wave))
            : wave.customs.length
              ? yuan(recommend)
              : yuan(wave.budget)}
        </span>
        {isOpen ? (
          <span className="text-xs text-white/40">/人</span>
        ) : (
          wave.customs.length > 0 && (
            <span className="text-xs text-white/40 line-through">
              基础 {yuan(wave.budget)}
            </span>
          )
        )}
        {wave.negotiable && (
          <span className="text-xs font-bold px-1.5 py-0.5 rounded-full bg-emerald-400/15 border border-emerald-400/40 text-emerald-300">
            可磋商
          </span>
        )}
        {wave.deposit && (
          <span className="text-xs font-bold px-1.5 py-0.5 rounded-full bg-sky-400/15 border border-sky-400/40 text-sky-300">
            🕊️ 爽约保障险 ¥5
          </span>
        )}
      </div>

      {/* 操作区（响应者视角；自己发的需求不给操作） */}
      {!isMine && !ownSeat && (
        <div className="mt-3 space-y-2">
          {isOpen ? (
            <div className="flex gap-2">
              {waitlistedByMe ? (
                // 候补中：只读展示排队位置（退出候补去「我的接单」）
                <button
                  disabled
                  className="flex-1 py-2.5 rounded-2xl bg-amber-400/10 border border-amber-400/40 text-amber-300 font-bold text-xs flex items-center justify-center gap-1.5 disabled:opacity-90"
                >
                  <Clock size={12} /> 候补中 · 第 {waitlistPos} 位
                </button>
              ) : needsApproval ? (
                <button
                  onClick={() => {
                    // 审批局：待审批态由 store 的 requestedByMe 驱动（被拒自动回退可重试）；
                    // 非审批局：由 PaySheet 支付弹窗接管，成功后才经 joinedByMe 反映。
                    onRequestJoin?.();
                  }}
                  disabled={full || requestedByMe}
                  className="flex-1 py-2.5 rounded-2xl btn-primary font-bold text-xs glow-purple-strong hover:brightness-110 active:scale-[0.98] transition-[filter,transform] flex items-center justify-center gap-1.5 disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  {requestedByMe ? (
                    <>
                      <Clock size={12} /> 待发起人审批
                    </>
                  ) : full ? (
                    "已满员"
                  ) : (
                    <>
                      <UserPlus size={12} /> 申请加入
                    </>
                  )}
                </button>
              ) : full ? (
                <button
                  onClick={onWaitlist}
                  className="flex-1 py-2.5 rounded-2xl bg-amber-400/15 border border-amber-400/40 text-amber-300 font-bold text-xs hover:bg-amber-400/25 active:scale-[0.98] transition-[filter,transform] flex items-center justify-center gap-1.5"
                >
                  <Clock size={12} /> 进入候补 · 有空位自动补位
                </button>
              ) : (
                <button
                  onClick={onJoin}
                  className="flex-1 py-2.5 rounded-2xl btn-primary font-bold text-xs glow-purple-strong hover:brightness-110 active:scale-[0.98] transition-[filter,transform] flex items-center justify-center gap-1.5"
                >
                  <>
                    <UserPlus size={12} /> 拼位加入
                  </>
                </button>
              )}
              <button
                onClick={() => {
                  submitReport({
                    targetId: wave.id,
                    targetType: "wave",
                    reason: "sensitive",
                    detail: "内容疑似违规",
                    reporterId: identity.id,
                  });
                }}
                disabled={!!myReport?.status}
                aria-label="举报"
                className="shrink-0 px-2.5 rounded-2xl bg-white/[0.04] border border-white/10 text-white/45 hover:text-amber-400 hover:border-amber-400/40"
              >
                <Flag size={12} />
              </button>
            </div>
          ) : (
            <>
              <NegotiationBox
                compact
                value={note}
                onChange={setNote}
                placeholder={
                  wave.negotiable
                    ? "想商量价格或补充条件？写下来进入磋商（留空直接接单）"
                    : "此单默认直接接单，可留下补充说明"
                }
              />
              <div className="flex gap-2">
                <button
                  onClick={() => {
                    // 单人局：接单成功（无 error）才置乐观态，失败不污染 UI
                    const out = onClaim({ price: recommend, note });
                    if (!out?.error) setCommitted(true);
                  }}
                  className="flex-1 py-2.5 rounded-2xl btn-primary font-bold text-xs glow-purple-strong hover:brightness-110 active:scale-[0.98] transition-[filter,transform] flex items-center justify-center gap-1.5"
                >
                  <Zap size={12} /> {note.trim() && wave.negotiable ? "发起磋商" : "接单"}
                </button>
                <button
                  onClick={() => {
                    submitReport({
                      targetId: wave.id,
                      targetType: "wave",
                      reason: "sensitive",
                      detail: "内容疑似违规",
                      reporterId: identity.id,
                    });
                  }}
                  disabled={!!myReport?.status}
                  aria-label="举报"
                  className="shrink-0 px-2.5 rounded-2xl bg-white/[0.04] border border-white/10 text-white/45 hover:text-amber-400 hover:border-amber-400/40"
                >
                  <Flag size={12} />
                </button>
              </div>
            </>
          )}
        </div>
      )}
      {ownSeat && (
        <p className="mt-3 text-xs font-bold text-emerald-300 text-center py-2">
          {isOpen ? "✓ 已拼位，等待满员成局" : "✓ 已发出，等待需求方确认"}
        </p>
      )}
      {myReport?.status && (
        <p className="mt-2 text-xs text-center">
          {myReport.status === "resolved" ? (
            <span className="text-emerald-300/90 font-bold">
              ✓ 平台已处理：
              {ACTION_LABEL[myReport.action ?? "dismiss"]}
              {myReport.verdictNote ? `（${myReport.verdictNote}）` : ""}
            </span>
          ) : (
            <span className="text-amber-300/90">⏳ 已举报，平台核查中</span>
          )}
        </p>
      )}
    </div>
  );
}

export function CATEGORY_EMOJI(category: string): string {
  if (/厨|饭|餐|美食|烘焙/.test(category)) return "👨‍🍳";
  if (/羽毛球|球/.test(category)) return "🏸";
  if (/拍|摄影|写真/.test(category)) return "📷";
  if (/保洁|家政|打扫/.test(category)) return "🧹";
  if (/陪|护|医/.test(category)) return "🩺";
  if (/拼|饭搭子|桌游|游戏/.test(category)) return "🎲";
  if (/跑|健身|撸铁/.test(category)) return "💪";
  return "✨";
}