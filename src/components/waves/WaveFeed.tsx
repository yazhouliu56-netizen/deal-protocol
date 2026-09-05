"use client";
import { useMemo, useState } from "react";
import { motion } from "framer-motion";
import { Heart } from "lucide-react";
import {
  broadcastMatches,
  type ResponderCapability,
} from "@/base/dispatch/broadcast";
import { dispatchRuleFor } from "@/ammo/dispatch-rule";
import { perSeatPrice } from "@/base/order/wave";
import { useWaveStore } from "@/store/useWaveStore";
import { useIdentityStore } from "@/store/useIdentityStore";
import WaveCard from "./WaveCard";
import PaySheet from "./PaySheet";
import RadarInbox from "./RadarInbox";
import FavoritesSheet from "./FavoritesSheet";
import { SandboxBadge } from "./SandboxBadge";
import { toast } from "@/base/platform/toast";

/**
 * 雷达 Feed — the flipped-primary home.
 * A responder (anyone with an online capability statement) sees the waves
 * that pass the hard filter, ordered by broadcast fit score.
 */
export default function WaveFeed() {
  const waves = useWaveStore((s) => s.waves);
  const claims = useWaveStore((s) => s.claims);
  const openClaim = useWaveStore((s) => s.openClaim);
  const joinSeat = useWaveStore((s) => s.joinSeat);
  const requestSeat = useWaveStore((s) => s.requestSeat);
  const joinWaitlist = useWaveStore((s) => s.joinWaitlist);
  const identity = useIdentityStore((s) => s.identity);
  const creditTier = useIdentityStore((s) => s.creditTier);
  const [favOpen, setFavOpen] = useState(false);
  const favorites = useWaveStore((s) => s.favorites);
  const toggleFavorite = useWaveStore((s) => s.toggleFavorite);
  // 拼位待支付：点「拼位加入」→ 弹模拟收银台 → 支付成功才真正占位
  const [joinPay, setJoinPay] = useState<null | { waveId: string; amount: number }>(null);
  // 拼位被拒（如 no-show 欠款锁定）的提示
  const [joinError, setJoinError] = useState("");

  // 分享链接携带的受邀 wave id（/?wave=xxx&via=yyy）
  const invitedWaveId = useMemo(() => {
    if (typeof window === "undefined") return "";
    return new URLSearchParams(window.location.search).get("wave") ?? "";
  }, []);

  const feed = useMemo(() => {
    // current identity as a responder (only if it declares capability + online)
    const me: ResponderCapability = {
      id: identity.id,
      nickname: identity.nickname,
      categories: identity.categories,
      tags: identity.tags,
      distanceKm: identity.distanceKm,
      online: identity.online,
      creditLevel: creditTier,
      verified: identity.verified,
    };
    const sigs = [me];

    const active = waves.filter(
      (w) =>
        !w.removed &&
        w.authorId !== identity.id &&
        // active 正常进 feed；已成局多人拼单局保留展示（满员卡片变候补入口，Meetup waitlist）
        (w.status === "active" ||
          (w.status === "assembled" && (w.capacity ?? 1) >= 2))
    );
    const joinedIds = new Set(
      claims
        .filter(
          (c) =>
            c.responderId === identity.id &&
            (c.status === "joined" || c.status === "accepted")
        )
        .map((c) => c.waveId)
    );
    const list = active
      // 我已拼位的多人拼单局不再出现在 feed（去我的接单里看进度）
      .filter((w) => !joinedIds.has(w.id))
      .map((w) => ({
        wave: w,
        interest: claims.filter((c) => c.waveId === w.id).length,
        joined: claims.filter(
          (c) =>
            c.waveId === w.id &&
            (c.status === "joined" ||
              (w.status === "assembled" && c.status === "accepted"))
        ).length,
        joinedByMe: joinedIds.has(w.id),
        requested: (w.joinRequests ?? []).length,
        requestedByMe: (w.joinRequests ?? []).some(
          (r) => r.responderId === identity.id
        ),
        waitlistedByMe: (w.waitlist ?? []).some(
          (r) => r.responderId === identity.id
        ),
        waitlistPos:
          (w.waitlist ?? []).findIndex((r) => r.responderId === identity.id) + 1,
        waitlistCount: (w.waitlist ?? []).length,
        hits: broadcastMatches(sigs, w, dispatchRuleFor(w.basics.category)),
      }))
      // 硬筛不过（未认证进家/封禁/离线/品类不符）→ 不出现在 feed
      .filter((a) => a.hits.length > 0)
      .sort(
        (a, b) =>
          (b.hits[0]?.score ?? 0) - (a.hits[0]?.score ?? 0)
      );
    // 受邀拼位：分享链接直达的 wave 置顶（即便得分一般）
    const invited = invitedWaveId;
    if (invited) {
      const i = list.findIndex((a) => a.wave.id === invited);
      if (i >= 0) {
        const [hit] = list.splice(i, 1);
        list.unshift(hit);
      }
    }
    return list;
  }, [waves, claims, identity, creditTier, invitedWaveId]);

  return (
    <div className="pointer-events-auto relative">
      <RadarInbox />

      <h1 className="text-[18px] leading-tight font-extrabold mt-1 text-[#4b4b4b] tracking-tight flex items-center gap-1.5">
        📍 附近的需求
        <span className="text-xs font-normal text-[#afafaf]">· 谁正在附近发需求</span>
        <SandboxBadge />
      </h1>
      <div className="mt-0.5 flex items-center justify-between gap-2">
        <p className="text-xs text-[#777777] flex items-center gap-1">
          <span className="w-1.5 h-1.5 rounded-full bg-[#58cc02] animate-pulse" /> 🟢 随时待命的师傅 · 正在接收信号
          <span className="text-xs text-[#afafaf]">· 谁合适谁来</span>
        </p>
        <button
          onClick={() => setFavOpen(true)}
          aria-label={`查看我关注的局，共 ${favorites.length} 个`}
          className="flex items-center gap-1 px-3 py-2 min-h-10 rounded-full bg-white border-2 border-[#e5e5e5] border-b-4 text-xs font-bold text-[#afafaf] hover:border-[#1cb0f6]/30 hover:text-[#4b4b4b] transition-colors shrink-0 shadow-sm active:translate-y-1 active:border-b-2"
        >
          <Heart size={10} className={favorites.length ? "text-[#ff4b4b] fill-[#ff4b4b]" : "text-[#afafaf]"} />
          关注 {favorites.length > 0 ? favorites.length : ""}
        </button>
      </div>

      {/* Feed */}
      <div className="mt-4 flex flex-col gap-3">
        {feed.length === 0 && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="relative overflow-hidden bg-white rounded-3xl border-2 border-[#e5e5e5] border-b-[6px] shadow-sm p-6 text-center"
            data-testid="wave-empty-state"
          >
            {/* 雷达微光扩散（纯 CSS animate-pulse，零重库，防雷：禁挡触控） */}
            <div aria-hidden="true" className="pointer-events-none select-none absolute inset-0 flex items-center justify-center">
              <span className="absolute h-24 w-24 rounded-full bg-[#58cc02]/10 animate-pulse" />
              <span className="absolute h-40 w-40 rounded-full bg-[#58cc02]/5 animate-pulse" />
            </div>
            <p className="relative text-xs font-bold text-[#1cb0f6]">附近的雷达</p>
            <p className="relative text-sm font-extrabold text-[#4b4b4b] mt-1">你附近的OTO社区</p>
            <p className="relative text-xs text-[#afafaf] mt-1 leading-relaxed">这里暂时静悄悄的，快发出你的第一个需求，点亮OTO社区吧！</p>
          </motion.div>
        )}
        {feed.map((f) => (
          <motion.div
            key={f.wave.id}
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
          >
<WaveCard
                wave={f.wave}
                interests={f.interest}
                joined={f.joined}
                joinedByMe={f.joinedByMe}
                requested={f.requested}
                requestedByMe={f.requestedByMe}
                waitlistedByMe={f.waitlistedByMe}
                waitlistPos={f.waitlistPos}
                waitlistCount={f.waitlistCount}
              onClaim={({ price, note }) =>
                openClaim({
                  waveId: f.wave.id,
                  responderId: identity.id,
                  note: note?.trim() || undefined,
                  price,
                })
              }
              onJoin={() =>
                setJoinPay({
                  waveId: f.wave.id,
                  amount: perSeatPrice(f.wave),
                })
              }
              onRequestJoin={() => {
                const out = requestSeat({ waveId: f.wave.id, responderId: identity.id });
                if (out.error) {
                  setJoinError(out.error === "approval-off" ? "该局未开启审批制" : "申请失败，请重试");
                  toast("申请失败", "error");
                } else {
                  toast("已提交拼位申请，等待发起人审批", "success");
                }
              }}
              onWaitlist={() => {
                const out = joinWaitlist({ waveId: f.wave.id, responderId: identity.id });
                if (out?.error) {
                  setJoinError(
                    out.error === "debt-unsettled"
                      ? "你还有未结清的 no-show 违约，先去「我的」结清欠款再候补"
                      : out.error === "wave-not-full"
                        ? "该局还有空位，直接拼位即可"
                        : "进入候补失败，请重试"
                  );
                  toast("候补失败", "error");
                } else {
                  toast(`已进入候补 · 当前第 ${out.queuePos} 位，有人退出自动补位`, "success");
                }
              }}
            />
          </motion.div>
        ))}
      </div>

      {/* 拼位收银台：支付成功 = 占位（未付不加名额） */}
      <PaySheet
        open={!!joinPay}
        amount={joinPay?.amount ?? 0}
        title="支付拼位份额"
        desc="支付成功即占位；未支付不占名额"
        onCancel={() => setJoinPay(null)}
        onPaid={() => {
          if (joinPay) {
            const out = joinSeat({ waveId: joinPay.waveId, responderId: identity.id });
            // no-show 欠款未结 → 拼位被锁定：告知用户去「我的」结清
            if (out?.error === "debt-unsettled") {
              setJoinError("你还有未结清的 no-show 违约，先去「我的」结清欠款再拼位");
              toast("拼位失败：no-show 欠款未结", "error");
            } else if (out && !out.error) {
              toast("拼位成功 · 已占位", "success");
            }
          }
          setJoinPay(null);
        }}
      />
      {joinError && (
        <p className="mt-2 px-3 py-2 rounded-2xl bg-red-400/10 border border-red-400/35 text-xs font-bold text-red-300">
          ⚠ {joinError}
        </p>
      )}

      {/* 关注的局（雷达心愿单） */}
      <FavoritesSheet
        open={favOpen}
        onClose={() => setFavOpen(false)}
        waves={waves}
        favoriteIds={favorites}
        onToggle={toggleFavorite}
      />
    </div>
  );
}