'use client';

import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Clock, Unlock, CheckCircle2 } from 'lucide-react';
import { cn } from '@/lib/utils';

interface CheckpointTimerProps {
  checkpointId: string;
  title: string;
  amount: number;
  autoConfirmAt: string | null;
  status: 'pending' | 'submitted' | 'completed' | 'skipped';
  onConfirm: (checkpointId: string) => void;
  className?: string;
}

export const CheckpointTimer: React.FC<CheckpointTimerProps> = ({
  checkpointId,
  title,
  amount,
  autoConfirmAt,
  status,
  onConfirm,
  className,
}) => {
  const [timeLeft, setTimeLeft] = useState<{ hours: number; minutes: number; seconds: number }>({
    hours: 24,
    minutes: 0,
    seconds: 0,
  });
  const [progressPercent, setProgressPercent] = useState<number>(100);

  useEffect(() => {
    if (!autoConfirmAt || status !== 'submitted') return;

    const targetTime = new Date(autoConfirmAt).getTime();

    const interval = setInterval(() => {
      const now = new Date().getTime();
      const difference = targetTime - now;

      if (difference <= 0) {
        clearInterval(interval);
        setTimeLeft({ hours: 0, minutes: 0, seconds: 0 });
        setProgressPercent(0);
      } else {
        const hours = Math.floor(difference / (1000 * 60 * 60));
        const minutes = Math.floor((difference % (1000 * 60 * 60)) / (1000 * 60));
        const seconds = Math.floor((difference % (1000 * 60)) / 1000);

        setTimeLeft({ hours, minutes, seconds });
        const total24h = 24 * 60 * 60 * 1000;
        setProgressPercent(Math.max(0, Math.min(100, (difference / total24h) * 100)));
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [autoConfirmAt, status]);

  const isCompleted = status === 'completed';

  return (
    <div
      className={cn(
        'relative overflow-hidden rounded-2xl border p-4.5 backdrop-blur-xl transition-all duration-300',
        isCompleted
          ? 'border-emerald-500/40 bg-emerald-950/20'
          : 'border-slate-800 bg-slate-900/60 hover:border-cyan-500/40',
        className
      )}
    >
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <span
              className={cn(
                'px-2 py-0.5 rounded-md text-xs font-black uppercase font-mono border',
                isCompleted
                  ? 'bg-emerald-950 text-emerald-300 border-emerald-500/50'
                  : 'bg-cyan-950 text-cyan-300 border-cyan-500/50'
              )}
            >
              {isCompleted ? 'CHECKPOINT PASSED' : 'CHECKPOINT ACTIVE'}
            </span>
            <h4 className="text-sm font-bold text-slate-100">{title}</h4>
          </div>
          <p className="text-xs font-mono text-cyan-400 font-bold">
            解冻资金: ￥{amount}
          </p>
        </div>

        {isCompleted ? (
          <div className="inline-flex items-center gap-1.5 text-xs font-bold text-emerald-400 bg-emerald-950/50 px-3 py-1.5 rounded-xl border border-emerald-800/40">
            <CheckCircle2 className="w-4 h-4" /> 已解冻入账
          </div>
        ) : (
          <motion.button
            whileHover={{ scale: 1.03 }}
            whileTap={{ scale: 0.97 }}
            onClick={() => onConfirm(checkpointId)}
            className="px-4 py-2 rounded-xl text-xs font-extrabold bg-gradient-to-r from-emerald-500 to-teal-600 text-slate-950 shadow-lg shadow-emerald-500/20 hover:brightness-110 flex items-center gap-1.5"
          >
            <Unlock className="w-3.5 h-3.5" /> 主动结印解冻
          </motion.button>
        )}
      </div>

      {!isCompleted && status === 'submitted' && (
        <div className="mt-4 pt-3 border-t border-slate-800/80 space-y-1.5">
          <div className="flex items-center justify-between text-xs font-mono text-slate-400">
            <span className="flex items-center gap-1">
              <Clock className="w-3.5 h-3.5 text-cyan-400 animate-pulse" /> 24h 自动结算倒计时
            </span>
            <span className="font-bold text-cyan-300">
              {String(timeLeft.hours).padStart(2, '0')}:{String(timeLeft.minutes).padStart(2, '0')}:
              {String(timeLeft.seconds).padStart(2, '0')}
            </span>
          </div>

          <div className="h-1.5 w-full bg-slate-950 rounded-full overflow-hidden border border-slate-800">
            <motion.div
              className="h-full bg-gradient-to-r from-cyan-500 via-blue-500 to-emerald-400"
              style={{ width: `${progressPercent}%` }}
              transition={{ duration: 0.5 }}
            />
          </div>
        </div>
      )}
    </div>
  );
};
