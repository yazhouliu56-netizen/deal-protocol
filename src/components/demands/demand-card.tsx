'use client';

import React from 'react';
import { motion } from 'framer-motion';
import { Tables } from '@/types/database.types';
import { Zap, Cpu, Coins, ArrowUpRight, User } from 'lucide-react';

export interface DemandCardProps {
  demand: Tables<'demands'>;
  onSelect?: (id: string) => void;
}

/**
 * demands 表状态词表（大写，后端权威：OPEN/MATCHED/ACCEPTED/ASSIGNED/
 * DEPARTED/ARRIVED/STARTED/COMPLETED/CANCELLED）。未知态回退招募中。
 */
const statusMap: Record<string, { label: string; color: string }> = {
  OPEN: { label: '招募中', color: 'bg-cyan-950/80 text-cyan-300 border-cyan-500/50' },
  MATCHED: { label: '已匹配', color: 'bg-sky-950/80 text-sky-300 border-sky-500/50' },
  ACCEPTED: { label: '已接单', color: 'bg-blue-950/80 text-blue-300 border-blue-500/50' },
  ASSIGNED: { label: '待出发', color: 'bg-indigo-950/80 text-indigo-300 border-indigo-500/50' },
  DEPARTED: { label: '前往中', color: 'bg-violet-950/80 text-violet-300 border-violet-500/50' },
  ARRIVED: { label: '已到达', color: 'bg-fuchsia-950/80 text-fuchsia-300 border-fuchsia-500/50' },
  STARTED: { label: '服务中', color: 'bg-amber-950/80 text-amber-300 border-amber-500/50' },
  COMPLETED: { label: '已完成', color: 'bg-purple-950/80 text-purple-300 border-purple-500/50' },
  CANCELLED: { label: '已取消', color: 'bg-zinc-900/80 text-zinc-400 border-zinc-700/50' },
  IN_PROGRESS: { label: '履约突破中', color: 'bg-amber-950/80 text-amber-300 border-amber-500/50' },
  SETTLED: { label: '已解冻归档', color: 'bg-emerald-950/80 text-emerald-300 border-emerald-500/50' },
};

export const DemandCard: React.FC<DemandCardProps> = ({ demand, onSelect }) => {
  const normalizedStatus = (demand.status || 'OPEN').toUpperCase();
  const statusInfo = statusMap[normalizedStatus] || statusMap.OPEN;

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
          <span className={`px-2.5 py-0.5 rounded-full text-xs font-bold border backdrop-blur-md ${statusInfo.color}`}>
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
          <span className="text-xs font-mono text-slate-500 uppercase">Chips:</span>
          {mockChips.map((chip, idx) => (
            <span
              key={idx}
              className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-purple-950/50 border border-purple-800/40 text-xs font-semibold text-purple-300"
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
