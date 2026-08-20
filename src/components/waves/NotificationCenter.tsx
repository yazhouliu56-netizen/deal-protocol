"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Bell, Check } from "lucide-react";
import { useWaveStore } from "@/store/useWaveStore";
import { useIdentityStore } from "@/store/useIdentityStore";
import { ACTION_LABEL } from "@/base/risk/moderation";
import {
  buildNotifyItems,
  type NotifyItem,
  type NotifyKind,
} from "@/base/notify/notify";
import { markAllRead, useReadKeys } from "@/base/platform/readKeys";
import {
  diffNotifEvents,
  notify,
  requestNotifyPermission,
  type NotifyPermission,
  type NotifDiffInput,
} from "@/base/notify/systemNotify";
import { shouldNotify, minuteOfWeek } from "@/base/platform/quietHours";
import { useQuietPrefStore } from "@/store/useQuietPrefStore";

const KIND_STYLE: Record<NotifyKind, readonly [string, string]> = {
  offer: ["bg-brandCyan/15 border-brandCyan/40", "text-brandCyan"],
  accepted: ["bg-emerald-400/15 border-emerald-400/40", "text-emerald-300"],
  push: ["bg-brandPurple/15 border-brandPurple/40", "text-brandPurple-foreground"],
  friend: ["bg-amber-400/15 border-amber-400/40", "text-amber-300"],
  report: ["bg-white/5 border-white/10", "text-white/60"],
  wave: ["bg-white/5 border-white/10", "text-white/60"],
  fission: ["bg-cyan-400/15 border-cyan-400/40", "text-cyan-300"],
};

function NotifyRow({ item }: { item: NotifyItem }) {
  const [bg, fg] = KIND_STYLE[item.kind as NotifyKind];
  return (
    <div className={`flex items-center gap-2.5 rounded-2xl border px-3 py-2.5 ${bg}`}>
      <span className="text-lg">{item.emoji}</span>
      <span className="flex-1 min-w-0">
        <span className={`block text-xs font-bold ${fg}`}>{item.title}</span>
        <span className="block text-xs text-white/45 truncate">{item.desc}</span>
      </span>
    </div>
  );
}

/**
 * 通知中心（G-3）：铃铛 + 未读角标 + 聚合动态（报价/被接单/雷达推送/
 * 好友申请/举报回执）。打开一次即全部已读（localStorage 持久）。
 */
export default function NotificationCenter() {
  const waves = useWaveStore((s) => s.waves);
  const claims = useWaveStore((s) => s.claims);
  const pushes = useWaveStore((s) => s.pushes);
  const friendRequests = useWaveStore((s) => s.friendRequests);
  const reports = useWaveStore((s) => s.reports);
  const identity = useIdentityStore((s) => s.identity);
  const quietPref = useQuietPrefStore((s) => s.pref);
  const [open, setOpen] = useState(false);
  const [notifPerm, setNotifPerm] = useState<NotifyPermission>("default");
  const readKeys = useReadKeys();

  // ADR-0016 免打扰：urgent（报价/接单/好友/裂变 → 履约关键）不受静音影响；
  // normal（成局/拼位提醒）走用户设置的静音窗口。
  const isUrgent = (notifId: string): boolean => {
    if (notifId.startsWith("offer:") || notifId.startsWith("accepted:") ||
        notifId.startsWith("friend:") || notifId.startsWith("fission:")) return true;
    return false;
  };

  // 本地系统通知：跨帧 diff 出增量事件（成局/新报价/拼位/接单/好友申请），
  // 授权后弹系统通知。identity 切换或首帧只做基线，不弹。
  const prevRef = useRef<NotifDiffInput | null>(null);
  useEffect(() => {
    const cur: NotifDiffInput = {
      meId: identity.id,
      waves: waves.map((w) => ({
        id: w.id,
        authorId: w.authorId,
        status: w.status,
        capacity: w.capacity,
        basics: { category: w.basics.category },
        fissionUpdatedAt: w.fissionUpdatedAt,
      })),
      claims: claims.map((c) => ({
        id: c.id,
        waveId: c.waveId,
        status: c.status,
        price: c.price,
      })),
      friendRequests: friendRequests.map((f) => ({
        id: f.id,
        toId: f.toId,
        fromId: f.fromId,
      })),
    };
    const prev = prevRef.current;
    prevRef.current = cur;
    if (!prev || prev.meId !== cur.meId) return;
    const weekStart = new Date().setHours(0, 0, 0, 0) - 7 * 24 * 3600_000;
    const nowMinute = minuteOfWeek(Date.now(), weekStart);
    for (const n of diffNotifEvents(prev, cur)) {
      // ADR-0016：urgent 永推；normal 在静音窗口内跳过
      const cls = isUrgent(n.id) ? "urgent" : "normal";
      if (!shouldNotify(cls, quietPref, nowMinute)) continue;
      notify(n.title, n.body);
    }
  }, [identity, waves, claims, friendRequests, quietPref]);

  const items = useMemo(() => {
    const me = identity.id;
    return buildNotifyItems({
      meId: me,
      waves,
      claims,
      pushes,
      friendRequests,
      reportOutcomes: reports
        .filter((r) => r.reporterId === me && r.resolvedAt)
        .map((r) => ({
          id: r.id,
          at: r.resolvedAt ?? r.at,
          verdict: r.verdictNote ?? (r.action ? ACTION_LABEL[r.action] : "已处理"),
        })),
    });
  }, [identity, waves, claims, pushes, friendRequests, reports]);

  const unread = items.filter((i) => !readKeys.has(i.key)).length;

  const openSheet = () => {
    setOpen(true);
    if (unread > 0) {
      markAllRead(new Set([...readKeys, ...items.map((i) => i.key)]));
    }
  };

  return (
    <>
      <button
        onClick={openSheet}
        aria-label={`通知中心，${unread > 0 ? `${unread} 条未读` : "无未读"}`}
        className="relative w-11 h-11 rounded-full bg-white/5 border border-white/10 flex items-center justify-center text-white/60 hover:text-white transition-colors shrink-0"
      >
        <Bell size={13} />
        {unread > 0 && (
          <span className="absolute -top-0.5 -right-0.5 min-w-4 h-4 px-1 rounded-full bg-red-400 text-white text-xs font-extrabold flex items-center justify-center">
            {unread}
          </span>
        )}
      </button>

      <AnimatePresence>
        {open && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-40 bg-black/50 backdrop-blur-sm"
              onClick={() => setOpen(false)}
            />
            <motion.div
              initial={{ y: 40, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: 40, opacity: 0 }}
              transition={{ type: "spring", stiffness: 320, damping: 28 }}
              className="fixed inset-x-3 bottom-24 z-50 glass-panel rounded-3xl p-4 max-h-[65vh] overflow-y-auto no-scrollbar"
            >
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-[13px] font-extrabold flex items-center gap-1.5">
                  <Bell size={13} className="text-brandCyan" /> 通知{unread > 0 ? `（${unread}）` : ""}
                </h3>
                <button
                  onClick={() => setOpen(false)}
                  aria-label="关闭通知"
                  className="text-white/40 hover:text-white"
                >
                  ✕
                </button>
              </div>
              {items.length === 0 ? (
                <p className="text-xs text-white/40 text-center py-6">
                  还没有通知 —— 雷达适配、报价应答、接单进度都会汇总到这里
                </p>
              ) : (
                <div className="flex flex-col gap-2">
                  {items.map((item) => (
                    <NotifyRow key={item.key} item={item} />
                  ))}
                  <button
                    onClick={() => setOpen(false)}
                    className="w-full py-1.5 text-xs text-white/35 flex items-center justify-center gap-1"
                  >
                    <Check size={9} /> 已读，收起
                  </button>
                </div>
              )}
              <button
                onClick={async () => {
                  setNotifPerm(await requestNotifyPermission());
                }}
                disabled={notifPerm !== "default"}
                className="w-full mt-1 py-1.5 rounded-xl bg-white/[0.04] border border-white/10 text-xs text-brandCyan disabled:opacity-50 flex items-center justify-center gap-1.5"
              >
                {notifPerm === "granted"
                  ? "🔔 系统通知已开启"
                  : notifPerm === "denied"
                    ? "🔕 通知被浏览器拒绝（设置中开启）"
                    : "🔔 开启系统通知（成局/报价/好友本地提醒）"}
              </button>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </>
  );
}