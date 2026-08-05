"use client";
import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { Wallet, ShieldCheck, Star, Zap } from "lucide-react";
import { useIdentityStore } from "@/store/useIdentityStore";
import { useWaveStore } from "@/store/useWaveStore";
import { quotaHalved } from "@/lib/violation";
import { decayLabel, dailyQuotaForTier } from "@/lib/review";

/**
 * 钱包与信用前台 — virtual balance / credit tier / daily claim quota /
 * breach ledger / masked review list. Makes the P1 virtual-economy
 * transparent in the UI; credit tier re-derives from received reviews.
 */
export default function WalletView() {
  const identity = useIdentityStore((s) => s.identity);
  const account = useIdentityStore((s) => s.account);
  const creditTier = useIdentityStore((s) => s.creditTier);
  const claimQuota = useIdentityStore((s) => s.claimQuota);
  const ledger = useIdentityStore((s) => s.ledger);
  const deposits = useIdentityStore((s) => s.deposits);
  const reviews = useWaveStore((s) => s.reviews);
  const recalcCredit = useIdentityStore((s) => s.recalcCredit);
  const [now] = useState(() => Date.now());
  const halved = quotaHalved(account, now);
  const frozen = deposits
    .filter((d) => d.phase === "held")
    .reduce((sum, d) => sum + d.amount, 0);

  const myReviews = reviews
    .filter((r) => r.toId === identity.id)
    .sort((a, b) => b.at - a.at);

  // 评价驱动信用：收到的评价变化 → 重算等级（额度随之扩容）
  useEffect(() => {
    recalcCredit(myReviews);
  }, [myReviews, recalcCredit]);

  return (
    <div className="glass-panel rounded-2xl p-3.5">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-[11px] font-bold text-white/70 flex items-center gap-1.5">
          <Wallet size={12} className="text-brandCyan" /> 虚拟钱包
        </h3>
        <span className="text-[9px] text-white/35">MVP 模拟 · P5 接入真实账户</span>
      </div>

      <div className="grid grid-cols-3 gap-2">
        {/* 余额 */}
        <div className="rounded-2xl bg-white/[0.04] border border-white/10 p-2.5 flex flex-col items-center gap-0.5">
          <span className="text-[16px] font-extrabold bg-clip-text text-transparent bg-linear-to-r from-brandCyan to-brandPurple">
            ¥{account.balance}
          </span>
          <span className="text-[9px] text-white/50">可用余额</span>
        </div>
        {/* 信用 */}
        <div className="rounded-2xl bg-white/[0.04] border border-white/10 p-2.5 flex flex-col items-center gap-0.5">
          <span className="text-[16px] font-extrabold text-brandPurple flex items-center gap-1">
            <ShieldCheck size={13} className="text-emerald-400" />
            Lv.{creditTier}
          </span>
          <span className="text-[9px] text-white/50">信用等级</span>
        </div>
        {/* 额度 */}
        <div className="rounded-2xl bg-white/[0.04] border border-white/10 p-2.5 flex flex-col items-center gap-0.5">
          <span className="text-[16px] font-extrabold text-brandCyan flex items-center gap-1">
            <Zap size={13} /> {claimQuota}
            {halved && <span className="text-[8px] text-amber-300">(减半)</span>}
          </span>
          <span className="text-[9px] text-white/50">今日接单额度</span>
        </div>
      </div>
      {halved && (
        <p className="mt-2 text-[9.5px] text-amber-300/90">
          违约未谅解：3 天响应额度减半生效中
        </p>
      )}
      {frozen > 0 && (
        <p className="mt-2 text-[9.5px] text-sky-300/90">
          🕊️ 鸽子险冻结中：¥{frozen}（履约后自动退回）
        </p>
      )}
      {creditTier >= 4 && (
        <p className="mt-2 text-[9.5px] text-emerald-300/90">
          ⚡ 信用 Lv.{creditTier} 解锁响应额度扩容：今日 {dailyQuotaForTier(creditTier)} 次
        </p>
      )}

      {/* 我的评价（脱敏 + 时间衰减） */}
      {myReviews.length > 0 && (
        <div className="mt-3">
          <span className="text-[10px] font-semibold text-white/50 block mb-1.5">
            收到的评价（脱敏）
          </span>
          <div className="flex flex-col gap-1">
            {myReviews.slice(0, 5).map((r) => (
              <motion.div
                key={r.id}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="flex items-center justify-between px-2.5 py-1.5 rounded-xl bg-white/[0.03] border border-white/10"
              >
                <span className="flex items-center gap-1.5 text-[9.5px] text-white/60 min-w-0">
                  <Star
                    size={10}
                    className="text-amber-300 fill-amber-300 shrink-0"
                  />
                  {r.score} 分 · {decayLabel(r.at, now)}
                  {r.comment && (
                    <span className="truncate">· {r.comment.slice(0, 16)}</span>
                  )}
                </span>
                <span className="text-[9px] text-white/30 shrink-0 ml-2">
                  准时{r.dimensions.punctual} 态度{r.dimensions.attitude} 专业{r.dimensions.professional}
                </span>
              </motion.div>
            ))}
          </div>
        </div>
      )}

      {/* 流水 */}
      {ledger.length > 0 && (
        <div className="mt-3">
          <span className="text-[10px] font-semibold text-white/50 block mb-1.5">
            最近流水
          </span>
          <div className="flex flex-col gap-1">
            {ledger.slice(0, 5).map((e) => (
              <motion.div
                key={e.id}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="flex items-center justify-between px-2.5 py-1.5 rounded-xl bg-white/[0.03] border border-white/10"
              >
                <span className="text-[9.5px] text-white/60 truncate">{e.note}</span>
                <span className="text-[10px] font-bold text-red-300 shrink-0 ml-2">
                  -¥{Math.abs(e.amount)}
                </span>
              </motion.div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}