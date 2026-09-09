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
} from "@/adapters/notify/notify";
import { markAllRead, useReadKeys } from "@/adapters/ui/readKeys";
import {
  diffNotifEvents,
  notify,
  requestNotifyPermission,
  type NotifyPermission,
  type NotifDiffInput,
} from "@/adapters/notify/systemNotify";
import { shouldNotify, minuteOfWeek } from "@/base/platform/quietHours";
import { useQuietPrefStore } from "@/store/useQuietPrefStore";

const KIND_STYLE: Record<NotifyKind, readonly [string, string]> = {
  offer: ["bg-[var(--color-duo-blue)]/10 border-[var(--color-duo-blue)]/40", "text-[#0a6ea8]"],
  accepted: ["bg-[var(--color-duo-green)]/10 border-[var(--color-duo-green)]/40", "text-[#357a00]"],
  push: ["bg-[var(--color-duo-yellow)]/10 border-[var(--color-duo-yellow-dark)]/50", "text-[#8a6d00]"],
  friend: ["bg-[var(--color-duo-blue)]/10 border-[var(--color-duo-blue)]/40", "text-[#0a6ea8]"],
  report: ["bg-[var(--color-duo-polar)] border-[var(--color-duo-swan)]", "text-[var(--color-duo-wolf)]"],
  wave: ["bg-[var(--color-duo-polar)] border-[var(--color-duo-swan)]", "text-[var(--color-duo-wolf)]"],
  fission: ["bg-[var(--color-duo-green)]/10 border-[var(--color-duo-green)]/40", "text-[#357a00]"],
};

function NotifyRow({ item }: { item: NotifyItem }) {
  const [bg, fg] = KIND_STYLE[item.kind as NotifyKind];
  return (
    <div className={`flex items-center gap-2.5 rounded-2xl border px-3 py-2.5 ${bg}`}>
      <span className="text-lg">{item.emoji}</span>
      <span className="flex-1 min-w-0">
        <span className={`block text-xs font-bold ${fg}`}>{item.title}</span>
        <span className="block text-xs text-[var(--color-duo-hare)] truncate">{item.desc}</span>
      </span>
    </div>
  );
}

/**
 * 通知中心（G-3）：铃铛 + 未读角标 + 聚合动态（报价/被接单/雷达推送/
 * 好友申请/举报回执）。打开一次即全部已读（localStorage 持久）。
 *
 * 首页 1:1 图纸收拢：可选的心愿单 / SOS 快捷行（调用方传入才渲染，
 * 缺省零影响）。aria-label 口径与顶栏旧按钮逐字一致（e2e-app 心愿单步）。
 */
export default function NotificationCenter({
  cartCount,
  onOpenCart,
  onSos,
}: {
  cartCount?: number;
  onOpenCart?: () => void;
  onSos?: () => void;
} = {}) {
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
        className="relative w-11 h-11 rounded-full bg-[var(--color-duo-polar)] border border-[var(--color-duo-swan)] flex items-center justify-center text-[var(--color-duo-wolf)] hover:text-[var(--color-duo-eel)] transition-colors shrink-0"
      >
        <Bell size={13} />
        {unread > 0 && (
          <span className="absolute -top-0.5 -right-0.5 min-w-4 h-4 px-1 rounded-full bg-[var(--color-duo-red)] text-white text-xs font-extrabold flex items-center justify-center">
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
              className="fixed inset-0 z-40 bg-black/50"
              onClick={() => setOpen(false)}
            />
            <motion.div
              initial={{ y: 40, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: 40, opacity: 0 }}
              transition={{ type: "spring", stiffness: 320, damping: 28 }}
              className="fixed inset-x-3 bottom-24 z-50 bg-white border-2 border-[var(--color-duo-swan)] border-b-[6px] rounded-3xl p-4 max-h-[65vh] overflow-y-auto no-scrollbar"
            >
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-[13px] font-extrabold flex items-center gap-1.5">
                  <Bell size={13} className="text-[var(--color-duo-blue)]" /> 通知{unread > 0 ? `（${unread}）` : ""}
                </h3>
                <button
                  onClick={() => setOpen(false)}
                  aria-label="关闭通知"
                  className="text-[var(--color-duo-hare)] hover:text-[var(--color-duo-eel)]"
                >
                  ✕
                </button>
              </div>
              {(onOpenCart || onSos) && (
                <div className="mb-3 flex flex-col gap-2">
                  {onOpenCart && (
                    <button
                      type="button"
                      onClick={() => {
                        onOpenCart();
                        setOpen(false);
                      }}
                      aria-label={`心愿单，共 ${cartCount ?? 0} 项`}
                      className="w-full flex items-center gap-2.5 rounded-2xl border-2 border-[var(--color-duo-swan)] border-b-4 bg-white px-3 py-2.5 text-left shadow-sm active:translate-y-px active:border-b-2 transition-[transform]"
                    >
                      <span className="relative flex h-9 w-9 items-center justify-center rounded-full bg-[var(--color-duo-polar)] border border-[var(--color-duo-swan)] text-sm shrink-0">
                        🧺
                        {(cartCount ?? 0) > 0 && (
                          <span className="absolute -top-1 -right-1 min-w-4 h-4 px-1 rounded-full bg-[var(--color-duo-red)] border-2 border-white text-xs font-bold text-white flex items-center justify-center">
                            {cartCount}
                          </span>
                        )}
                      </span>
                      <span className="flex-1 min-w-0">
                        <span className="block text-xs font-extrabold text-[var(--color-duo-eel)]">我的心愿单</span>
                        <span className="block text-xs text-[var(--color-duo-hare)] truncate">收藏的局 · 一键直达 AR 预览</span>
                      </span>
                      <span className="text-[var(--color-duo-hare)] text-xs shrink-0">→</span>
                    </button>
                  )}
                  {onSos && (
                    <button
                      type="button"
                      onClick={() => {
                        onSos();
                        setOpen(false);
                      }}
                      aria-label="SOS 紧急求助"
                      className="w-full flex items-center gap-2.5 rounded-2xl border-2 border-[var(--color-duo-red)]/40 border-b-4 bg-[#fff5f5] px-3 py-2.5 text-left shadow-sm active:translate-y-px active:border-b-2 transition-[transform]"
                    >
                      <span className="flex h-9 w-9 items-center justify-center rounded-full bg-[var(--color-duo-red)] text-white text-sm font-black shrink-0">
                        SOS
                      </span>
                      <span className="flex-1 min-w-0">
                        <span className="block text-xs font-extrabold text-[#c2410c]">SOS 紧急求助</span>
                        <span className="block text-xs text-[var(--color-duo-hare)] truncate">一键上报 · 通知紧急联系人/平台/警方</span>
                      </span>
                      <span className="text-[var(--color-duo-hare)] text-xs shrink-0">→</span>
                    </button>
                  )}
                </div>
              )}
              {items.length === 0 ? (
                <p className="text-xs text-[var(--color-duo-hare)] text-center py-6">
                  还没有通知 —— 雷达适配、报价应答、接单进度都会汇总到这里
                </p>
              ) : (
                <div className="flex flex-col gap-2">
                  {items.map((item) => (
                    <NotifyRow key={item.key} item={item} />
                  ))}
                  <button
                    onClick={() => setOpen(false)}
                    className="w-full py-1.5 text-xs text-[var(--color-duo-hare)] flex items-center justify-center gap-1"
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
                className="w-full mt-1 py-1.5 rounded-xl bg-white border-2 border-[var(--color-duo-swan)] text-xs text-[#0a6ea8] disabled:opacity-50 flex items-center justify-center gap-1.5"
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