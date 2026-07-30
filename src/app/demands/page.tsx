'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import { Tables } from '@/types/database.types';
import { ThemeSwitcher } from '@/components/theme/theme-switcher';
import { DemandCard } from '@/components/demands/demand-card';
import { GachaModal } from '@/components/gacha/gacha-modal';
import { CyberEmptyState } from '@/components/ui/cyber-empty-state';
import { DemandCardSkeleton } from '@/components/ui/cyber-skeleton';
import { Search, Filter, Plus, Gift, Sparkles, Scroll } from 'lucide-react';

interface DemandCardItem extends Tables<'demands'> {
  category?: string;
}

export default function GuildQuestBoardPage() {
  const router = useRouter();
  const [demands, setDemands] = useState<DemandCardItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [isGachaOpen, setIsGachaOpen] = useState(false);

  useEffect(() => {
    async function fetchDemands() {
      try {
        const res = await fetch('/api/demands');
        if (res.ok) {
          const data = await res.json();
          setDemands(Array.isArray(data) ? data : data.demands || []);
        }
      } catch (e) {
        console.error('Failed to fetch demands:', e);
      } finally {
        setLoading(false);
      }
    }
    fetchDemands();
  }, []);

  const filteredDemands = demands.filter((item) => {
    const matchesSearch = item.title.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesCategory = selectedCategory === 'all' || item.category === selectedCategory;
    return matchesSearch && matchesCategory;
  });

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 p-4 sm:p-8 font-sans relative">
      <div className="absolute top-0 right-1/4 w-96 h-96 bg-cyan-500/10 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-10 left-10 w-96 h-96 bg-purple-500/10 rounded-full blur-3xl pointer-events-none" />

      <div className="max-w-7xl mx-auto space-y-6 relative z-10">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pb-4 border-b border-slate-800">
          <div>
            <div className="flex items-center gap-2 text-cyan-400 text-xs font-mono font-bold tracking-widest uppercase">
              <Scroll className="w-4 h-4" /> Cyber-Guild Bounty Hall
            </div>
            <h1 className="text-2xl sm:text-3xl font-black text-white mt-1">
              赛博公会悬赏大厅
            </h1>
          </div>

          <div className="flex items-center gap-3">
            <ThemeSwitcher />
            <motion.button
              whileHover={{ scale: 1.03 }}
              whileTap={{ scale: 0.97 }}
              onClick={() => router.push('/demands/create')}
              className="px-4 py-2 rounded-xl text-xs font-extrabold bg-gradient-to-r from-cyan-500 to-blue-600 text-white shadow-lg shadow-cyan-500/20 flex items-center gap-1.5"
            >
              <Plus className="w-4 h-4" /> 发布悬赏令
            </motion.button>
          </div>
        </div>

        <div className="relative overflow-hidden rounded-3xl border border-amber-500/40 bg-gradient-to-r from-slate-900 via-amber-950/30 to-purple-950/40 p-6 flex flex-col md:flex-row items-center justify-between gap-4 shadow-[0_0_30px_rgba(251,191,36,0.15)]">
          <div className="space-y-1.5 text-center md:text-left">
            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-extrabold bg-amber-400 text-slate-950">
              <Sparkles className="w-3 h-3" /> GACHA EVENT
            </span>
            <h2 className="text-lg sm:text-xl font-black text-amber-200">
              公会秘宝抽取 · 灵魂算力与优先落锤卡掉落
            </h2>
            <p className="text-xs text-slate-400 max-w-xl">
              每日登录可免费抽取一次，获取 AI 判例优先处理与 Checkpoint 托管解冻加速算力！
            </p>
          </div>

          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={() => setIsGachaOpen(true)}
            className="shrink-0 px-6 py-3 rounded-2xl font-black text-xs bg-gradient-to-r from-amber-400 via-yellow-500 to-amber-600 text-slate-950 shadow-xl shadow-amber-500/30 flex items-center gap-2"
          >
            <Gift className="w-4 h-4" /> 开启秘宝盲盒
          </motion.button>
        </div>

        <div className="flex flex-col md:flex-row items-center justify-between gap-4 p-4 rounded-2xl bg-slate-900/60 border border-slate-800 backdrop-blur-xl">
          <div className="relative w-full md:w-80">
            <Search className="absolute left-3.5 top-2.5 w-4 h-4 text-slate-400" />
            <input
              type="text"
              placeholder="搜索公会悬赏关键字..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2 rounded-xl bg-slate-950 border border-slate-800 text-xs text-slate-100 placeholder-slate-500 focus:outline-none focus:border-cyan-400 transition"
            />
          </div>

          <div className="flex items-center gap-2 overflow-x-auto w-full md:w-auto pb-1 md:pb-0">
            {[
              { id: 'all', name: '全量悬赏' },
              { id: 'tech', name: '软件开发' },
              { id: 'design', name: '二次元美术' },
              { id: 'content', name: '文案世界观' },
              { id: 'audit', name: '判例复核' },
            ].map((cat) => (
              <button
                key={cat.id}
                onClick={() => setSelectedCategory(cat.id)}
                className={`px-3 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition-all ${
                  selectedCategory === cat.id
                    ? 'bg-cyan-500 text-slate-950 font-bold shadow-md shadow-cyan-500/30'
                    : 'bg-slate-950 text-slate-400 hover:text-slate-200 border border-slate-800'
                }`}
              >
                {cat.name}
              </button>
            ))}
          </div>
        </div>

        {loading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {[1, 2, 3, 4, 5, 6].map((i) => (
              <DemandCardSkeleton key={i} />
            ))}
          </div>
        ) : filteredDemands.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {filteredDemands.map((item) => (
              <DemandCard
                key={item.id}
                demand={item}
                onSelect={(id) => router.push(`/demands/${id}`)}
              />
            ))}
          </div>
        ) : (
          <CyberEmptyState
            title={searchQuery ? '未检索到匹配的公会悬赏令' : '公会告示板暂无悬赏令'}
            description={searchQuery ? '尝试调整搜索关键字或重置筛选条件' : '当前分类下尚未发现契约，快去发布新的公会悬赏吧！'}
            actionText="重置筛选条件"
            onAction={() => { setSearchQuery(''); setSelectedCategory('all'); }}
            secondaryText="前往公会大厅"
            onSecondary={() => router.push('/demands/create')}
          />
        )}
      </div>

      <GachaModal isOpen={isGachaOpen} onClose={() => setIsGachaOpen(false)} />
    </div>
  );
}
