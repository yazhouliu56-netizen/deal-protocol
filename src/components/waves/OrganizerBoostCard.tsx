"use client";
import { useState } from "react";
import { motion } from "framer-motion";
import { Rocket, Check } from "lucide-react";
import DuoButton from "@/components/ui/DuoButton";
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
    <div className="mt-3 rounded-2xl bg-white border-2 border-[var(--color-duo-swan)] border-b-4 p-3">
      <div className="flex items-center gap-2.5">
        <div
          className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 ${
            active
              ? "bg-[var(--color-duo-green)]/10 border-2 border-[var(--color-duo-green)]/40"
              : "bg-[var(--color-duo-green)] border-b-2 border-[var(--color-duo-green-dark)] text-white"
          }`}
        >
          {active ? (
            <Check size={14} className="text-[#357a00]" />
          ) : (
            <Rocket size={14} />
          )}
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-xs font-extrabold text-[var(--color-duo-eel)]">
            {active ? "组局加速已生效" : "组局加速 · ¥9.9/月"}
          </p>
          <p className="text-xs text-[var(--color-duo-wolf)] truncate">
            {active
              ? `到期 ${new Date(sub.expiresAt!).toLocaleDateString()}（剩 ${daysLeft} 天）`
              : "你的局在雷达区优先曝光 · 到期前提醒"}
          </p>
        </div>
        {!confirming && (
          <DuoButton
            variant={active ? "outline" : "primary"}
            size="sm"
            sound="click"
            onClick={() => setConfirming(true)}
            className="shrink-0"
          >
            {active ? "续费" : "开通"}
          </DuoButton>
        )}
      </div>
      {confirming && (
        <motion.div
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: "auto" }}
          className="mt-2.5 pt-2.5 border-t-2 border-[var(--color-duo-swan)]"
        >
          <p className="text-xs text-[var(--color-duo-wolf)]">
            模拟收银台 · 确认支付{" "}
            <span className="text-[var(--color-duo-eel)] font-extrabold">
              ¥{ORGANIZER_PLAN.priceYuan}
            </span>{" "}
            {active ? "续费 30 天" : "开通 30 天"}
          </p>
          <div className="flex items-center gap-2 mt-2">
            <DuoButton
              variant="primary"
              size="sm"
              sound="correct"
              onClick={handleConfirm}
              className="flex-1"
            >
              确认支付
            </DuoButton>
            <DuoButton
              variant="outline"
              size="sm"
              sound="click"
              onClick={() => setConfirming(false)}
              className="shrink-0"
            >
              取消
            </DuoButton>
          </div>
        </motion.div>
      )}
    </div>
  );
}