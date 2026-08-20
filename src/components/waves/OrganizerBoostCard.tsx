"use client";
import { useState } from "react";
import { motion } from "framer-motion";
import { Rocket, Check } from "lucide-react";
import { useOrganizerSubStore } from "@/store/useOrganizerSubStore";
import { useIdentityStore } from "@/store/useIdentityStore";
import {
  ORGANIZER_PLAN,
  subDaysLeft,
  subStatus,
} from "@/base/money/organizerSubscription";

/**
 * 组局加速卡 —— 商业化前哨（纯本地 demo）。
 * 开通「组局加速」后自己的需求在雷达区优先曝光；到期前本地提醒续费。
 * 支付走页面内两段式确认（模拟收银台），不入库。
 */
export default function OrganizerBoostCard() {
  const sub = useOrganizerSubStore((s) => s.sub);
  const activate = useOrganizerSubStore((s) => s.activate);
  const [confirming, setConfirming] = useState(false);

  const status = subStatus(sub);
  const daysLeft = subDaysLeft(sub);
  const active = status === "active";

  const handleConfirm = () => {
    // 订阅 → 钱包联动：¥9.9/月 模拟扣款入账（余额不足则扣至 0）
    useIdentityStore.getState().book("subscription", -ORGANIZER_PLAN.priceYuan, "组局加速订阅 · 30 天");
    activate();
    setConfirming(false);
  };

  return (
    <div className="mt-3 rounded-2xl border border-brandPurple/25 bg-gradient-to-r from-brandPurple/10 via-[#151230]/80 to-brandPurple/10 p-3">
      <div className="flex items-center gap-2.5">
        <div
          className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 ${
            active
              ? "bg-emerald-400/15 border border-emerald-400/30"
              : "btn-primary glow-purple-strong"
          }`}
        >
          {active ? (
            <Check size={14} className="text-emerald-300" />
          ) : (
            <Rocket size={14} />
          )}
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-xs font-extrabold text-white/90">
            {active ? "组局加速已生效" : "组局加速 · ¥9.9/月"}
          </p>
          <p className="text-xs text-white/45 truncate">
            {active
              ? `到期 ${new Date(sub.expiresAt!).toLocaleDateString()}（剩 ${daysLeft} 天）`
              : "你的局在雷达区优先曝光 · 到期前提醒"}
          </p>
        </div>
        {!confirming && (
          <button
            type="button"
            onClick={() => setConfirming(true)}
            className={`shrink-0 px-3 py-2 min-h-10 rounded-full text-xs font-bold transition-colors ${
              active
                ? "bg-white/5 border border-white/15 text-white/60"
                : "bg-brandPurple/20 border border-brandPurple/40 text-brandPurple font-extrabold hover:bg-brandPurple/30"
            }`}
          >
            {active ? "续费" : "开通"}
          </button>
        )}
      </div>
      {confirming && (
        <motion.div
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: "auto" }}
          className="mt-2.5 pt-2.5 border-t border-white/10"
        >
          <p className="text-xs text-white/55">
            模拟收银台 · 确认支付{" "}
            <span className="text-white font-extrabold">
              ¥{ORGANIZER_PLAN.priceYuan}
            </span>{" "}
            {active ? "续费 30 天" : "开通 30 天"}
          </p>
          <div className="flex items-center gap-2 mt-2">
            <button
              type="button"
              onClick={handleConfirm}
              className="flex-1 py-2 rounded-xl bg-emerald-400/15 border border-emerald-400/40 text-emerald-300 text-xs font-extrabold hover:bg-emerald-400/25 transition-colors"
            >
              确认支付
            </button>
            <button
              type="button"
              onClick={() => setConfirming(false)}
              className="px-3 py-2 rounded-xl bg-white/5 border border-white/15 text-white/60 text-xs font-bold hover:bg-white/10 transition-colors"
            >
              取消
            </button>
          </div>
        </motion.div>
      )}
    </div>
  );
}