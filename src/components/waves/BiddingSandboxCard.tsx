"use client";
import DuoButton from "@/components/ui/DuoButton";
import DuoPill from "@/components/ui/DuoPill";
import { useMemo, useState } from "react";
import { motion } from "framer-motion";
import { Gavel, Trophy, Layers } from "lucide-react";
import { useWaveStore } from "@/store/useWaveStore";
import { useIdentityStore } from "@/store/useIdentityStore";
import { ageFromBirthYear, ageGate } from "@/base/safe/ageGate";
import { pricingForCategory } from "@/ammo/pricing-formula";
import {
  award,
  openBidding,
  placeBid,
  rankBids,
  type BiddingSession,
} from "@/base/money/bidding";

const SEED = [
  { bidderId: "ps-1", bidderName: "微笑保洁", delta: 0, note: "保底报价" },
  { bidderId: "ps-2", bidderName: "轻喜到家", delta: 8, note: "两小时全屋" },
  { bidderId: "ps-3", bidderName: "顺子家政", delta: 15, note: "老店口碑" },
] as const;

/** 初始/重置：保留价 + 3 个模拟响应者报价（跟随保留价），一打开就有气氛。 */
function seedSession(title = "小区保洁 · 名额 1", reserve = 60): BiddingSession {
  let s = openBidding("demo-clean", title, reserve);
  SEED.forEach((b) => {
    const r = placeBid(s, {
      bidderId: b.bidderId,
      bidderName: b.bidderName,
      price: reserve + b.delta,
      note: b.note,
      placedAt: "2026-08-09T08:05:00Z",
    });
    if (r.ok) s = r.session;
  });
  return s;
}

/**
 * 公开竞价（P8 商业化前哨，本地沙盒）—— 现在接入真实需求局：
 * 从「我发出的多人拼单局」里选一个作为拍品（保留价 = 局的人均价），
 * 模拟响应者报价 + 你也能参与。开标仅演示结算，不写回真实局。
 */
export default function BiddingSandboxCard() {
  const waves = useWaveStore((s) => s.waves);
  const settleBidding = useWaveStore((s) => s.settleBidding);
  const identity = useIdentityStore((s) => s.identity);
  // 我发出的活跃多人拼单局（拍卖品候选）
  const myActive = useMemo(
    () =>
      waves.filter(
        (w) =>
          w.authorId === identity.id &&
          !w.removed &&
          (w.status === "active" || w.status === "pending")
      ),
    [waves, identity.id]
  );
  const [session, setSession] = useState<BiddingSession>(() => seedSession());
  const [myPrice, setMyPrice] = useState("66");
  const [error, setError] = useState("");
  // 当前拍品来自真实局？（null = 演示局）
  const [pickedWaveId, setPickedWaveId] = useState<string | null>(null);

  const picked = pickedWaveId
    ? myActive.find((w) => w.id === pickedWaveId) ?? null
    : null;

  const startFor = (waveId: string) => {
    const w = myActive.find((x) => x.id === waveId);
    if (!w) return;
    // 竞价保留价 ≥ 品类地板价（ammo/pricing-formula 驱动，宪法 #4）
    const floor = pricingForCategory(w.basics.category).minPriceYuan ?? 0;
    const reserve = Math.max(w.budget || 0, floor) || 60;
    setSession(seedSession(`${w.basics.category} · 名额 ${w.capacity ?? 1}`, reserve));
    setPickedWaveId(waveId);
    setMyPrice(String(Math.round(reserve)));
    setError("");
  };

  const reset = () => {
    setSession(seedSession());
    setPickedWaveId(null);
    setMyPrice("66");
    setError("");
  };

const open = session.status === "open";
  const ranked = rankBids(session);
  const myLowest = open && ranked.length > 0 && ranked[0].bidderId === "me";

  const handleBid = () => {
    // 未成年人资金闸：竞价出价涉及资金，青少年/儿童拦截
    if (identity.birthYear) {
      const gate = ageGate({
        age: ageFromBirthYear(identity.birthYear, new Date().getFullYear()),
        action: "bidding",
        guardianConsent: identity.guardianConsent,
      });
      if (gate.blocked) {
        setError(gate.reason);
        return;
      }
    }
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
      setError(r.error === "below-reserve" ? `报价低于保留价 ¥${session.reserveYuan}` : "竞价已结束");
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
    // P8 商业化：开标结算写回真实局（中标者/佣金/净得持久落库，我的局可见）
    if (picked && next.award) {
      settleBidding(picked.id, {
        winnerId: next.award.winnerId,
        winnerName: next.award.winnerName,
        price: next.award.price,
        feeYuan: next.award.feeYuan,
        netYuan: next.award.netYuan,
        at: Date.now(),
      });
      // 竞价服务费入账：发起人钱包按成交额 8% 记平台佣金支出（幂等：已记过不再记）
      if (!useIdentityStore.getState().ledger.some(
        (e) => e.kind === "commission" && e.note.includes(picked.id)
      )) {
        useIdentityStore.getState().book(
          "commission",
          -next.award.feeYuan,
          `竞价服务费 · ${picked.basics.category} 成交 ¥${next.award.price}（局 ${picked.id.slice(-6)}）`
        );
      }
    }
  };

  return (
    <div className="mt-3 rounded-2xl bg-white border border-dashed border-[var(--color-duo-swan)] shadow-sm p-3">
      <div className="flex items-center gap-2.5">
        <div className="w-8 h-8 rounded-xl bg-white border border-[var(--color-duo-swan)] shadow-sm flex items-center justify-center shrink-0">
          <Gavel size={14} className="text-[var(--color-duo-wolf)]" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-xs font-extrabold text-[var(--color-duo-eel)] flex items-center gap-1.5">
            公开竞价 · 演示沙盒
            {picked ? (
              <DuoPill tone="green" className="font-extrabold">
                你的真实需求局
              </DuoPill>
            ) : (
              <DuoPill tone="neutral">
                演示局 · 无真实资金
              </DuoPill>
            )}
          </p>
          <p className="text-xs text-[var(--color-duo-hare)] truncate">
            {session.title} · 保留价 ¥{session.reserveYuan} · 已收到 {ranked.length} 个报价
          </p>
        </div>
        {!open && (
          <button
            type="button"
            onClick={reset}
            className="shrink-0 px-3 py-2 min-h-10 rounded-full bg-[var(--color-duo-polar)] border border-[var(--color-duo-swan)] text-[var(--color-duo-wolf)] text-xs font-bold hover:bg-[var(--color-duo-polar)] transition-colors"
          >
            再开一局
          </button>
        )}
      </div>

      {/* 真实局选择：我发出的活跃多人拼单局即拍品候选 */}
      {myActive.length > 0 && (
        <div className="mt-2.5 flex items-center gap-2">
          <Layers size={10} className="text-[var(--color-duo-blue-ink)] shrink-0" />
          <select
            value={pickedWaveId ?? ""}
            onChange={(e) => {
              const v = e.target.value;
              if (v) startFor(v);
              else reset();
            }}
            aria-label="选择要竞价的真实需求局"
            className="flex-1 min-w-0 min-h-10 rounded-xl bg-white border-2 border-[var(--color-duo-swan)] px-2 py-1.5 text-xs font-bold text-[var(--color-duo-eel)] outline-none focus:border-[var(--color-duo-blue)]"
          >
            <option value="">
              演示局 · 小区保洁
            </option>
            {myActive.map((w) => (
              <option key={w.id} value={w.id}>
                {w.basics.category} · ¥{w.budget}
              </option>
            ))}
          </select>
        </div>
      )}

      {/* 报价板（低价优先） */}
      <div className="mt-2.5 space-y-1.5">
        {ranked.map((b, i) => {
          const mine = b.bidderId === "me";
          const leader = session.award?.winnerId === b.bidderId;
          return (
            <div
              key={b.bidderId}
              className={`flex items-center gap-2 rounded-xl px-2.5 py-2 text-xs border-2 ${
                leader
                  ? "bg-[var(--color-duo-green)]/10 border-[var(--color-duo-green)]/40"
                  : mine
                    ? "bg-white border-[var(--color-duo-swan)]"
                    : "bg-[var(--color-duo-polar)] border-transparent"
              }`}
            >
              <span className="w-4 text-[var(--color-duo-hare)] font-mono shrink-0">
                #{i + 1}
              </span>
              <span className="font-bold text-[var(--color-duo-eel)] truncate">
                {b.bidderName}
                {leader && (
                  <span className="ml-1.5 text-[var(--color-duo-green-ink)] font-extrabold">
                    中标
                  </span>
                )}
              </span>
              <span className="ml-auto font-mono font-extrabold text-[var(--color-duo-eel)]">
                ¥{b.price}
              </span>
              {b.note && <span className="text-[var(--color-duo-hare)] truncate">{b.note}</span>}
            </div>
          );
        })}
        {ranked.length === 0 && (
          <p className="text-xs text-[var(--color-duo-hare)] py-1 text-center">
            还没有报价 —— 出价抢占榜一
          </p>
        )}
      </div>

      {/* 你的出价 */}
      {open && (
        <div className="mt-2.5 pt-2.5 border-t border-[var(--color-duo-swan)] flex items-center gap-2">
          <input
            value={myPrice}
            onChange={(e) => setMyPrice(e.target.value)}
            inputMode="numeric"
            aria-label="我的报价"
            className="w-20 min-h-10 rounded-xl bg-white border-2 border-[var(--color-duo-swan)] px-2.5 py-2 text-xs font-mono text-[var(--color-duo-eel)] outline-none focus:border-[var(--color-duo-blue)]"
          />
          <DuoButton
            variant="secondary"
            size="sm"
            sound="click"
            onClick={handleBid}
            className="flex-1"
          >
            {myLowest ? "保持最低价 · 稳住榜一" : "出价"}
          </DuoButton>
          <DuoButton
            variant="primary"
            size="sm"
            sound="correct"
            onClick={handleAward}
            className="shrink-0"
          >
            立即开标
          </DuoButton>
        </div>
      )}

      {/* 结算结果 */}
      {session.award && (
        <motion.div
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: "auto" }}
          className="mt-2.5 pt-2.5 border-t border-[var(--color-duo-swan)]"
        >
          <div className="flex items-center gap-2 text-xs font-extrabold text-[var(--color-duo-green-ink)]">
            <Trophy size={12} />
            {session.award.winnerId === "me"
              ? "你中标了！"
              : `${session.award.winnerName} 中标`}
            <span className="text-[var(--color-duo-hare)] font-mono">
              ¥{session.award.price} · 平台佣金 ¥{session.award.feeYuan} ·
              净得 ¥{session.award.netYuan}
            </span>
          </div>
        </motion.div>
      )}

      {error && (
        <p className="mt-2 px-3 py-1.5 rounded-xl bg-[var(--color-duo-red)]/10 border-2 border-[var(--color-duo-red)]/40 text-xs font-bold text-[var(--color-duo-red-dark)]">
          {error}
        </p>
      )}
    </div>
  );
}