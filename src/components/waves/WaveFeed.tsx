"use client";
import { useMemo, useState } from "react";
import { motion } from "framer-motion";
import { Wifi, WifiOff, Heart } from "lucide-react";
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
import SpatialHeatMap from "./SpatialHeatMap";
import { setGeoSrc, WebGeoSrc, type GeoSrc } from "@/adapters/geo/geoAdapter";

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
        className="inline-flex items-center gap-1 px-2 py-1 rounded-full bg-[#dcfce7] border border-[#86efac] text-xs font-bold text-[#16a34a] cursor-help"
        title={tooltip}
      >
        📍 真实定位
      </span>
    );
  }
  return (
      <span
        className="inline-flex items-center gap-1 px-2 py-1 rounded-full bg-[#f7f7f7] border-2 border-[#e5e5e5] text-xs font-bold text-[#afafaf]"
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
import FavoritesSheet from "./FavoritesSheet";
import IdentityAvatar from "@/components/oto-ui/IdentityAvatar";
import { toast } from "@/base/platform/toast";

/** 战场3 · 周边在线供给雷达光斑（冷启动 feed 空态补给反馈，O2O 本地生活供给可视化）。 */
const SUPPLY_BLOBS: {
  id: string;
  color: string;
  dist: string;
  text: string;
  count: number;
  delayClass: string;
}[] = [
  {
    id: "clean",
    color: "bg-emerald-400",
    dist: "1.2km",
    text: "4 位实名保洁阿姨待命",
    count: 4,
    delayClass: "radar-blob-delay-1",
  },
  {
    id: "sport",
    color: "bg-brandCyan",
    dist: "800m",
    text: "3 个羽毛球局可加入",
    count: 3,
    delayClass: "",
  },
  {
    id: "photo",
    color: "bg-brandPurple",
    dist: "1.5km",
    text: "2 位摄影师在线接拍",
    count: 2,
    delayClass: "radar-blob-delay-2",
  },
  {
    id: "cafe",
    color: "bg-amber-400",
    dist: "1.0km",
    text: "1 间咖啡馆可拼桌",
    count: 1,
    delayClass: "radar-blob-delay-1",
  },
];

/** 战场3 · 实时撮合微动效弹幕（常驻滚动条；真实接单事件优先，冷启动回落现场氛围样本）。 */
function MatchTicker() {
  const waves = useWaveStore((s) => s.waves);
  const claims = useWaveStore((s) => s.claims);
  const events = useMemo(() => {
    const real = claims
      .slice(-4)
      .map((c) => {
        const w = waves.find((x) => x.id === c.waveId);
        return w ? `⚡ 服务者接取「${w.basics.category}」` : null;
      })
      .filter(Boolean) as string[];
    if (real.length > 0) return real;
    return [
      "⚡ 王姐 接取「深度保洁」",
      "⚡ 阿凯 拼位「羽毛球 4 人双打」",
      "⚡ 小北 排期「日系写真 · 滨江」",
    ];
  }, [waves, claims]);
  const line = events.join("　·　");
  return (
    <div className="mt-2 overflow-hidden rounded-xl bg-[#f7f7f7] border border-[#e5e5e5] opacity-60">
      <div className="ticker-track">
        <span className="whitespace-nowrap px-3 py-1 text-xs text-[#afafaf] tracking-wide">
          {line}　·　{line}　·　
        </span>
        <span className="whitespace-nowrap px-3 py-1 text-xs text-[#afafaf] tracking-wide">
          {line}　·　{line}　·　
        </span>
      </div>
    </div>
  );
}

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
      {/* LLM 聚类推送（雷达收件箱） */}
      <RadarInbox />

      {/* 顶部条：身份 + 在线开关 + 发布 */}
      <div className="flex items-center gap-2.5">
        <GeoSourceBadge />
        <IdentityAvatar />
        <div className="flex-1 min-w-0">
          <p className="text-[15px] font-extrabold text-[#4b4b4b] truncate leading-tight">
            雷达 · {identity.nickname}
          </p>
          <p className="text-xs text-[#777777] truncate mt-0.5 flex items-center gap-1">
            <span
              className={`inline-block w-1.5 h-1.5 rounded-full ${
                identity.online ? "bg-[#58cc02]" : "bg-[#d4d4d4]"
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
          className={`flex items-center gap-1 px-3 py-2 min-h-10 rounded-full border-2 border-b-4 text-xs font-bold transition-[transform] active:translate-y-1 active:border-b-2 ${
            identity.online
              ? "bg-white border-[#58cc02]/30 text-[#58cc02] shadow-sm"
              : "bg-white border-[#e5e5e5] text-[#afafaf] shadow-sm"
          }`}
        >
          {identity.online ? <Wifi size={11} /> : <WifiOff size={11} />}
          {identity.online ? "在线" : "隐身"}
        </button>
      </div>

      <h1 className="text-[18px] leading-tight font-extrabold mt-3 text-[#4b4b4b] tracking-tight flex items-center gap-1.5">
        📍 附近的需求
        <span className="text-xs font-normal text-[#afafaf]">· 谁正在附近发需求</span>
      </h1>
      <div className="mt-0.5 flex items-center justify-between gap-2">
        <p className="text-xs text-[#777777] flex items-center gap-1">
          <span className="w-1.5 h-1.5 rounded-full bg-[#58cc02] animate-pulse" /> 🟢 随时待命的师傅
          <span className="text-xs text-[#afafaf]">· 广播式撮合 · 谁合适谁来</span>
          <span className="ml-1 hidden sm:inline text-[#777777]">· 1.2km 内在线</span>
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

      {/* 战场3 · 新人信任背书胶囊（常驻：零押金启动 · 满意后分账 · 平台全保） */}
      <div className="mt-3 flex items-center gap-2 rounded-2xl bg-white border-2 border-[#e5e5e5] border-b-4 shadow-sm px-3 py-2">
        <span className="text-xs font-extrabold text-[#58cc02] shrink-0">
          🛡️ 新人首单保障
        </span>
        <span className="h-2.5 w-px bg-[#e5e5e5] shrink-0" />
        <p className="text-xs text-[#777777] truncate">
          0 押金启动 · 满意后分账 · 平台财产意外险全包
        </p>
      </div>

      {/* S1 匿名光点热力图：附近活跃信号波 */}
      <SpatialHeatMap />

      {/* 战场3 · 实时撮合微动效弹幕（常驻滚动） */}
      <MatchTicker />

      {/* Feed */}
      <div className="mt-4 flex flex-col gap-3">
        {feed.length === 0 && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-white rounded-3xl border-2 border-[#e5e5e5] border-b-[6px] shadow-sm p-4"
          >
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-extrabold text-[#4b4b4b]">
                📡 周边在线供给雷达
              </span>
              <span className="text-xs px-2 py-0.5 rounded-full bg-[#dcfce7] border border-[#86efac] text-[#16a34a] font-bold">
                活跃供给在线
              </span>
            </div>
            <div className="flex flex-col gap-2">
              {SUPPLY_BLOBS.map((b) => (
                <div
                  key={b.id}
                  className="flex items-center gap-2.5 rounded-xl bg-[#f7f7f7] border-2 border-[#e5e5e5] px-3 py-2"
                >
                  <span
                    className={`relative w-2 h-2 rounded-full ${b.color} radar-blob ${b.delayClass}`}
                  />
                  <span className="text-xs text-[#4b4b4b]">
                    <span className="font-tabular">{b.dist}</span> · {b.text}
                  </span>
                  <span className="ml-auto text-xs px-2 py-0.5 rounded-full bg-white border border-[#e5e5e5] text-[#afafaf] font-tabular shrink-0">
                    {b.count} 人在线
                  </span>
                </div>
              ))}
            </div>
            <p className="text-xs text-[#afafaf] mt-2 text-center">
              在线声明能力或发出你的第一条需求，光斑即刻点亮 → 你被精准匹配
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