'use client';

import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Package, Shield, Zap, Award, X, Check, type LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';
// Batch1：CyberEmptyState 已降解删除 → 中性虚线空态（文案原样，Batch2 收敛）
// Batch⑤-3：DEFAULT_INVENTORY 系无后端纯 mock（“装备并生效”扣减纯属表演），初始置空走既有空态；
// 后端权益到来后再接真数，组件逻辑原样保留可逆。

export interface InventoryItem {
  id: string;
  name: string;
  rarity: '金' | '银' | '铜';
  type: string;
  count: number;
  icon: LucideIcon;
  description: string;
}

// 逆转口：后端权益到来时改回 useState(DEFAULT_INVENTORY) 即复活展示。
export const DEFAULT_INVENTORY: InventoryItem[] = [
  { id: 'item-1', name: '平台认证徽章', rarity: '金', type: '认证', count: 2, icon: Shield, description: '完成实名与技能认证，派单优先展示，纠纷优先处理。' },
  { id: 'item-2', name: '准时履约勋章', rarity: '银', type: '履约', count: 5, icon: Zap, description: '完工验收后自动累积守约记录，提升信用分。' },
  { id: 'item-3', name: '资金保障卡', rarity: '铜', type: '保障', count: 1, icon: Award, description: '订单资金全程平台托管，验收后结算。' },
];

export const InventoryGrid: React.FC = () => {
  const [items, setItems] = useState<InventoryItem[]>([]);
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
    // Batch⑤-3 Duo 化：深黑卡→白底（稀有度映射：金=黄/银=中性灰/铜=橙，紫系按不引紫裁决出清）
    <div className="rounded-3xl border-2 border-[var(--color-duo-swan)] bg-white p-6 space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-base font-bold text-[var(--color-duo-eel)] flex items-center gap-2">
                    <Package className="w-5 h-5 text-[var(--color-duo-blue-ink)]" /> 我的权益
        </h3>
        <span className="text-xs text-[var(--color-duo-wolf)] font-mono">
          容量: {items.length}/16
        </span>
      </div>

      {usedToast && (
        <div className="p-2.5 rounded-xl bg-[var(--color-duo-blue)]/10 border border-[var(--color-duo-blue)]/40 text-[var(--color-duo-blue-ink)] text-xs font-semibold flex items-center gap-2">
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
                'relative cursor-pointer overflow-hidden rounded-2xl border-2 p-4 transition-all select-none',
                isGold
                  ? 'border-[var(--color-duo-yellow-dark)]/60 bg-[var(--color-duo-yellow)]/10'
                  : isSilver
                  ? 'border-[var(--color-duo-swan)] bg-[var(--color-duo-polar)]'
                  : 'border-[var(--color-duo-orange)]/40 bg-[var(--color-duo-orange)]/10'
              )}
            >
              <span className="absolute top-2 right-2 text-xs font-mono font-black text-[var(--color-duo-eel)] bg-white px-1.5 py-0.5 rounded-md border border-[var(--color-duo-swan)]">
                x{item.count}
              </span>

              <div className="flex flex-col items-center text-center space-y-2 my-1">
                <div
                  className={cn(
                    'w-10 h-10 rounded-xl flex items-center justify-center border-2',
                    isGold
                      ? 'bg-[var(--color-duo-yellow)]/20 text-[var(--color-duo-yellow-ink)] border-[var(--color-duo-yellow-dark)]/40'
                      : isSilver
                      ? 'bg-white text-[var(--color-duo-wolf)] border-[var(--color-duo-swan)]'
                      : 'bg-[var(--color-duo-orange)]/10 text-[var(--color-duo-orange-ink)] border-[var(--color-duo-orange)]/40'
                  )}
                >
                  <Icon className="w-5 h-5" />
                </div>
                <h4 className="text-xs font-bold text-[var(--color-duo-eel)] line-clamp-1">{item.name}</h4>
              </div>
            </motion.div>
          );
        })}
      </div>
      )}

      <AnimatePresence>
        {selectedItem && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-md">
            <motion.div
              initial={{ scale: 0.8, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.8, opacity: 0 }}
              className="relative w-full max-w-sm rounded-3xl border-2 border-[var(--color-duo-swan)] bg-white p-6 text-center shadow-2xl space-y-4"
            >
              <button
                onClick={() => setSelectedItem(null)}
                className="absolute top-4 right-4 p-1 rounded-full text-[var(--color-duo-hare)] hover:text-[var(--color-duo-eel)]"
              >
                <X className="w-5 h-5" />
              </button>

              <div className="w-16 h-16 mx-auto rounded-2xl bg-[var(--color-duo-blue)]/10 border-2 border-[var(--color-duo-blue)]/40 flex items-center justify-center text-[var(--color-duo-blue-ink)]">
                <selectedItem.icon className="w-8 h-8" />
              </div>

              <div>
                <span className="text-xs font-mono font-bold text-[var(--color-duo-blue-ink)] bg-[var(--color-duo-blue)]/10 px-2 py-0.5 rounded-full border border-[var(--color-duo-blue)]/40">
                  {selectedItem.rarity} · {selectedItem.type}
                </span>
                <h4 className="text-base font-bold text-[var(--color-duo-eel)] mt-2">{selectedItem.name}</h4>
                <p className="text-xs text-[var(--color-duo-wolf)] mt-1 leading-relaxed">{selectedItem.description}</p>
              </div>

              <div className="pt-2 flex gap-2">
                <button
                  onClick={() => setSelectedItem(null)}
                  className="flex-1 py-2.5 rounded-xl text-xs font-bold border-2 border-[var(--color-duo-swan)] bg-white text-[var(--color-duo-wolf)] hover:text-[var(--color-duo-eel)]"
                >
                  暂不使用
                </button>
                <motion.button
                  whileHover={{ scale: 1.03 }}
                  whileTap={{ scale: 0.97 }}
                  onClick={() => handleUseItem(selectedItem)}
                  className="flex-1 py-2.5 rounded-xl text-xs font-extrabold bg-[var(--color-duo-green)] border-b-2 border-[var(--color-duo-green-dark)] text-neutral-900"
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
