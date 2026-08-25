"use client";
import { useMemo, useState } from "react";
import { useMountedNow } from "@/lib/use-mounted-now";
import { motion } from "framer-motion";
import { Heart, ShieldCheck, UserPlus } from "lucide-react";
import { useWaveStore } from "@/store/useWaveStore";
import {
  areFriends,
  requestTtlLeft,
  FRIEND_REQUEST_TTL_MS,
} from "@/base/trust/friends";
import type { Claim } from "@/base/order/wave";

/**
 * S3 关系沉淀 — 转友入口，挂在一次成功后履约（互评区）尾部。
 * 双向自愿：任何一方可发起；对方 72h 内确认即成好友；超时静默撤回；
 * 忽略不产生拒绝提示（默认隐私基调）。
 */
export default function FriendKit({
  claim,
  myId,
  peerId,
}: {
  claim: Claim;
  myId: string;
  peerId: string;
}) {
  const friendRequests = useWaveStore((s) => s.friendRequests);
  const friendships = useWaveStore((s) => s.friendships);
  const sendFriendRequest = useWaveStore((s) => s.sendFriendRequest);
  const acceptFriendRequest = useWaveStore((s) => s.acceptFriendRequest);
  const ignoreFriendRequest = useWaveStore((s) => s.ignoreFriendRequest);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState("");
  // use-mounted-now 共享范式（详见 src/lib/use-mounted-now.ts）：首帧 now=0 防
  // Hydration Mismatch，挂载后立即采样并 60s 周期刷新（render 期零时钟采样，红线 1）。
  const now = useMountedNow(60_000);

  const friends = areFriends(friendships, myId, peerId);

  const inbound = useMemo(
    () =>
      friendRequests.find(
        (r) => r.toId === myId && r.fromId === peerId && r.claimId === claim.id
      ),
    [friendRequests, myId, peerId, claim.id]
  );
  const outbound = useMemo(
    () =>
      friendRequests.find(
        (r) => r.fromId === myId && r.toId === peerId && r.claimId === claim.id
      ),
    [friendRequests, myId, peerId, claim.id]
  );

  if (friends) {
    return (
      <p className="text-xs font-bold px-2.5 py-1.5 rounded-xl bg-emerald-400/[0.07] border border-emerald-400/25 text-emerald-300/90 flex items-center gap-1.5">
        <ShieldCheck size={10} /> 已是好友 · 下次见面有优先匹配
      </p>
    );
  }

  // 对方发来请求 → 同意/忽略
  if (inbound) {
    const hours = Math.ceil(requestTtlLeft(inbound, now) / 3_600_000);
    return (
      <motion.div
        initial={{ opacity: 0, y: 6 }}
        animate={{ opacity: 1, y: 0 }}
        className="rounded-xl bg-brandPurple/10 border border-brandPurple/30 px-2.5 py-2"
      >
        <p className="text-xs font-bold text-brandPurple flex items-center gap-1">
          <Heart size={10} /> 对方想和你成为好友 · {hours}h 后自动撤回
        </p>
        <div className="mt-1.5 flex gap-1.5">
          <button
            onClick={() => acceptFriendRequest(inbound.id)}
            className="flex-1 py-1.5 rounded-xl bg-emerald-400/15 border border-emerald-400/40 text-xs font-bold text-emerald-300 hover:brightness-110"
          >
            接受 💞
          </button>
          <button
            onClick={() => ignoreFriendRequest(inbound.id)}
            className="flex-1 py-1.5 rounded-xl bg-white/[0.04] border border-white/10 text-xs font-bold text-white/50 hover:text-white"
          >
            忽略
          </button>
        </div>
      </motion.div>
    );
  }

  // 我已发出请求 → 等待对方确认
  if (outbound) {
    const hours = Math.ceil(requestTtlLeft(outbound, now) / 3_600_000);
    return (
      <p className="text-xs font-bold px-2.5 py-1.5 rounded-xl bg-white/[0.04] border border-white/10 text-white/60 flex items-center gap-1.5">
        <UserPlus size={10} /> 已发出好友请求 · 等待对方确认（{hours}h 后自动撤回）
      </p>
    );
  }

  return (
    <div>
      <button
        onClick={() => {
          const out = sendFriendRequest({
            fromId: myId,
            toId: peerId,
            claimId: claim.id,
          });
          if (out.ok) {
            setSent(true);
            setError("");
          } else {
            setSent(false);
            setError(
              out.error === "friend.self"
                ? "不能添加自己为好友"
                : out.error === "friend.pending"
                  ? "已有待确认的请求"
                  : "已是好友"
            );
          }
        }}
        aria-label="成为好友"
        className="w-full py-2 rounded-xl bg-brandPurple/10 border border-brandPurple/30 text-brandPurple text-xs font-bold hover:bg-brandPurple/20 transition-colors"
      >
        💗 成为好友（自愿 · 对方确认后互认）
      </button>
      {sent && (
        <p className="text-xs text-emerald-300/90 mt-1 flex items-center gap-1">
          <Heart size={9} /> 已发出，对方 {Math.ceil(FRIEND_REQUEST_TTL_MS / 3_600_000)}h 内确认即成好友
        </p>
      )}
      {error && <p className="text-xs text-amber-300/90 mt-1">{error}</p>}
    </div>
  );
}