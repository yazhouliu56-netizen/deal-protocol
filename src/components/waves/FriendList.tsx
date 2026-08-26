"use client";
import { useEffect, useMemo } from "react";
import { useMountedNow } from "@/lib/use-mounted-now";
import { Heart, Users } from "lucide-react";
import { useWaveStore } from "@/store/useWaveStore";
import { useIdentityStore } from "@/store/useIdentityStore";
import { requestTtlLeft } from "@/adapters/social/friends";

/**
 * S3 关系沉淀 · 好友列表 — 已互认的好友 + 待我确认的转友请求。
 * 默认隐私：只展示双方已确认互认的关系；请求在个人中心静默倒计时，
 * 72h 未处理自动撤回（无拒绝提示）。
 */
export default function FriendList() {
  const identity = useIdentityStore((s) => s.identity);
  const responders = useWaveStore((s) => s.responders);
  const friendRequests = useWaveStore((s) => s.friendRequests);
  const friendships = useWaveStore((s) => s.friendships);
  const acceptFriendRequest = useWaveStore((s) => s.acceptFriendRequest);
  const ignoreFriendRequest = useWaveStore((s) => s.ignoreFriendRequest);
  const sweepFriendRequests = useWaveStore((s) => s.sweepFriendRequests);
  // SSR/首帧同构探针（page.tsx 同款 idiom）：首帧 now=0 两端一致防 Hydration Mismatch，
  const now = useMountedNow(60_000);

  // 72h 到期静默撤回
  useEffect(() => {
    sweepFriendRequests();
  }, [sweepFriendRequests, friendRequests.length]);

  const mine = useMemo(
    () =>
      friendships
        .filter(
          (f) => f.aId === identity.id || f.bId === identity.id
        )
        .map((f) => (f.aId === identity.id ? f.bId : f.aId))
        .map((peerId) => ({
          id: peerId,
          nickname:
            responders.find((r) => r.id === peerId)?.nickname ??
            `光点 · ${peerId.slice(-4)}`,
        })),
    [friendships, responders, identity.id]
  );

  const incoming = useMemo(
    () =>
      friendRequests
        .filter((r) => r.toId === identity.id)
        .map((r) => ({
          ...r,
          nickname:
            responders.find((x) => x.id === r.fromId)?.nickname ??
            `光点 · ${r.fromId.slice(-4)}`,
          hours: Math.ceil(requestTtlLeft(r, now) / 3_600_000),
        })),
    [friendRequests, responders, identity.id, now]
  );

  if (mine.length === 0 && incoming.length === 0) return null;

  return (
    <div className="glass-panel rounded-2xl p-3.5">
      <h3 className="text-xs font-bold text-white/70 mb-2 flex items-center gap-1.5">
        <Heart size={11} className="text-brandPurple" /> 我的关系
      </h3>

      {incoming.length > 0 && (
        <div className="mb-3 space-y-2">
          <p className="text-xs font-bold text-brandPurple">
            待确认的好友请求
          </p>
          {incoming.map((r) => (
            <div
              key={r.id}
              className="rounded-xl bg-brandPurple/10 border border-brandPurple/30 px-2.5 py-2 flex items-center justify-between gap-2"
            >
              <p className="text-xs font-bold text-white/85 truncate">
                {r.nickname}
                <span className="text-white/40 font-normal">
                  {" "}
                  · {r.hours}h 后撤回
                </span>
              </p>
              <div className="flex gap-1 shrink-0">
                <button
                  onClick={() => acceptFriendRequest(r.id)}
                  className="px-2 py-1 rounded-lg bg-emerald-400/15 border border-emerald-400/40 text-xs font-bold text-emerald-300 hover:brightness-110"
                >
                  接受
                </button>
                <button
                  onClick={() => ignoreFriendRequest(r.id)}
                  className="px-2 py-1 rounded-lg bg-white/[0.04] border border-white/10 text-xs font-bold text-white/50 hover:text-white"
                >
                  忽略
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      <div className="flex flex-wrap gap-1.5">
        {mine.map((f) => (
          <span
            key={f.id}
            className="text-xs px-2.5 py-1 rounded-full bg-emerald-400/[0.07] border border-emerald-400/25 text-emerald-200/90 flex items-center gap-1"
          >
            <Users size={9} /> {f.nickname}
          </span>
        ))}
        {mine.length === 0 && (
          <p className="text-xs text-white/40">
            还没有好友——完成一次履约后，可自愿与对方互认
          </p>
        )}
      </div>
      <p className="text-xs text-white/30 mt-2">
        好友默认不可见 · 转友请求 72h 未确认自动撤回，不产生拒绝提示
      </p>
    </div>
  );
}