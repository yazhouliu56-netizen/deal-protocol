"use client";
import { useState } from "react";
import { motion } from "framer-motion";
import { Gavel, Trophy } from "lucide-react";
import {
  award,
  openBidding,
  placeBid,
  rankBids,
  type BiddingSession,
} from "@/lib/bidding";

const SEED = [
  { bidderId: "ps-1", bidderName: "微笑保洁", price: 88, note: "含基础工具" },
  { bidderId: "ps-2", bidderName: "轻喜到家", price: 72, note: "两小时全屋" },
  { bidderId: "ps-3", bidderName: "顺子家政", price: 95, note: "老店口碑" },
] as const;

/** 初始/重置：保留价 ¥60 + 3 个模拟响应者报价，让演示一打开就有气氛。 */
function seedSession(): BiddingSession {
  let s = openBidding("demo-clean", "小区保洁 · 名额 1", 60);
  SEED.forEach((b) => {
    const r = placeBid(s, { ...b, placedAt: "2026-08-09T08:05:00Z" });
    if (r.ok) s = r.session;
  });
  return s;
}

/**
 * 公开竞价演示（P8 商业化前哨，纯本地沙盒）—— 不接入真实 wave，
 * 跑通完整闭环：3 个模拟响应者报价 → 你也可出价(≥保留价) → 低价排序
 * → 开标抽佣结算（平台佣金 8% 下限 ¥2）。
 */
export default function BiddingSandboxCard() {
  const [session, setSession] = useState<BiddingSession>(() =>
    seedSession()
  );
  const [myPrice, setMyPrice] = useState("66");
  const [error, setError] = useState("");

const open = session.status === "open";
  const ranked = rankBids(session);
  const myLowest = open && ranked.length > 0 && ranked[0].bidderId === "me";

  const handleBid = () => {
    const price = Number(myPrice);
    if (!Number.isFinite(price) || price <= 0) {
      setError("请输入有效报价");
      return;
    }
    const r = placeBid(session, {
      bidderId: "me",
      bidderName: "我",
      price,
      note: "",
      placedAt: new Date().toISOString(),
    });
    if (!r.ok) {
      setError(r.error === "below-reserve" ? "报价低于保留价 ¥60" : "竞价已结束");
      return;
    }
    setError("");
    setSession(r.session);
  };

  const handleAward = () => {
    const next = award(session);
    if (next.status === "open") {
      setError("至少需要 1 个报价才能开标");
      return;
    }
    setError("");
    setSession(next);
  };

  const reset = () => {
    setSession(seedSession());
    setMyPrice("66");
    setError("");
  };

  return (
    <div className="mt-3 rounded-2xl border border-brandPurple/25 bg-gradient-to-r from-brandPurple/10 via-[#151230]/80 to-brandPurple/10 p-3">
      <div className="flex items-center gap-2.5">
        <div className="w-8 h-8 rounded-xl btn-primary glow-purple-strong flex items-center justify-center shrink-0">
          <Gavel size={14} />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-[11px] font-extrabold text-white/90">
            公开竞价 · 演示
          </p>
          <p className="text-[9px] text-white/45 truncate">
            小区保洁 · 名额 1 · 保留价 ¥60 · 已收到 {ranked.length} 个报价
          </p>
        </div>
        {!open && (
          <button
            type="button"
            onClick={reset}
            className="shrink-0 px-2.5 py-1.5 rounded-full bg-white/5 border border-white/15 text-white/60 text-[10px] font-bold hover:bg-white/10 transition-colors"
          >
            再开一局
          </button>
        )}
      </div>

      {/* 报价板（低价优先） */}
      <div className="mt-2.5 space-y-1.5">
        {ranked.map((b, i) => {
          const mine = b.bidderId === "me";
          const leader = session.award?.winnerId === b.bidderId;
          return (
            <div
              key={b.bidderId}
              className={`flex items-center gap-2 rounded-xl px-2.5 py-2 text-[10px] ${
                leader
                  ? "bg-emerald-400/15 border border-emerald-400/40"
                  : mine
                    ? "bg-white/10 border border-white/20"
                    : "bg-white/5 border border-transparent"
              }`}
            >
              <span className="w-4 text-white/30 font-mono shrink-0">
                #{i + 1}
              </span>
              <span className="font-bold text-white/85 truncate">
                {b.bidderName}
                {leader && (
                  <span className="ml-1.5 text-emerald-300 font-extrabold">
                    中标
                  </span>
                )}
              </span>
              <span className="ml-auto font-mono font-extrabold text-white/90">
                ¥{b.price}
              </span>
              {b.note && <span className="text-white/40 truncate">{b.note}</span>}
            </div>
          );
        })}
        {ranked.length === 0 && (
          <p className="text-[10px] text-white/40 py-1 text-center">
            还没有报价 —— 出价抢占榜一
          </p>
        )}
      </div>

      {/* 你的出价 */}
      {open && (
        <div className="mt-2.5 pt-2.5 border-t border-white/10 flex items-center gap-2">
          <input
            value={myPrice}
            onChange={(e) => setMyPrice(e.target.value)}
            inputMode="numeric"
            aria-label="我的报价"
            className="w-20 rounded-xl bg-white/5 border border-white/15 px-2.5 py-2 text-[10px] font-mono text-white/90 outline-none focus:border-brandPurple/60"
          />
          <button
            type="button"
            onClick={handleBid}
            className="flex-1 py-2 rounded-xl bg-brandPurple/20 border border-brandPurple/40 text-brandPurple text-[10px] font-extrabold hover:bg-brandPurple/30 transition-colors"
          >
            {myLowest ? "保持最低价 · 稳住榜一" : "出价"}
          </button>
          <button
            type="button"
            onClick={handleAward}
            className="shrink-0 px-3 py-2 rounded-xl bg-emerald-400/15 border border-emerald-400/40 text-emerald-300 text-[10px] font-extrabold hover:bg-emerald-400/25 transition-colors"
          >
            立即开标
          </button>
        </div>
      )}

      {/* 结算结果 */}
      {session.award && (
        <motion.div
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: "auto" }}
          className="mt-2.5 pt-2.5 border-t border-white/10"
        >
          <div className="flex items-center gap-2 text-[10px] font-extrabold text-emerald-300">
            <Trophy size={12} />
            {session.award.winnerId === "me"
              ? "你中标了！"
              : `${session.award.winnerName} 中标`}
            <span className="text-white/50 font-mono">
              ¥{session.award.price} · 平台佣金 ¥{session.award.feeYuan} ·
              净得 ¥{session.award.netYuan}
            </span>
          </div>
        </motion.div>
      )}

      {error && (
        <p className="mt-2 px-3 py-1.5 rounded-xl bg-red-400/10 border border-red-400/35 text-[10px] font-bold text-red-300">
          {error}
        </p>
      )}
    </div>
  );
}