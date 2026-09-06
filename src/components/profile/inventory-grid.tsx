'use client';

import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Package, Shield, Zap, Award, X, Check, type LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';
// Batch1：CyberEmptyState 已降解删除 → 中性虚线空态（文案原样，Batch2 收敛）

export interface InventoryItem {
  id: string;
  name: string;
  rarity: '金' | '银' | '铜';
  type: string;
  count: number;
  icon: LucideIcon;
  description: string;
}

const DEFAULT_INVENTORY: InventoryItem[] = [
  { id: 'item-1', name: '平台认证徽章', rarity: '金', type: '认证', count: 2, icon: Shield, description: '完成实名与技能认证，派单优先展示，纠纷优先处理。' },
  { id: 'item-2', name: '准时履约勋章', rarity: '银', type: '履约', count: 5, icon: Zap, description: '完工验收后自动累积守约记录，提升信用分。' },
  { id: 'item-3', name: '资金保障卡', rarity: '铜', type: '保障', count: 1, icon: Award, description: '订单资金全程平台托管，验收后结算。' },
];

export const InventoryGrid: React.FC = () => {
  const [items, setItems] = useState<InventoryItem[]>(DEFAULT_INVENTORY);
  const [selectedItem, setSelectedItem] = useState<InventoryItem | null>(null);
  const [usedToast, setUsedToast] = useState<string | null>(null);

  const handleUseItem = (item: InventoryItem) => {
    setUsedToast(`已使用${item.name}，剩余 ${item.count - 1} 次`);
    setItems((prev) =>
      prev
        .map((i) => (i.id === item.id ? { ...i, count: i.count - 1 } : i))
        .filter((i) => i.count > 0)
    );
    setSelectedItem(null);
    setTimeout(() => setUsedToast(null), 2500);
  };

  return (
    <div className="rounded-3xl border border-slate-800 bg-slate-900/60 p-6 backdrop-blur-xl space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-base font-bold text-slate-100 flex items-center gap-2">
                    <Package className="w-5 h-5 text-purple-400" /> 我的权益
        </h3>
        <span className="text-xs text-slate-400 font-mono">
          容量: {items.length}/16
        </span>
      </div>

      {usedToast && (
        <div className="p-2.5 rounded-xl bg-cyan-950/80 border border-cyan-500/50 text-cyan-300 text-xs font-semibold flex items-center gap-2">
          <Check className="w-4 h-4" /> {usedToast}
        </div>
      )}

      {items.length === 0 ? (
        <div className="flex flex-col items-center justify-center p-8 text-center rounded-xl border border-dashed border-input bg-card text-card-foreground">
          <div className="w-12 h-12 rounded-xl bg-muted flex items-center justify-center text-muted-foreground mb-3">
            <Package className="w-6 h-6" />
          </div>
          <h3 className="text-sm font-bold">暂无权益记录</h3>
          <p className="text-xs text-muted-foreground max-w-sm mt-1 leading-relaxed">完成首单履约后自动累积，可在个人中心查看。</p>
          <button
            onClick={() => window.location.href = '/'}
            className="mt-4 px-5 py-2 rounded-lg text-xs font-bold bg-primary text-primary-foreground"
          >
            去看看工单
          </button>
        </div>
      ) : (
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3.5">
        {items.map((item) => {
          const Icon = item.icon;
          const isGold = item.rarity === '金';
          const isSilver = item.rarity === '银';

          return (
            <motion.div
              key={item.id}
              whileHover={{ scale: 1.04, y: -2 }}
              whileTap={{ scale: 0.96 }}
              onClick={() => setSelectedItem(item)}
              className={cn(
                'relative cursor-pointer overflow-hidden rounded-2xl border p-4 backdrop-blur-md transition-all select-none',
                isGold
                  ? 'border-amber-400/60 bg-amber-950/20 shadow-[0_0_15px_rgba(251,191,36,0.2)]'
                  : isSilver
                  ? 'border-purple-400/50 bg-purple-950/20'
                  : 'border-slate-800 bg-slate-950/60'
              )}
            >
              <span className="absolute top-2 right-2 text-xs font-mono font-black text-slate-300 bg-slate-900/80 px-1.5 py-0.5 rounded-md border border-slate-800">
                x{item.count}
              </span>

              <div className="flex flex-col items-center text-center space-y-2 my-1">
                <div
                  className={cn(
                    'w-10 h-10 rounded-xl flex items-center justify-center border',
                    isGold
                      ? 'bg-amber-400/20 text-amber-300 border-amber-400/40'
                      : isSilver
                      ? 'bg-purple-400/20 text-purple-300 border-purple-400/40'
                      : 'bg-slate-800 text-cyan-400 border-slate-700'
                  )}
                >
                  <Icon className="w-5 h-5" />
                </div>
                <h4 className="text-xs font-bold text-slate-200 line-clamp-1">{item.name}</h4>
              </div>
            </motion.div>
          );
        })}
      </div>
      )}

      <AnimatePresence>
        {selectedItem && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md">
            <motion.div
              initial={{ scale: 0.8, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.8, opacity: 0 }}
              className="relative w-full max-w-sm rounded-3xl border border-slate-700 bg-slate-950 p-6 text-center shadow-2xl space-y-4"
            >
              <button
                onClick={() => setSelectedItem(null)}
                className="absolute top-4 right-4 p-1 rounded-full text-slate-400 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>

              <div className="w-16 h-16 mx-auto rounded-2xl bg-cyan-950 border border-cyan-500/40 flex items-center justify-center text-cyan-300">
                <selectedItem.icon className="w-8 h-8" />
              </div>

              <div>
                <span className="text-xs font-mono font-bold text-purple-400 bg-purple-950/80 px-2 py-0.5 rounded-full border border-purple-800/40">
                  {selectedItem.rarity} · {selectedItem.type}
                </span>
                <h4 className="text-base font-bold text-white mt-2">{selectedItem.name}</h4>
                <p className="text-xs text-slate-400 mt-1 leading-relaxed">{selectedItem.description}</p>
              </div>

              <div className="pt-2 flex gap-2">
                <button
                  onClick={() => setSelectedItem(null)}
                  className="flex-1 py-2.5 rounded-xl text-xs font-bold border border-slate-800 text-slate-300 hover:bg-slate-900"
                >
                  暂不使用
                </button>
                <motion.button
                  whileHover={{ scale: 1.03 }}
                  whileTap={{ scale: 0.97 }}
                  onClick={() => handleUseItem(selectedItem)}
                  className="flex-1 py-2.5 rounded-xl text-xs font-extrabold bg-gradient-to-r from-cyan-500 to-blue-600 text-white shadow-lg shadow-cyan-500/20"
                >
                  装备并生效
                </motion.button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};
