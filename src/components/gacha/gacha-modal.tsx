'use client';

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Gift, Sparkles, Award, X, Zap, Shield, type LucideIcon } from 'lucide-react';

export interface GachaReward {
  id: string;
  rarity: 'SSR' | 'SR' | 'R';
  title: string;
  description: string;
  icon: LucideIcon;
}

const SAMPLE_REWARDS: GachaReward[] = [
  { id: 'r1', rarity: 'SSR', title: '赛博裁决姬 · 优先落锤权', description: '发起仲裁时，AI 判例 RAG 响应优先级提升 300%', icon: Shield },
  { id: 'r2', rarity: 'SR', title: '灵魂金库 · 算力加速卡', description: '托管资金解冻 Checkpoint 响应时间缩短至 12 小时', icon: Zap },
  { id: 'r3', rarity: 'R', title: '公会声望 · 黄金徽章', description: '悬赏发布卡片获得专属金边发光挂件', icon: Award },
];

interface GachaModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const GachaModal: React.FC<GachaModalProps> = ({ isOpen, onClose }) => {
  const [stage, setStage] = useState<'idle' | 'opening' | 'revealed'>('idle');
  const [reward, setReward] = useState<GachaReward | null>(null);

  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
      const reset = async () => {
        await Promise.resolve();
        setStage('idle');
        setReward(null);
      };
      reset();
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [isOpen]);

  const handleStartUnbox = () => {
    setStage('opening');
    setTimeout(() => {
      const randomReward = SAMPLE_REWARDS[Math.floor(Math.random() * SAMPLE_REWARDS.length)];
      setReward(randomReward);
      setStage('revealed');
    }, 1500);
  };

  const handleReset = () => {
    setStage('idle');
    setReward(null);
    onClose();
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-70 flex items-center justify-center p-4 bg-black/85 backdrop-blur-xl">
          <motion.div
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.8, opacity: 0 }}
            className="relative w-full max-w-md overflow-hidden rounded-3xl border border-cyan-500/40 bg-slate-950 p-6 text-center shadow-[0_0_60px_rgba(34,211,238,0.25)]"
          >
            <button
              onClick={handleReset}
              className="absolute top-4 right-4 p-1.5 rounded-full text-slate-400 hover:text-white hover:bg-slate-800 transition z-20"
            >
              <X className="w-5 h-5" />
            </button>

            {stage === 'idle' && (
              <div className="py-6 space-y-5">
                <motion.div
                  animate={{ y: [0, -10, 0], rotate: [0, 2, -2, 0] }}
                  transition={{ repeat: Infinity, duration: 2.5, ease: 'easeInOut' }}
                  className="mx-auto w-24 h-24 rounded-3xl bg-gradient-to-tr from-cyan-500 via-purple-600 to-pink-500 p-0.5 shadow-xl shadow-cyan-500/30 flex items-center justify-center cursor-pointer"
                  onClick={handleStartUnbox}
                >
                  <div className="w-full h-full bg-slate-950 rounded-[22px] flex items-center justify-center">
                    <Gift className="w-12 h-12 text-cyan-300 animate-pulse" />
                  </div>
                </motion.div>

                <div>
                  <h3 className="text-xl font-black text-white">开启公会秘宝宝箱</h3>
                  <p className="text-xs text-slate-400 mt-1">概率抽取 SSR 级赛博裁决姬落锤卡与灵魂金库算力券</p>
                </div>

                <motion.button
                  whileHover={{ scale: 1.03 }}
                  whileTap={{ scale: 0.97 }}
                  onClick={handleStartUnbox}
                  className="w-full py-3.5 rounded-xl font-extrabold text-sm bg-gradient-to-r from-cyan-500 via-blue-600 to-purple-600 text-white shadow-lg shadow-cyan-500/30 hover:brightness-110 transition-all"
                >
                  消耗 100 声望 · 启动抽取
                </motion.button>
              </div>
            )}

            {stage === 'opening' && (
              <div className="py-12 space-y-6">
                <motion.div
                  animate={{ rotate: 360, scale: [1, 1.3, 1] }}
                  transition={{ repeat: Infinity, duration: 1, ease: 'linear' }}
                  className="mx-auto w-20 h-20 rounded-full border-4 border-t-cyan-400 border-r-purple-500 border-b-pink-500 border-l-transparent flex items-center justify-center"
                >
                  <Sparkles className="w-8 h-8 text-cyan-300 animate-spin" />
                </motion.div>

                <p className="text-sm font-mono text-cyan-400 animate-pulse">
                  正在演算公会随机数存证种子...
                </p>
              </div>
            )}

            {stage === 'revealed' && reward && (
              <motion.div
                initial={{ scale: 0.5, opacity: 0, rotateY: 180 }}
                animate={{ scale: 1, opacity: 1, rotateY: 0 }}
                transition={{ type: 'spring', damping: 15 }}
                className="py-4 space-y-4"
              >
                <div className="relative inline-block">
                  <span className={`px-3 py-1 rounded-full text-xs font-black border ${
                    reward.rarity === 'SSR'
                      ? 'bg-amber-950/80 text-amber-300 border-amber-400 shadow-[0_0_15px_rgba(251,191,36,0.5)]'
                      : 'bg-purple-950/80 text-purple-300 border-purple-400'
                  }`}>
                    {reward.rarity} ITEM UNLOCKED
                  </span>
                </div>

                <div className="mx-auto w-20 h-20 rounded-2xl bg-gradient-to-tr from-cyan-500 to-purple-600 p-0.5 flex items-center justify-center shadow-lg shadow-purple-500/30">
                  <div className="w-full h-full bg-slate-950 rounded-[14px] flex items-center justify-center text-cyan-300">
                    <reward.icon className="w-10 h-10" />
                  </div>
                </div>

                <div>
                  <h4 className="text-lg font-black text-white">{reward.title}</h4>
                  <p className="text-xs text-slate-400 mt-1 px-4">{reward.description}</p>
                </div>

                <motion.button
                  whileHover={{ scale: 1.03 }}
                  whileTap={{ scale: 0.97 }}
                  onClick={handleReset}
                  className="mt-4 w-full py-3 rounded-xl font-bold text-sm bg-gradient-to-r from-cyan-500 to-blue-600 text-white shadow-lg shadow-cyan-500/25"
                >
                  存入灵魂仓库
                </motion.button>
              </motion.div>
            )}
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
};
