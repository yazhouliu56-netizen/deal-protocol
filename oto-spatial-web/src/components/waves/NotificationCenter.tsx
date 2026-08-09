"use client";
import { useEffect, useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Bell, Check } from "lucide-react";
import { useWaveStore } from "@/store/useWaveStore";
import { useIdentityStore } from "@/store/useIdentityStore";
import { ACTION_LABEL } from "@/lib/moderation";
import {
  buildNotifyItems,
  loadReadSet,
  persistReadSet,
  type NotifyItem,
  type NotifyKind,
} from "@/lib/notify";

const KIND_STYLE: Record<NotifyKind, readonly [string, string]> = {
  offer: ["bg-brandCyan/15 border-brandCyan/40", "text-brandCyan"],
  accepted: ["bg-emerald-400/15 border-emerald-400/40", "text-emerald-300"],
  push: ["bg-brandPurple/15 border-brandPurple/40", "text-brandPurple-foreground"],
  friend: ["bg-amber-400/15 border-amber-400/40", "text-amber-300"],
  report: ["bg-white/5 border-white/10", "text-white/60"],
  wave: ["bg-white/5 border-white/10", "text-white/60"],
};

function NotifyRow({ item }: { item: NotifyItem }) {
  const [bg, fg] = KIND_STYLE[item.kind as NotifyKind];
  return (
    <div className={`flex items-center gap-2.5 rounded-2xl border px-3 py-2.5 ${bg}`}>
      <span className="text-lg">{item.emoji}</span>
      <span className="flex-1 min-w-0">
        <span className={`block text-[11.5px] font-bold ${fg}`}>{item.title}</span>
        <span className="block text-[9.5px] text-white/45 truncate">{item.desc}</span>
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
  const [open, setOpen] = useState(false);
  // SSR 安全：首帧空集，挂载后载入持久已读（badge 才准确）
  const [readKeys, setReadKeys] = useState<Set<string>>(new Set());
  useEffect(() => {
    setReadKeys(loadReadSet());
  }, []);

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
      const keys = new Set([...readKeys, ...items.map((i) => i.key)]);
      setReadKeys(keys);
      persistReadSet(keys);
    }
  };

  return (
    <>
      <button
        onClick={openSheet}
        aria-label={`通知中心，${unread > 0 ? `${unread} 条未读` : "无未读"}`}
        className="relative w-8 h-8 rounded-full bg-white/5 border border-white/10 flex items-center justify-center text-white/60 hover:text-white transition-colors shrink-0"
      >
        <Bell size={13} />
        {unread > 0 && (
          <span className="absolute -top-0.5 -right-0.5 min-w-4 h-4 px-1 rounded-full bg-red-400 text-white text-[8.5px] font-extrabold flex items-center justify-center">
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
                <p className="text-[11px] text-white/40 text-center py-6">
                  还没有通知 —— 雷达适配、报价应答、接单进度都会汇总到这里
                </p>
              ) : (
                <div className="flex flex-col gap-2">
                  {items.map((item) => (
                    <NotifyRow key={item.key} item={item} />
                  ))}
                  <button
                    onClick={() => setOpen(false)}
                    className="w-full py-1.5 text-[9.5px] text-white/35 flex items-center justify-center gap-1"
                  >
                    <Check size={9} /> 已读，收起
                  </button>
                </div>
              )}
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </>
  );
}