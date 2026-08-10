"use client";
import { useMemo, useState } from "react";
import { motion } from "framer-motion";
import { Plus, Wifi, WifiOff, Heart, Rocket } from "lucide-react";
import {
  broadcastMatches,
  type ResponderCapability,
} from "@/lib/broadcast";
import { perSeatPrice } from "@/lib/wave";
import { useWaveStore } from "@/store/useWaveStore";
import { useIdentityStore } from "@/store/useIdentityStore";
import { useOrganizerSubStore } from "@/store/useOrganizerSubStore";
import { subStatus } from "@/lib/organizerSubscription";
import WaveCard from "./WaveCard";
import PublishSheet from "./PublishSheet";
import PaySheet from "./PaySheet";
import RadarInbox from "./RadarInbox";
import SpatialHeatMap from "./SpatialHeatMap";
import OrganizerBoostCard from "./OrganizerBoostCard";
import BiddingSandboxCard from "./BiddingSandboxCard";
import FavoritesSheet from "./FavoritesSheet";
import IdentityAvatar from "@/components/ui/IdentityAvatar";

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
  const identity = useIdentityStore((s) => s.identity);
  const creditTier = useIdentityStore((s) => s.creditTier);
  const setOnline = useIdentityStore((s) => s.setOnline);
  const sub = useOrganizerSubStore((s) => s.sub);
  const [publishOpen, setPublishOpen] = useState(false);
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
      (w) => w.status === "active" && !w.removed && w.authorId !== identity.id
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
      // 我已拼位的开放局不再出现在 feed（去我的接单里看进度）
      .filter((w) => !joinedIds.has(w.id))
      .map((w) => ({
        wave: w,
        interest: claims.filter((c) => c.waveId === w.id).length,
        joined: claims.filter((c) => c.waveId === w.id && c.status === "joined").length,
        joinedByMe: joinedIds.has(w.id),
        hits: broadcastMatches(sigs, w),
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

  // 组局加速联动（G-5 真实数据）：订阅 active 时自己活跃需求在雷达区优先曝光
  const boosting = subStatus(sub) === "active";
  const myActiveCount = waves.filter(
    (w) => w.authorId === identity.id && w.status === "active" && !w.removed
  ).length;

  return (
    <div className="pointer-events-auto relative">
      {/* LLM 聚类推送（雷达收件箱） */}
      <RadarInbox />

      {/* 顶部条：身份 + 在线开关 + 发布 */}
      <div className="flex items-center gap-2.5">
        <IdentityAvatar />
        <div className="flex-1 min-w-0">
          <p className="text-[13px] font-extrabold text-white/95 truncate">
            雷达 {identity.nickname}
          </p>
          <p className="text-[10px] text-white/45 truncate">
            {identity.online ? "在线 · 正在接收信号" : "隐身 · 暂停接收"}
          </p>
        </div>
        <button
          onClick={() => setOnline(!identity.online)}
          aria-label={`在线状态：${identity.online ? "在线" : "隐身"}`}
          className={`flex items-center gap-1 px-2.5 py-1.5 rounded-full text-[10px] font-bold transition-colors ${
            identity.online
              ? "bg-emerald-400/15 border border-emerald-400/40 text-emerald-300"
              : "bg-white/5 border border-white/15 text-white/50"
          }`}
        >
          {identity.online ? <Wifi size={11} /> : <WifiOff size={11} />}
          {identity.online ? "在线" : "隐身"}
        </button>
      </div>

      <h1 className="text-[23px] leading-tight font-extrabold mt-3 bg-clip-text text-transparent bg-linear-to-r from-white via-purple-200 to-brandPurple tracking-tight">
        谁正在附近发需求
      </h1>
      <div className="mt-0.5 flex items-center justify-between gap-2">
        <p className="text-[11px] text-white/50">
          广播式撮合 · 谁合适谁来 · 谁接单算谁的
        </p>
        <button
          onClick={() => setFavOpen(true)}
          aria-label={`查看我关注的局，共 ${favorites.length} 个`}
          className="flex items-center gap-1 px-2 py-1 rounded-full bg-white/[0.05] border border-white/15 text-[9.5px] font-bold text-white/55 hover:border-brandCyan/50 hover:text-white transition-colors shrink-0"
        >
          <Heart size={10} className={favorites.length ? "text-brandCyan fill-brandCyan/30" : ""} />
          关注 {favorites.length > 0 ? favorites.length : ""}
        </button>
      </div>

      {/* 发布 CTA */}
      <button
        onClick={() => setPublishOpen(true)}
        className="mt-4 w-full flex items-center gap-2.5 px-4 py-3.5 rounded-2xl glass-panel-interactive text-left group hover:border-brandPurple/50 transition-colors"
      >
        <div className="w-9 h-9 rounded-xl btn-primary glow-purple-strong flex items-center justify-center shrink-0">
          <Plus size={16} />
        </div>
        <span className="flex-1 min-w-0">
          <span className="block text-xs font-extrabold text-white/90">
            发出你的需求
          </span>
          <span className="block text-[10px] text-white/45 truncate">
            一句话说清 时间/地点/品类 · 可选加定制
          </span>
        </span>
        <span className="text-[10px] text-brandPurple font-bold shrink-0 px-2 py-1 rounded-full bg-brandPurple/15 border border-brandPurple/30 group-hover:bg-brandPurple/25 transition-colors">
          发送
        </span>
      </button>

      {/* S1 匿名光点热力图：附近活跃信号波 */}
      <SpatialHeatMap />

      {/* 组局者订阅（商业化前哨，纯本地 demo） */}
      <OrganizerBoostCard />

      {/* 订阅已生效：自己的活跃需求在雷达区优先曝光 */}
      {boosting && myActiveCount > 0 && (
        <motion.div
          initial={{ opacity: 0, y: -6 }}
          animate={{ opacity: 1, y: 0 }}
          className="mt-2 px-3 py-2 rounded-2xl bg-emerald-400/10 border border-emerald-400/35 text-[10px] font-bold text-emerald-300 flex items-center gap-1.5"
        >
          <Rocket size={11} />
          组局加速已生效 · 你的 {myActiveCount} 个需求正优先曝光（「我的」跟进）
        </motion.div>
      )}

      {/* 公开竞价（P8 前哨，接入真实需求局） */}
      <BiddingSandboxCard />

      {/* Feed */}
      <div className="mt-4 flex flex-col gap-3">
        {feed.length === 0 && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="glass-panel rounded-3xl p-6 text-center"
          >
            <motion.span
              animate={{ scale: [1, 1.2, 1] }}
              transition={{ repeat: Infinity, duration: 2 }}
              className="text-3xl inline-block"
            >
              📡
            </motion.span>
            <p className="text-[12px] font-bold text-white/85 mt-2">
              这片区域暂时没有活跃的信号波
            </p>
            <p className="text-[10px] text-white/45 mt-1">
              试着在线声明能力，或发出你的第一条需求
            </p>
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
            }
          }
          setJoinPay(null);
        }}
      />
      {joinError && (
        <p className="mt-2 px-3 py-2 rounded-2xl bg-red-400/10 border border-red-400/35 text-[10px] font-bold text-red-300">
          ⚠ {joinError}
        </p>
      )}

      <PublishSheet open={publishOpen} onClose={() => setPublishOpen(false)} />

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