'use client';

import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Package, Shield, Zap, Award, X, Check, type LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';
import { CyberEmptyState } from '@/components/ui/cyber-empty-state';

export interface InventoryItem {
  id: string;
  name: string;
  rarity: 'SSR' | 'SR' | 'R';
  type: string;
  count: number;
  icon: LucideIcon;
  description: string;
}

const DEFAULT_INVENTORY: InventoryItem[] = [
  { id: 'item-1', name: '赛博裁决姬 · 优先落锤卡', rarity: 'SSR', type: '卡券', count: 2, icon: Shield, description: '发起仲裁时，优先进行判例 RAG 检索并提高置信度权重。' },
  { id: 'item-2', name: '灵魂金库 · 算力加速券', rarity: 'SR', type: '加速', count: 5, icon: Zap, description: '缩短 Checkpoint 分段托管 24 小时超时确认倒计时。' },
  { id: 'item-3', name: '黄金公会 · 信任徽章', rarity: 'R', type: '勋章', count: 1, icon: Award, description: '发布悬赏令时自动带有专属金边高亮特效。' },
];

export const InventoryGrid: React.FC = () => {
  const [items, setItems] = useState<InventoryItem[]>(DEFAULT_INVENTORY);
  const [selectedItem, setSelectedItem] = useState<InventoryItem | null>(null);
  const [usedToast, setUsedToast] = useState<string | null>(null);

  const handleUseItem = (item: InventoryItem) => {
    setUsedToast(`已使用【${item.name}】！已消耗 1 张`);
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
          <Package className="w-5 h-5 text-purple-400" /> 盲盒成就背包 (Inventory)
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
        <CyberEmptyState
          title="成就背包空荡荡 ..."
          description="尚未获得任何盲盒道具。参与公会悬赏、完成契约或使用秘宝抽卡获取道具吧！"
          actionText="前往公会大厅"
          onAction={() => window.location.href = '/demands'}
        />
      ) : (
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3.5">
        {items.map((item) => {
          const Icon = item.icon;
          const isSSR = item.rarity === 'SSR';
          const isSR = item.rarity === 'SR';

          return (
            <motion.div
              key={item.id}
              whileHover={{ scale: 1.04, y: -2 }}
              whileTap={{ scale: 0.96 }}
              onClick={() => setSelectedItem(item)}
              className={cn(
                'relative cursor-pointer overflow-hidden rounded-2xl border p-4 backdrop-blur-md transition-all select-none',
                isSSR
                  ? 'border-amber-400/60 bg-amber-950/20 shadow-[0_0_15px_rgba(251,191,36,0.2)]'
                  : isSR
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
                    isSSR
                      ? 'bg-amber-400/20 text-amber-300 border-amber-400/40'
                      : isSR
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
