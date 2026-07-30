'use client';

import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Sparkles, Scale, AlertCircle, Cpu } from 'lucide-react';
import { cn } from '@/lib/utils';

export type OracleState = 'thinking' | 'excited' | 'judge' | 'fallback';

interface CyberOracleDialogProps {
  state: OracleState;
  speakerName?: string;
  message: string;
  confidenceScore?: number;
  onActionClick?: () => void;
  actionText?: string;
  className?: string;
}

const stateConfig: Record<OracleState, {
  borderColor: string;
  glowColor: string;
  badgeBg: string;
  icon: React.ElementType;
  title: string;
}> = {
  thinking: {
    borderColor: 'border-purple-500/50',
    glowColor: 'shadow-[0_0_20px_rgba(168,85,247,0.25)]',
    badgeBg: 'bg-purple-950/80 text-purple-300 border-purple-500/40',
    icon: Cpu,
    title: '赛博裁决姬 · 演算中',
  },
  excited: {
    borderColor: 'border-amber-400/60',
    glowColor: 'shadow-[0_0_25px_rgba(251,191,36,0.3)]',
    badgeBg: 'bg-amber-950/80 text-amber-300 border-amber-400/50',
    icon: Sparkles,
    title: '赛博裁决姬 · 契约助手',
  },
  judge: {
    borderColor: 'border-rose-500/60',
    glowColor: 'shadow-[0_0_25px_rgba(244,63,94,0.3)]',
    badgeBg: 'bg-rose-950/80 text-rose-300 border-rose-500/50',
    icon: Scale,
    title: '赛博裁决姬 · 判定中',
  },
  fallback: {
    borderColor: 'border-slate-500/40',
    glowColor: 'shadow-[0_0_15px_rgba(100,116,139,0.2)]',
    badgeBg: 'bg-slate-900/80 text-slate-400 border-slate-600/40',
    icon: AlertCircle,
    title: '赛博裁决姬 · 离线模式',
  },
};

export const CyberOracleDialog: React.FC<CyberOracleDialogProps> = ({
  state = 'thinking',
  speakerName = 'Oracle-01姬',
  message,
  confidenceScore,
  onActionClick,
  actionText,
  className,
}) => {
  const config = stateConfig[state];
  const IconComponent = config.icon;
  const [displayedText, setDisplayedText] = useState('');
  const [typingError, setTypingError] = useState(false);

  useEffect(() => {
    try {
      let index = 0;
      setDisplayedText('');
      setTypingError(false);
      const safeMessage = typeof message === 'string' ? message : '';
      if (!safeMessage) {
        setTypingError(true);
        setDisplayedText('[裁决姬处于休眠保护模式 — 暂无消息可展示]');
        return;
      }
      const timer = setInterval(() => {
        if (index < safeMessage.length) {
          setDisplayedText((prev) => prev + safeMessage.charAt(index));
          index++;
        } else {
          clearInterval(timer);
        }
      }, 20);
      return () => clearInterval(timer);
    } catch {
      setTypingError(true);
      setDisplayedText('[裁决姬处于休眠保护模式 — 渲染异常，已自动降级]');
    }
  }, [message]);

  return (
    <motion.div
      initial={{ opacity: 0, y: 10, scale: 0.99 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      className={cn(
        'relative overflow-hidden rounded-2xl border p-4.5 backdrop-blur-xl bg-slate-950/80 text-slate-100 transition-all duration-300',
        config.borderColor,
        config.glowColor,
        className
      )}
    >
      <div className="flex items-center justify-between mb-2">
        <span className={cn('inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold border backdrop-blur-md', config.badgeBg)}>
          <IconComponent className="w-3.5 h-3.5 animate-pulse" />
          {speakerName} | {config.title}
        </span>
        {confidenceScore !== undefined && (
          <div className="text-xs font-mono text-cyan-400 bg-cyan-950/50 px-2.5 py-0.5 rounded-md border border-cyan-800/40">
            置信度: <span className="font-bold">{Math.round(confidenceScore * 100)}%</span>
          </div>
        )}
      </div>

      <div className="relative min-h-[48px] text-xs sm:text-sm leading-relaxed tracking-wide text-slate-200 font-sans my-1">
        {displayedText}
        {displayedText.length < message.length && (
          <span className="inline-block w-1.5 h-3.5 ml-1 bg-cyan-400 animate-pulse align-middle" />
        )}
      </div>

      {actionText && onActionClick && (
        <div className="flex justify-end mt-2 pt-2 border-t border-slate-800/60">
          <button
            onClick={onActionClick}
            className="px-3 py-1 rounded-lg text-xs font-semibold bg-gradient-to-r from-cyan-500 to-blue-600 text-white shadow-md hover:brightness-110 transition-all"
          >
            {actionText}
          </button>
        </div>
      )}
    </motion.div>
  );
};
