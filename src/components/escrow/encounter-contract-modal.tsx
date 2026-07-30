'use client';

import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Scroll, Sparkles, ShieldCheck, Coins, Lock, X } from 'lucide-react';

interface EncounterContractModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirmPayment: () => void;
  title?: string;
  amount?: number;
}

export const EncounterContractModal: React.FC<EncounterContractModalProps> = ({
  isOpen,
  onClose,
  onConfirmPayment,
  title = '【异世界奇遇】赛博御守缔结契约',
  amount = 500,
}) => {
  const [isCasting, setIsCasting] = useState(false);

  const handleCastMagic = () => {
    setIsCasting(true);
    setTimeout(() => {
      setIsCasting(false);
      onClose();
      onConfirmPayment();
    }, 1200);
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-xl">
          <motion.div
            initial={{ scale: 0.85, opacity: 0, rotateX: 15 }}
            animate={{ scale: 1, opacity: 1, rotateX: 0 }}
            exit={{ scale: 0.85, opacity: 0 }}
            className="relative w-full max-w-md overflow-hidden rounded-3xl border-2 border-amber-500/50 bg-gradient-to-b from-amber-950/30 via-slate-950 to-slate-950 p-6 text-slate-100 shadow-[0_0_50px_rgba(245,158,11,0.25)] space-y-5"
          >
            <button onClick={onClose} className="absolute top-4 right-4 text-slate-400 hover:text-white">
              <X className="w-5 h-5" />
            </button>

            <div className="text-center space-y-1">
              <span className="inline-flex items-center gap-1 px-3 py-0.5 rounded-full text-[10px] font-black bg-amber-400 text-slate-950 uppercase font-mono">
                <Scroll className="w-3 h-3" /> PARCHMENT CONTRACT
              </span>
              <h3 className="text-xl font-black text-amber-200 mt-1">{title}</h3>
            </div>

            <div className="p-4 rounded-2xl bg-amber-950/20 border border-amber-500/30 space-y-3 font-mono text-xs">
              <div className="flex justify-between border-b border-amber-500/20 pb-2">
                <span className="text-slate-400">消耗魔晶 (Soul Crystal):</span>
                <span className="font-bold text-amber-300 font-mono text-base">￥{amount}</span>
              </div>
              <div className="flex justify-between border-b border-amber-500/20 pb-2">
                <span className="text-slate-400">时空锚点 (Checkpoints):</span>
                <span className="text-cyan-300">24h 自动分段解冻</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">防踩雷保底条款:</span>
                <span className="text-emerald-400 font-bold">1.2倍违约魔法赔付</span>
              </div>
            </div>

            <motion.button
              whileHover={{ scale: 1.03 }}
              whileTap={{ scale: 0.97 }}
              onClick={handleCastMagic}
              disabled={isCasting}
              className="w-full py-3.5 rounded-2xl font-black text-sm bg-gradient-to-r from-amber-500 via-yellow-500 to-amber-600 text-slate-950 shadow-xl shadow-amber-500/30 flex items-center justify-center gap-2"
            >
              <Sparkles className={`w-4 h-4 ${isCasting ? 'animate-spin' : ''}`} />
              {isCasting ? '注入魔晶，魔法阵启动中...' : '注入魔晶 · 缔结契约'}
            </motion.button>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
};
