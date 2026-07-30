'use client';

import React from 'react';
import { Coins, ShieldCheck, TrendingUp, Award } from 'lucide-react';

interface EscrowStatsProps {
  balance?: number;
  trustTier?: number;
  settlementRate?: number;
  winRate?: number;
}

export const EscrowStats: React.FC<EscrowStatsProps> = ({
  balance = 12800,
  trustTier = 4,
  settlementRate = 98.5,
  winRate = 92.0,
}) => {
  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
      <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-4 backdrop-blur-xl space-y-1">
        <div className="flex items-center gap-1.5 text-xs text-slate-400">
          <Coins className="w-4 h-4 text-amber-400" /> 灵魂金库余额
        </div>
        <div className="text-2xl font-black font-mono text-cyan-400">￥{balance}</div>
      </div>

      <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-4 backdrop-blur-xl space-y-1">
        <div className="flex items-center gap-1.5 text-xs text-slate-400">
          <ShieldCheck className="w-4 h-4 text-emerald-400" /> Trust Tier 阶级
        </div>
        <div className="text-2xl font-black font-mono text-emerald-400">Tier {trustTier}</div>
      </div>

      <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-4 backdrop-blur-xl space-y-1">
        <div className="flex items-center gap-1.5 text-xs text-slate-400">
          <TrendingUp className="w-4 h-4 text-purple-400" /> 履约结案率
        </div>
        <div className="text-2xl font-black font-mono text-purple-400">{settlementRate}%</div>
      </div>

      <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-4 backdrop-blur-xl space-y-1">
        <div className="flex items-center gap-1.5 text-xs text-slate-400">
          <Award className="w-4 h-4 text-cyan-400" /> AI 仲裁胜诉率
        </div>
        <div className="text-2xl font-black font-mono text-cyan-300">{winRate}%</div>
      </div>
    </div>
  );
};
