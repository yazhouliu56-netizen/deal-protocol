'use client';

import React from 'react';
import { motion } from 'framer-motion';
import { Tables } from '@/types/database.types';
import { Shield, Zap, Cpu, Sparkles, Coins, ArrowUpRight, User } from 'lucide-react';

export interface DemandCardProps {
  demand: Tables<'demands'>;
  onSelect?: (id: string) => void;
}

const statusMap: Record<string, { label: string; color: string }> = {
  open: { label: '招募中', color: 'bg-cyan-950/80 text-cyan-300 border-cyan-500/50' },
  in_progress: { label: '履约突破中', color: 'bg-amber-950/80 text-amber-300 border-amber-500/50' },
  completed: { label: '已提质验收', color: 'bg-purple-950/80 text-purple-300 border-purple-500/50' },
  settled: { label: '已解冻归档', color: 'bg-emerald-950/80 text-emerald-300 border-emerald-500/50' },
};

export const DemandCard: React.FC<DemandCardProps> = ({ demand, onSelect }) => {
  const statusInfo = statusMap[demand.status || 'open'] || statusMap.open;

  const mockChips = ['chip-ai-radar', demand.budget != null && demand.budget > 1000 ? 'chip-rush' : null].filter(Boolean);

  return (
    <motion.div
      whileHover={{ y: -5, scale: 1.01 }}
      transition={{ duration: 0.2 }}
      onClick={() => onSelect?.(demand.id)}
      className="group relative cursor-pointer overflow-hidden rounded-2xl border border-slate-800 bg-slate-900/60 p-5 backdrop-blur-xl transition-all duration-300 hover:border-cyan-500/50 hover:shadow-[0_0_25px_rgba(34,211,238,0.15)] flex flex-col justify-between"
    >
      <div className="absolute -top-12 -right-12 w-24 h-24 bg-cyan-500/10 rounded-full blur-2xl group-hover:bg-cyan-500/20 transition-all" />

      <div>
        <div className="flex items-center justify-between mb-3">
          <span className={`px-2.5 py-0.5 rounded-full text-[11px] font-bold border backdrop-blur-md ${statusInfo.color}`}>
            {statusInfo.label}
          </span>
          <div className="flex items-center gap-1 font-mono text-base font-black text-cyan-400">
            <Coins className="w-4 h-4 text-amber-400" />
            ￥{demand.budget}
          </div>
        </div>

        <h3 className="text-base font-bold text-slate-100 group-hover:text-cyan-300 transition-colors line-clamp-2 leading-snug">
          {demand.title}
        </h3>

        <p className="mt-2 text-xs text-slate-400 line-clamp-2 leading-relaxed">
          {demand.description || '暂无详细描述...'}
        </p>
      </div>

      <div className="mt-4 pt-3 border-t border-slate-800/80 space-y-3">
        <div className="flex items-center gap-1.5 flex-wrap">
          <span className="text-[10px] font-mono text-slate-500 uppercase">Chips:</span>
          {mockChips.map((chip, idx) => (
            <span
              key={idx}
              className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-purple-950/50 border border-purple-800/40 text-[10px] font-semibold text-purple-300"
            >
              {chip === 'chip-rush' ? <Zap className="w-3 h-3 text-amber-400" /> : <Cpu className="w-3 h-3 text-cyan-400" />}
              {chip === 'chip-rush' ? '加急' : 'AI雷达'}
            </span>
          ))}
        </div>

        <div className="flex items-center justify-between pt-1">
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded-full bg-slate-800 border border-cyan-500/40 flex items-center justify-center text-slate-300">
              <User className="w-3.5 h-3.5" />
            </div>
            <span className="text-xs text-slate-400 font-mono truncate max-w-[100px]">
              {demand.demander_id ? `Demander_${demand.demander_id.substring(0, 4)}` : '公会匿名者'}
            </span>
          </div>

          <span className="inline-flex items-center gap-0.5 text-xs font-bold text-cyan-400 group-hover:translate-x-0.5 transition-transform">
            接榜揭帖 <ArrowUpRight className="w-3.5 h-3.5" />
          </span>
        </div>
      </div>
    </motion.div>
  );
};
