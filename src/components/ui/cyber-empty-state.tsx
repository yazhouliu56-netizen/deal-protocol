'use client';

import React from 'react';
import { motion } from 'framer-motion';
import { Scroll, RefreshCw, Home } from 'lucide-react';
import { cn } from '@/lib/utils';

interface CyberEmptyStateProps {
  title?: string;
  description?: string;
  actionText?: string;
  onAction?: () => void;
  secondaryText?: string;
  onSecondary?: () => void;
  className?: string;
}

export const CyberEmptyState: React.FC<CyberEmptyStateProps> = ({
  title = '公会告示板暂无悬赏令',
  description = '当前分类或检索关键词下尚未发现契约，快去发布新的公会悬赏吧！',
  actionText,
  onAction,
  secondaryText,
  onSecondary,
  className,
}) => {
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      className={cn(
        'flex flex-col items-center justify-center p-8 sm:p-12 text-center rounded-3xl border border-dashed border-slate-800 bg-slate-900/40 backdrop-blur-xl relative overflow-hidden',
        className
      )}
    >
      <div className="w-16 h-16 rounded-2xl bg-cyan-950/60 border border-cyan-500/30 flex items-center justify-center text-cyan-400 mb-4 shadow-[0_0_20px_rgba(34,211,238,0.15)]">
        <Scroll className="w-8 h-8 opacity-80" />
      </div>

      <h3 className="text-base font-bold text-slate-200">{title}</h3>
      <p className="text-xs text-slate-400 max-w-sm mt-1.5 leading-relaxed">{description}</p>

      <div className="flex items-center gap-3 mt-5">
        {actionText && onAction && (
          <motion.button
            whileHover={{ scale: 1.03 }}
            whileTap={{ scale: 0.97 }}
            onClick={onAction}
            className="px-5 py-2 rounded-xl text-xs font-bold bg-gradient-to-r from-cyan-500 to-blue-600 text-white shadow-lg shadow-cyan-500/20 flex items-center gap-1.5"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            {actionText}
          </motion.button>
        )}
        {secondaryText && onSecondary && (
          <motion.button
            whileHover={{ scale: 1.03 }}
            whileTap={{ scale: 0.97 }}
            onClick={onSecondary}
            className="px-5 py-2 rounded-xl text-xs font-bold border border-slate-700 text-slate-300 hover:bg-slate-800/50 flex items-center gap-1.5"
          >
            <Home className="w-3.5 h-3.5" />
            {secondaryText}
          </motion.button>
        )}
      </div>
    </motion.div>
  );
};
