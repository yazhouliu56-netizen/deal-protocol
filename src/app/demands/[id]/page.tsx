'use client';

import React, { useState, useEffect, use } from 'react';
import { useRouter } from 'next/navigation';
import { Tables } from '@/types/database.types';
import { ThemeSwitcher } from '@/components/theme/theme-switcher';
import { CheckpointTimer } from '@/components/escrow/checkpoint-timer';
import { AiArbitrationCard } from '@/components/ai/ai-arbitration-card';
import { GachaModal } from '@/components/gacha/gacha-modal';
import { Coins, ArrowLeft, Lock } from 'lucide-react';

interface CheckpointItem {
  id: string;
  title: string;
  amount: number;
  status: 'pending' | 'submitted' | 'completed' | 'skipped';
  autoConfirmAt: string | null;
}

export default function DemandDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();

  const [demand, setDemand] = useState<Tables<'demands'> | null>(null);
  const [loading, setLoading] = useState(true);
  const [isGachaOpen, setIsGachaOpen] = useState(false);

  const [checkpoints, setCheckpoints] = useState<CheckpointItem[]>(() => {
    const cp2AutoConfirmAt = new Date(Date.now() + 18 * 3600 * 1000).toISOString();
    return [
      { id: 'cp-1', title: '节点一：二次元原型稿落锁', amount: 300, status: 'completed' as const, autoConfirmAt: null },
      {
        id: 'cp-2',
        title: '节点二：交付 CyberOracleDialog 交互代码',
        amount: 400,
        status: 'submitted' as const,
        autoConfirmAt: cp2AutoConfirmAt,
      },
    ];
  });

  useEffect(() => {
    async function loadDemand() {
      try {
        const res = await fetch(`/api/demands/${id}`);
        if (res.ok) {
          const data = await res.json();
          setDemand(data);
        }
      } catch (err: unknown) {
        console.error('Failed to load demand detail:', err);
      } finally {
        setLoading(false);
      }
    }
    loadDemand();
  }, [id]);

  const handleConfirmCheckpoint = (cpId: string) => {
    setCheckpoints((prev) =>
      prev.map((cp) => (cp.id === cpId ? { ...cp, status: 'completed' as const } : cp))
    );
    setIsGachaOpen(true);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-950 p-8 flex items-center justify-center text-slate-400 font-mono text-xs">
        正在拉取灵魂金库存证...
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 p-4 sm:p-8 font-sans relative">
      <div className="max-w-5xl mx-auto space-y-6 relative z-10">
        <div className="flex items-center justify-between pb-4 border-b border-slate-800">
          <button
            onClick={() => router.push('/demands')}
            className="inline-flex items-center gap-1.5 text-xs font-bold text-slate-400 hover:text-white transition"
          >
            <ArrowLeft className="w-4 h-4" /> 返回悬赏大厅
          </button>
          <ThemeSwitcher />
        </div>

        <div className="rounded-3xl border border-cyan-500/30 bg-gradient-to-r from-slate-900 via-slate-950 to-slate-900 p-6 backdrop-blur-xl relative overflow-hidden">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <span className="px-2.5 py-0.5 rounded-full text-xs font-black bg-cyan-950 text-cyan-300 border border-cyan-500/40 uppercase font-mono">
                  BOUNTY CONTRACT
                </span>
                <span className="text-xs text-slate-400 font-mono">ID: {id.substring(0, 8)}</span>
              </div>
              <h1 className="text-2xl font-black text-white">{demand?.title || '二次元悬赏令详情'}</h1>
              <p className="text-xs text-slate-400 max-w-2xl leading-relaxed">
                {demand?.description || '本契约已通过 Zod API 防御网关校验，资金存入 Supabase 托管账户，支持 24h 自动解冻与判例 RAG 智能仲裁。'}
              </p>
            </div>

            <div className="p-4 rounded-2xl bg-slate-950/80 border border-slate-800 text-right shrink-0">
              <span className="text-xs text-slate-400">托管金库总额</span>
              <div className="text-2xl font-black font-mono text-cyan-400 flex items-center justify-end gap-1">
                <Coins className="w-5 h-5 text-amber-400" />
                ￥{demand?.budget || 700}
              </div>
            </div>
          </div>
        </div>

        <div className="space-y-3">
          <h3 className="text-sm font-bold text-slate-200 flex items-center gap-2">
            <Lock className="w-4 h-4 text-cyan-400" /> 关卡突破 · 资金分段解冻 (Checkpoints)
          </h3>
          <div className="space-y-3">
            {checkpoints.map((cp) => (
              <CheckpointTimer
                key={cp.id}
                checkpointId={cp.id}
                title={cp.title}
                amount={cp.amount}
                autoConfirmAt={cp.autoConfirmAt}
                status={cp.status}
                onConfirm={handleConfirmCheckpoint}
              />
            ))}
          </div>
        </div>

        <AiArbitrationCard confidenceScore={0.92} />

        <GachaModal isOpen={isGachaOpen} onClose={() => setIsGachaOpen(false)} />
      </div>
    </div>
  );
}
