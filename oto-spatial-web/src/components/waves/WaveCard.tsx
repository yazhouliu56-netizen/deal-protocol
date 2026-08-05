"use client";
import { useMemo, useState } from "react";
import { Clock3, MapPin, Zap, Users, Flag } from "lucide-react";
import type { Wave } from "@/lib/wave";
import { suggestedPrice, yuan } from "@/lib/customPricing";
import { ACTION_LABEL } from "@/lib/moderation";
import { displayInterest, useWaveStore } from "@/store/useWaveStore";
import { useIdentityStore } from "@/store/useIdentityStore";
import NegotiationBox from "./NegotiationBox";

/**
 * A signal-wave demand card — shown in the radar feed to responders.
 * Custom conditions glow (they're the emotional-value surcharge drivers);
 * the interest number mixes real claims with a virtual base.
 */
export default function WaveCard({
  wave,
  interests,
  onClaim,
}: {
  wave: Wave;
  /** Real claim count for this wave. */
  interests: number;
  onClaim: (p: { price: number; note?: string }) => void;
}) {
  const identity = useIdentityStore((s) => s.identity);
  const submitReport = useWaveStore((s) => s.submitReport);
  const reports = useWaveStore((s) => s.reports);
  const [note, setNote] = useState("");
  const [committed, setCommitted] = useState(false);
  const [now] = useState(() => Date.now());

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
            <p className="text-[10px] text-white/50 flex items-center gap-1 truncate">
              <MapPin size={9} className="shrink-0 text-brandCyan" />
              {wave.basics.area}
            </p>
          </div>
        </div>
        <div className="flex flex-col items-end gap-1 shrink-0">
          <span className="flex items-center gap-1 text-[10px] font-bold text-white/70">
            <Users size={10} className="text-brandPurple" /> {heat} 人感兴趣
          </span>
          <span className="flex items-center gap-1 text-[9.5px] text-white/40">
            <Clock3 size={9} /> {expireLabel}后失效
          </span>
        </div>
      </div>

      {/* 时间 */}
      <p className="text-[11px] text-white/70 mt-2 flex items-center gap-1">
        <Clock3 size={10} className="text-brandCyan shrink-0" /> {wave.basics.time}
        {wave.capacity > 1 && ` · ${wave.capacity} 人`}
      </p>

      {/* 定制条件：高亮 + 加价提示 */}
      {wave.customs.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-1.5">
          {wave.customs.map((c, i) => (
            <span
              key={i}
              className="px-2 py-0.5 rounded-full bg-brandPurple/20 border border-brandPurple/40 text-[9.5px] font-bold text-brandPurple"
            >
              {c.text} +{15 * (i + 1)}%
            </span>
          ))}
        </div>
      )}

      {/* 价格行 */}
      <div className="flex items-baseline gap-2 mt-3">
        <span className="text-[15px] font-extrabold bg-clip-text text-transparent bg-linear-to-r from-brandCyan to-brandPurple">
          {wave.customs.length ? yuan(recommend) : yuan(wave.budget)}
        </span>
        {wave.customs.length > 0 && (
          <span className="text-[9.5px] text-white/40 line-through">
            基础 {yuan(wave.budget)}
          </span>
        )}
        {wave.negotiable && (
          <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full bg-emerald-400/15 border border-emerald-400/40 text-emerald-300">
            可磋商
          </span>
        )}
        {wave.deposit && (
          <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full bg-sky-400/15 border border-sky-400/40 text-sky-300">
            🕊️ 鸽子险 ¥5
          </span>
        )}
      </div>

      {/* 操作区（响应者视角；自己发的需求不给操作） */}
      {!isMine && !committed && (
        <div className="mt-3 space-y-2">
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
                setCommitted(true);
                onClaim({ price: recommend, note });
              }}
              className="flex-1 py-2.5 rounded-2xl btn-primary font-bold text-[11px] glow-purple-strong hover:brightness-110 active:scale-[0.98] transition-[filter,transform] flex items-center justify-center gap-1.5"
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
        </div>
      )}
      {committed && (
        <p className="mt-3 text-[10px] font-bold text-emerald-300 text-center py-2">
          ✓ 已发出，等待需求方确认
        </p>
      )}
      {myReport?.status && (
        <p className="mt-2 text-[9.5px] text-center">
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