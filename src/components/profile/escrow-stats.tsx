'use client';

import React from 'react';
import { Coins, Crown } from 'lucide-react';

interface EscrowStatsProps {
  balance?: number;
  creditScore?: number;
}

/**
 * Batch⑤-3（/profile Duo 化＋诚实化）：
 * 旧版 4 卡含 2 张纯 mock（履约结案率 98.5 / 仲裁胜诉率 92.0 无后端，出厂默认值直接渲染），
 * Trust Tier 传字面量 4——一并出清。只留后端真数：托管余额＋信誉积分。
 */
export const EscrowStats: React.FC<EscrowStatsProps> = ({
  balance = 0,
  creditScore = 0,
}) => {
  return (
    <div className="grid grid-cols-2 gap-4">
      <div className="rounded-2xl border-2 border-[var(--color-duo-swan)] bg-white p-4 space-y-1">
        <div className="flex items-center gap-1.5 text-xs text-[var(--color-duo-wolf)]">
          <Coins className="w-4 h-4 text-[var(--color-duo-yellow-dark)]" /> 托管余额
        </div>
        <div className="text-2xl font-black font-mono text-[var(--color-duo-green-dark)]">￥{balance}</div>
      </div>

      <div className="rounded-2xl border-2 border-[var(--color-duo-swan)] bg-white p-4 space-y-1">
        <div className="flex items-center gap-1.5 text-xs text-[var(--color-duo-wolf)]">
          <Crown className="w-4 h-4 text-[var(--color-duo-yellow-dark)]" /> 信誉积分
        </div>
        <div className="text-2xl font-black font-mono text-[var(--color-duo-eel)]">{creditScore} / 300</div>
      </div>
    </div>
  );
};
