"use client";

import { useEffect, useMemo, useState } from "react";
import { MessageSquare, Phone, PhoneCall } from "lucide-react";
import { useWaveStore } from "@/store/useWaveStore";
import { useIdentityStore } from "@/store/useIdentityStore";
import { dialInNumber, findSession, maskNumber, minutesLeft } from "@/base/comm/privacyNumber";

/**
 * 隐私号 + 私信中枢卡（ADR-0010，N1+N15）。
 * 订单锁定后：双向虚拟号（掩码显示 + 48h 会话）+ 一键私信对方（IM 线程）。
 */
export default function ContactCard({
  waveId,
  peerId,
}: {
  waveId: string;
  peerId: string;
}) {
  const me = useIdentityStore((s) => s.identity.id);
  const sessions = useWaveStore((s) => s.privacySessions);
  const sendIm = useWaveStore((s) => s.sendIm);
  const imThreads = useWaveStore((s) => s.imThreads);
  const markImRead = useWaveStore((s) => s.markImRead);
  const imMessages = useWaveStore((s) => s.imMessages);
  const offlineQueue = useWaveStore((s) => s.offlineQueue);
  const replayQueue = useWaveStore((s) => s.replayQueue);

  const [open, setOpen] = useState(false);
  const [text, setText] = useState("");
  const [dialed, setDialed] = useState(false);
  /** 在线状态（online 事件触发重放）。 */
  const [online, setOnline] = useState(() =>
    typeof navigator === "undefined" ? true : navigator.onLine
  );
  useEffect(() => {
    const on = () => {
      setOnline(true);
      replayQueue();
    };
    const off = () => setOnline(false);
    window.addEventListener("online", on);
    window.addEventListener("offline", off);
    return () => {
      window.removeEventListener("online", on);
      window.removeEventListener("offline", off);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const pendingIm = offlineQueue.filter((q) => !q.done && q.op.kind === "sendIm").length;

  // 会话倒计时/过期判定实时刷新（30s 周期，避免挂载后冻结）
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 30_000);
    return () => window.clearInterval(timer);
  }, []);
  const found = findSession(sessions, waveId, me, now);
  const session = found?.session;
  const live = found?.live ?? false;
  const peerName = imThreads.find((t) => t.id === [me, peerId].sort().join("|"));

  const threadMsgs = useMemo(() => {
    if (!peerName) return [];
    return imMessages
      .filter((m) => m.threadId === peerName.id)
      .sort((a, b) => a.at - b.at);
  }, [peerName, imMessages]);

  const unread =
    peerName && (peerName.aId === me ? peerName.unreadA : peerName.unreadB);

  if (!session) return null;

  const myNumber = dialInNumber(session, me);

  const submit = () => {
    if (!text.trim()) return;
    sendIm(me, peerId, text.trim(), waveId);
    setText("");
    if (peerName) markImRead(peerName.id, me);
  };

  return (
    <div className="rounded-2xl bg-brandCyan/[0.05] border border-brandCyan/25 p-3 space-y-2">
      {/* 弱网离线队列（ADR-0014 N11 接线）：离线消息已缓冲，恢复自动重放 */}
      {!online && pendingIm > 0 && (
        <div className="flex items-center justify-between rounded-lg bg-amber-400/10 border border-amber-400/40 px-2 py-1.5">
          <span className="text-[8.5px] font-bold text-amber-300">
            📡 离线中 · {pendingIm} 条消息已入队，联网后自动发送
          </span>
          <button
            onClick={() => replayQueue()}
            className="text-[8.5px] text-white/60 hover:text-white underline underline-offset-2"
          >
            手动重发
          </button>
        </div>
      )}
      <div className="flex items-center justify-between">
        <span className="text-[10px] font-extrabold text-brandCyan flex items-center gap-1.5">
          <Phone size={11} /> 隐私通话（ADR-0010）
        </span>
        <span
          className={`text-[9px] font-bold ${
            live ? "text-emerald-300" : "text-white/35"
          }`}
        >
          {live ? `${minutesLeft(session, now)} 分钟后失效` : "会话已过期"}
        </span>
      </div>
      <div className="flex items-center gap-2">
        <span className="font-mono text-[12px] font-extrabold text-white/85 tracking-widest">
          {maskNumber(myNumber)}
        </span>
        <button
          onClick={() => {
            setDialed(true);
            window.setTimeout(() => setDialed(false), 1500);
          }}
          className={`flex items-center gap-1 px-2 py-1 rounded-full text-[9px] font-bold transition-colors ${
            live
              ? "bg-brandCyan/20 text-brandCyan border border-brandCyan/40"
              : "bg-white/[0.04] text-white/30 border border-white/10"
          }`}
          disabled={!live}
        >
          <PhoneCall size={9} /> {dialed ? "呼出中…" : "拨号（模拟）"}
        </button>
        <button
          onClick={() => setOpen(!open)}
          className="flex items-center gap-1 px-2 py-1 rounded-full text-[9px] font-bold bg-white/[0.05] text-white/70 border border-white/10 ml-auto"
        >
          <MessageSquare size={9} />
          私信对方
          {unread != null && unread > 0 && (
            <span className="ml-0.5 px-1 rounded-full bg-brandCyan text-black text-[8px] font-extrabold">
              {unread}
            </span>
          )}
        </button>
      </div>
      <p className="text-[8.5px] text-white/35">
        虚拟线路 · 双方号码均不落地真实号 · 订单终局自动回收
      </p>

      {open && (
        <div className="space-y-2 pt-1 border-t border-white/10">
          <div className="max-h-28 overflow-y-auto space-y-1">
            {threadMsgs.length === 0 && (
              <p className="text-[9px] text-white/35 py-1 text-center">
                暂无消息，打个招呼吧
              </p>
            )}
            {threadMsgs.map((m) => (
              <div
                key={m.id}
                className={`px-2 py-1 rounded-lg text-[9.5px] max-w-[85%] ${
                  m.fromId === me
                    ? "ml-auto bg-brandCyan/20 text-white/85"
                    : "bg-white/[0.06] text-white/70"
                }`}
              >
                {m.text}
              </div>
            ))}
          </div>
          <div className="flex gap-1.5">
            <input
              value={text}
              onChange={(e) => setText(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && submit()}
              placeholder="私信对方…（IM 中枢）"
              className="flex-1 bg-white/[0.06] border border-white/10 rounded-lg px-2 py-1.5 text-[9.5px] text-white/80 placeholder-white/25 outline-none focus:border-brandCyan/50"
            />
            <button
              onClick={submit}
              className="px-2.5 py-1 rounded-lg bg-brandCyan text-black text-[9px] font-extrabold"
            >
              发送
            </button>
          </div>
        </div>
      )}
    </div>
  );
}