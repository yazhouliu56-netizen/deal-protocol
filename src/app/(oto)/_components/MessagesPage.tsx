"use client";
import { useEffect, useMemo, useState, useSyncExternalStore } from "react";
import { MessageCircle } from "lucide-react";
import { useIdentityStore } from "@/store/useIdentityStore";
import { useWaveStore } from "@/store/useWaveStore";
import { keyOf, threadMessages, unreadTotal } from "@/base/comm/im";
import { dialInNumber, findSession, maskNumber, minutesLeft } from "@/base/comm/privacyNumber";
import ContactCard from "@/components/waves/ContactCard";
import { CATEGORY_EMOJI } from "./categoryEmoji";

export default function MessagesPage({ onGoHome }: { onGoHome: () => void }) {
  const sessions = useWaveStore((s) => s.privacySessions);
  const imThreads = useWaveStore((s) => s.imThreads);
  const imMessages = useWaveStore((s) => s.imMessages);
  const waves = useWaveStore((s) => s.waves);
  const identity = useIdentityStore((s) => s.identity);
  const me = identity.id;
  const unread = unreadTotal(imThreads, me);
  const mounted = useSyncExternalStore(() => () => {}, () => true, () => false);
  const [now, setNow] = useState(0);
  useEffect(() => {
    if (!mounted) return;
    const tick = () => setNow(Date.now());
    const immediate = window.setTimeout(tick, 0);
    const interval = window.setInterval(tick, 30_000);
    return () => { window.clearTimeout(immediate); window.clearInterval(interval); };
  }, [mounted]);
  const convos = useMemo(() => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const groups = new Map<string, any>();
    for (const s of sessions) {
      const found = findSession(sessions, s.waveId, me, now);
      if (!found) continue;
      const { session, live } = found;
      const peerId = session.aId === me ? session.bId : session.aId;
      const thread = imThreads.find((t) => t.id === keyOf(me, peerId));
      const msgs = thread ? threadMessages(imMessages, thread.id) : [];
      const last = msgs[msgs.length - 1] ?? null;
      const wave = waves.find((w) => w.id === session.waveId);
      const unreadForMe = thread ? (thread.aId === me ? thread.unreadA : thread.unreadB) : 0;
      groups.set(session.waveId, { session, live, peerId, last, wave, unreadForMe });
    }
    return [...groups.values()].sort((a, b) => (b.last?.at ?? 0) - (a.last?.at ?? 0));
  }, [sessions, imThreads, imMessages, waves, me, now]);
  return (
    <div className="pointer-events-auto">
      <div className="flex items-center gap-2.5 mb-3">
        <div className="w-10 h-10 rounded-xl bg-white border-2 border-[#e5e5e5] border-b-[4px] shadow-sm flex items-center justify-center shrink-0"><MessageCircle size={17} className="text-[#1cb0f6]" /></div>
        <div className="flex-1 min-w-0"><h2 className="text-[17px] font-extrabold text-[#4b4b4b]">消息</h2><p className="text-xs text-[#777777]">即时通讯 · 48h 隐私号会话中枢（双方号码均不落地）</p></div>
        {unread > 0 && <span className="px-2 py-1 rounded-full bg-[#58cc02] border-2 border-[#46a302] text-white text-xs font-bold font-tabular shadow-sm">{unread} 条未读</span>}
      </div>
      {convos.length === 0 ? (
        <div className="bg-white rounded-3xl border-2 border-[#e5e5e5] border-b-[6px] shadow-sm p-6 text-center"><span className="text-3xl inline-block">💬</span><p className="text-[12px] font-bold text-[#4b4b4b] mt-2">还没有私密会话</p><p className="text-xs text-[#777777] mt-1">去首页发单撮合，订单锁定后隐私号与 IM 私信自动出现在这里 · 48h 后自动回收</p><button onClick={onGoHome} className="mt-4 px-4 py-2.5 rounded-xl bg-[#58cc02] border-b-4 border-[#46a302] text-white text-xs font-bold shadow-sm active:translate-y-1 active:border-b-0 transition-[transform]">✨ 去首页发单</button></div>
      ) : (
        <div className="flex flex-col gap-3">{convos.map((c) => { const myNumber = dialInNumber(c.session, me); return (<div key={c.session.waveId} className="bg-white rounded-3xl border-2 border-[#e5e5e5] border-b-[6px] shadow-sm p-3"><div className="flex items-center gap-2.5 mb-2"><div className="w-9 h-9 rounded-xl bg-white border-2 border-[#e5e5e5] flex items-center justify-center text-base shrink-0 shadow-sm">{CATEGORY_EMOJI[c.wave?.basics.category ?? ""] ?? "🎟️"}</div><div className="flex-1 min-w-0"><p className="text-[12px] font-bold text-[#4b4b4b] truncate">{c.wave?.basics.category ?? "订单会话"}</p><p className="text-xs text-[#777777] truncate font-mono">{maskNumber(myNumber)} · {c.live ? `${minutesLeft(c.session, now)} 分钟后失效` : "会话已过期"}</p></div>{c.unreadForMe > 0 && <span className="px-1.5 py-0.5 rounded-full bg-[#58cc02] text-white text-xs font-extrabold font-tabular border-2 border-white shadow-sm">{c.unreadForMe}</span>}</div>{c.last && <p className="text-xs text-[#777777] truncate mb-1.5 bg-[#f7f7f7] rounded-xl px-2.5 py-2 border border-[#e5e5e5]">{c.last.fromId === me ? "我：" : "对方："}{c.last.text}</p>}<ContactCard waveId={c.session.waveId} peerId={c.peerId} /></div>); })}</div>
      )}
    </div>
  );
}
