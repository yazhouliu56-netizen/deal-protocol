'use client';

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Clock, Zap, Coffee, ArrowRight, X } from 'lucide-react';
import { CyberOracleDialog } from '@/components/ui/cyber-oracle-dialog';

interface QueueAdventureModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectSideQuest: (questType: string) => void;
}

export const QueueAdventureModal: React.FC<QueueAdventureModalProps> = ({
  isOpen,
  onClose,
  onSelectSideQuest,
}) => {
  const [refused, setRefused] = useState(false);

  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [isOpen]);

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-60 flex items-center justify-center p-4 bg-black/85 backdrop-blur-xl">
          <motion.div
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.9, opacity: 0 }}
            className="relative w-full max-w-lg overflow-hidden rounded-3xl border border-amber-500/40 bg-slate-950 p-6 shadow-2xl space-y-5"
          >
            <button onClick={onClose} className="absolute top-4 right-4 text-slate-400 hover:text-white">
              <X className="w-5 h-5" />
            </button>

            <div className="flex items-center gap-3 border-b border-slate-800 pb-4">
              <div className="p-3 rounded-2xl bg-amber-950/80 border border-amber-500/40 text-amber-300">
                <Clock className="w-6 h-6 animate-spin" />
              </div>
              <div>
                <span className="text-xs font-mono font-bold text-amber-400 uppercase">QUEUE ADVENTURE</span>
                <h3 className="text-lg font-black text-white">前面还有 3 位冒险者在等候...</h3>
              </div>
            </div>

            <div className="space-y-2.5">
              <p className="text-xs text-slate-400">前方队列拥堵，精灵为您触发了 3 条降级/错峰支线奇遇：</p>

              <div
                onClick={() => onSelectSideQuest('blackhorse')}
                className="cursor-pointer p-3.5 rounded-2xl border border-purple-500/40 bg-purple-950/20 hover:bg-purple-950/40 transition flex items-center justify-between"
              >
                <div className="flex items-center gap-2.5">
                  <Zap className="w-5 h-5 text-purple-400" />
                  <div>
                    <h4 className="text-xs font-bold text-slate-100">降级召唤 3.5 星黑马职人</h4>
                    <p className="text-xs text-slate-400">等待缩短 80%，享受 9 折魔晶加成</p>
                  </div>
                </div>
                <ArrowRight className="w-4 h-4 text-purple-400" />
              </div>

              <div
                onClick={() => onSelectSideQuest('offpeak')}
                className="cursor-pointer p-3.5 rounded-2xl border border-cyan-500/40 bg-cyan-950/20 hover:bg-cyan-950/40 transition flex items-center justify-between"
              >
                <div className="flex items-center gap-2.5">
                  <Clock className="w-5 h-5 text-cyan-400" />
                  <div>
                    <h4 className="text-xs font-bold text-slate-100">错峰预约奇遇</h4>
                    <p className="text-xs text-slate-400">顺延至明日优先履约，赠 10% 算力券</p>
                  </div>
                </div>
                <ArrowRight className="w-4 h-4 text-cyan-400" />
              </div>

              <div
                onClick={() => onSelectSideQuest('boba')}
                className="cursor-pointer p-3.5 rounded-2xl border border-pink-500/40 bg-pink-950/20 hover:bg-pink-950/40 transition flex items-center justify-between"
              >
                <div className="flex items-center gap-2.5">
                  <Coffee className="w-5 h-5 text-pink-400" />
                  <div>
                    <h4 className="text-xs font-bold text-slate-100">9元赛博奶茶奇遇</h4>
                    <p className="text-xs text-slate-400">即刻退单离场，领 9 元无门槛奶茶御守</p>
                  </div>
                </div>
                <ArrowRight className="w-4 h-4 text-pink-400" />
              </div>
            </div>

            {refused ? (
              <CyberOracleDialog
                state="excited"
                speakerName="傲娇精灵"
                message="哼，算你这冒险者有眼光！本姬就陪你在这里死守到底，绝不退缩！"
              />
            ) : (
              <button
                onClick={() => setRefused(true)}
                className="w-full py-2.5 rounded-xl text-xs font-bold border border-slate-800 text-slate-400 hover:text-slate-200 transition"
              >
                拒绝支线 · 死守当前队列
              </button>
            )}
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
};
