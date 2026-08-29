"use client";
import { useEffect } from "react";
import DuoButton from "@/components/ui/DuoButton";
import { playDuoSound } from "@/lib/duo-audio";
import { fireDuoConfetti } from "@/lib/duo-confetti";

export interface ISettlementReward {
  type: "XP" | "COUPON" | "CREDIT_SURGE";
  title: string;
  subtitle: string;
  badgeText: string;
  isCritical: boolean;
}

/** djb2 确定性哈希（与后端无关，纯前端礼遇派生，0 Base）。 */
function djb2(str: string): number {
  let hash = 5381;
  for (let i = 0; i < str.length; i++) {
    hash = ((hash << 5) + hash + str.charCodeAt(i)) >>> 0;
  }
  return hash >>> 0;
}

export function deriveSettlementReward(waveId: string): ISettlementReward {
  const h = djb2(waveId || "default");
  const isCritical = h % 10 === 0;
  const r = h % 3;
  if (r === 0) {
    return {
      type: "XP",
      title: isCritical ? "双倍经验暴击！" : "经验值 +50 XP",
      subtitle: isCritical ? "履约成就 · 经验翻倍礼遇" : "完工礼遇 · 经验已入账",
      badgeText: isCritical ? "CRITICAL · 双倍" : "XP +50",
      isCritical,
    };
  }
  if (r === 1) {
    return {
      type: "COUPON",
      title: isCritical ? "立减券暴击！" : "下次发单立减 ¥5 券",
      subtitle: isCritical ? "履约成就 · 券面翻倍礼遇" : "完工礼遇 · 卡券已入钱包",
      badgeText: isCritical ? "CRITICAL · 券翻倍" : "券 ¥5",
      isCritical,
    };
  }
  return {
    type: "CREDIT_SURGE",
    title: isCritical ? "信用跃升暴击！" : "信用积分跃升",
    subtitle: isCritical ? "履约成就 · 信用双倍礼遇" : "完工礼遇 · 信用已加分",
    badgeText: isCritical ? "CRITICAL · 双倍" : "信用 +",
    isCritical,
  };
}

interface SettlementLootModalProps {
  waveId: string;
  open: boolean;
  onClose: () => void;
}

/** 完工礼遇宝箱弹层（纯白 3D + 金色流光，确定性礼遇，0随机）。 */
export default function SettlementLootModal({ waveId, open, onClose }: SettlementLootModalProps) {
  const reward = deriveSettlementReward(waveId);
  useEffect(() => {
    if (!open) return;
    try {
      playDuoSound("correct");
    } catch {}
    try {
      fireDuoConfetti();
    } catch {}
  }, [open]);
  if (!open) return null;
  return (
    <div
      className="fixed inset-0 z-[80] flex items-center justify-center p-4"
      data-testid="settlement-loot-modal"
      role="dialog"
      aria-label="完工礼遇"
    >
      <button
        aria-label="关闭礼遇弹层"
        onClick={onClose}
        className="absolute inset-0 bg-black/40 backdrop-blur-sm"
        data-testid="loot-backdrop"
      />
      <div className="relative w-full max-w-[360px] bg-white rounded-3xl border-2 border-[#e5e5e5] border-b-[6px] shadow-xl p-5 flex flex-col items-center gap-3 animate-[duo-breathe_1.2s_ease]">
        <div className="w-14 h-14 rounded-2xl bg-[#ffc800] border-b-4 border-[#e5b400] flex items-center justify-center text-2xl shadow-sm">
          🎁
        </div>
        {reward.isCritical && (
          <span className="px-2 py-0.5 rounded-full bg-[#ffc800] border-2 border-[#e5b400] text-xs font-extrabold text-[#4b4b4b]">
            ✨ 暴击礼遇
          </span>
        )}
        <h3 className="text-[16px] font-extrabold text-[#4b4b4b] text-center">{reward.title}</h3>
        <p className="text-xs text-[#777777] text-center -mt-1">{reward.subtitle}</p>
        <span className="px-2 py-1 rounded-full bg-[#f7f7f7] border-2 border-[#e5e5e5] text-xs font-bold text-[#4b4b4b]">
          {reward.badgeText}
        </span>
        <p className="text-xs text-[#afafaf] text-center">完工礼遇已自动入账，下次发单/接单即享</p>
        <DuoButton variant="primary" size="lg" fullWidth onClick={onClose} data-testid="claim-reward-btn">
          收下礼遇
        </DuoButton>
      </div>
    </div>
  );
}
