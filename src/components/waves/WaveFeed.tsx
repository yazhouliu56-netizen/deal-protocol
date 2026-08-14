"use client";
import { useMemo, useState } from "react";
import { motion } from "framer-motion";
import { Plus, Wifi, WifiOff, Heart, Rocket, Sparkles } from "lucide-react";
import {
  broadcastMatches,
  type ResponderCapability,
} from "@/base/dispatch/broadcast";
import { dispatchRuleFor } from "@/ammo/dispatch-rule";
import { perSeatPrice } from "@/base/order/wave";
import { useWaveStore } from "@/store/useWaveStore";
import { useIdentityStore } from "@/store/useIdentityStore";
import { useOrganizerSubStore } from "@/store/useOrganizerSubStore";
import { subStatus } from "@/base/money/organizerSubscription";
import WaveCard from "./WaveCard";
import PublishSheet from "./PublishSheet";
import PaySheet from "./PaySheet";
import RadarInbox from "./RadarInbox";
import SpatialHeatMap from "./SpatialHeatMap";
import OrganizerBoostCard from "./OrganizerBoostCard";
import { setGeoSrc, WebGeoSrc, type GeoSrc } from "@/base/geo/geoAdapter";

/** ADR-0015 N16 消费方：Web 真实定位开关（按需授权，降级演示坐标）。 */
function GeoSourceBadge() {
  const [state, setState] = useState<"mock" | "granted" | "denied" | "asking">(
    "mock"
  );
  const [src, setSrc] = useState<GeoSrc | null>(null);
  const [tooltip, setTooltip] = useState("");

  const enable = async () => {
    setState("asking");
    const web = new WebGeoSrc();
    const p = await web.current();
    if (p) {
      setGeoSrc(web);
      setSrc(web);
      setState("granted");
      setTooltip(`浏览器定位已启用 · ${p.lat.toFixed(3)}, ${p.lng.toFixed(3)}`);
    } else {
      setState("denied");
      setTooltip("未授权或定位不可用，保持演示坐标");
    }
  };

  if (src) {
    return (
      <span
        data-geo-src="web"
        className="inline-flex items-center gap-1 px-2 py-1 rounded-full bg-emerald-400/12 border border-emerald-400/35 text-[9px] font-bold text-emerald-300 cursor-help"
        title={tooltip}
      >
        📍 真实定位
      </span>
    );
  }
  return (
    <span
      className="inline-flex items-center gap-1 px-2 py-1 rounded-full bg-white/[0.04] border border-white/10 text-[9px] font-bold text-white/40"
      title={
        state === "denied"
          ? tooltip
          : "未启用浏览器定位时使用演示坐标（隐私优先，按需授权）"
      }
    >
      {state === "asking" ? (
        "📍 请求定位中…"
      ) : state === "denied" ? (
        "📍 定位未授权 · 演示坐标"
      ) : (
        <>
          📍 演示坐标
          <button
            onClick={enable}
            className="ml-0.5 text-brandCyan hover:text-brandCyan/80 transition-colors"
            aria-label="启用浏览器定位"
          >
            启用 ›
          </button>
        </>
      )}
    </span>
  );
}
import BiddingSandboxCard from "./BiddingSandboxCard";
import FavoritesSheet from "./FavoritesSheet";
import IdentityAvatar from "@/components/oto-ui/IdentityAvatar";
import { toast } from "@/base/platform/toast";
import { onboardGuide } from "@/base/platform/clientFlags";

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
  const setOnline = useIdentityStore((s) => s.setOnline);
  const sub = useOrganizerSubStore((s) => s.sub);
  const [publishOpen, setPublishOpen] = useState(false);
  const [favOpen, setFavOpen] = useState(false);
  // P1-3 空态引导链：首次进入（未点过「知道了」）才显示三步引导
  const { useFlag: useOnboardSeen, markSeen } = onboardGuide;
  const showOnboard = !useOnboardSeen();
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
        // active 正常进 feed；已成局开放局保留展示（满员卡片变候补入口，Meetup waitlist）
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
      // 我已拼位的开放局不再出现在 feed（去我的接单里看进度）
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
        <GeoSourceBadge />
        <IdentityAvatar />
        <div className="flex-1 min-w-0">
          <p className="text-[15px] font-extrabold text-white/95 truncate leading-tight">
            雷达 · {identity.nickname}
          </p>
          <p className="text-[10.5px] text-white/50 truncate mt-0.5 flex items-center gap-1">
            <span
              className={`inline-block w-1.5 h-1.5 rounded-full ${
                identity.online ? "bg-emerald-400" : "bg-white/30"
              }`}
            />
            {identity.online ? "正在接收信号" : "暂停接收信号"}
          </p>
        </div>
        <button
          onClick={() => {
            setOnline(!identity.online);
            toast(identity.online ? "已切换为隐身 · 暂停接收信号" : "已切换为在线 · 正在接收信号", "success");
          }}
          aria-label={`在线状态：${identity.online ? "在线" : "隐身"}`}
          className={`flex items-center gap-1 px-3 py-2 min-h-10 rounded-full text-[10px] font-bold transition-colors ${
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
          className="flex items-center gap-1 px-3 py-2 min-h-10 rounded-full bg-white/[0.05] border border-white/15 text-[9.5px] font-bold text-white/55 hover:border-brandCyan/50 hover:text-white transition-colors shrink-0"
        >
          <Heart size={10} className={favorites.length ? "text-brandCyan fill-brandCyan/30" : ""} />
          关注 {favorites.length > 0 ? favorites.length : ""}
        </button>
      </div>

      {/* 发布 CTA（主视觉）：核心漏斗动作，渐变 + 光晕 + 入场 */}
      <motion.button
        onClick={() => setPublishOpen(true)}
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        whileTap={{ scale: 0.98 }}
        className="mt-4 w-full flex items-center gap-3 px-4 py-4 rounded-2xl btn-primary glow-purple-strong hover:brightness-110 transition-[filter] text-left group"
      >
        <div className="w-10 h-10 rounded-xl bg-white/15 border border-white/20 flex items-center justify-center shrink-0">
          <Plus size={18} className="text-white" />
        </div>
        <span className="flex-1 min-w-0">
          <span className="block text-sm font-extrabold text-white">
            发出你的需求
          </span>
          <span className="block text-[10px] text-white/70 truncate">
            时间 / 地点 / 品类一句话说清 · 可选 AI 拆解定制
          </span>
        </span>
        <span className="text-[10px] font-bold text-white shrink-0 px-2.5 py-1 rounded-full bg-white/15 border border-white/25 group-hover:bg-white/25 transition-colors">
          发送 📡
        </span>
      </motion.button>

      {/* P1-3 空态引导链：首次进入且无需求时，解释「发出→接单→履约」三步 */}
      {showOnboard && feed.length === 0 && (
        <motion.div
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          className="mt-2 px-3 py-2.5 rounded-2xl bg-brandCyan/10 border border-brandCyan/30 text-[10px] text-white/70 flex items-start gap-2"
        >
          <Sparkles size={12} className="text-brandCyan shrink-0 mt-0.5" />
          <p className="leading-relaxed">
            三步开始：<span className="font-bold text-white/90">① 上面发出需求</span>
            <span className="text-white/40"> → </span>
            <span className="font-bold text-white/90">② 响应者接单</span>
            <span className="text-white/40"> → </span>
            <span className="font-bold text-white/90">③ 履约评价</span>
            <button
              onClick={markSeen}
              className="ml-1 px-2 py-1 min-h-8 text-[10px] text-white/40 hover:text-white underline underline-offset-2"
            >
              知道了
            </button>
          </p>
        </motion.div>
      )}

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