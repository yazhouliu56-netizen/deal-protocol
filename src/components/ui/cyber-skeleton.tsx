import React from 'react';
import { cn } from '@/lib/utils';

export const DemandCardSkeleton: React.FC<{ className?: string }> = ({ className }) => (
  <div className={cn('rounded-2xl border border-slate-800 bg-slate-900/40 p-5 space-y-4 animate-pulse', className)}>
    <div className="flex justify-between items-center">
      <div className="w-16 h-5 rounded-full bg-slate-800" />
      <div className="w-20 h-5 rounded-md bg-slate-800" />
    </div>
    <div className="h-6 w-3/4 rounded-md bg-slate-800" />
    <div className="h-4 w-full rounded-md bg-slate-800/60" />
    <div className="pt-3 border-t border-slate-800/80 flex justify-between">
      <div className="w-24 h-4 rounded-md bg-slate-800" />
      <div className="w-16 h-4 rounded-md bg-slate-800" />
    </div>
  </div>
);

export const EscrowStatsSkeleton: React.FC<{ className?: string }> = ({ className }) => (
  <div className={cn('rounded-2xl border border-slate-800 bg-slate-900/40 p-6 space-y-5 animate-pulse', className)}>
    <div className="flex items-center gap-3">
      <div className="w-12 h-12 rounded-xl bg-slate-800" />
      <div className="space-y-2 flex-1">
        <div className="h-5 w-1/2 rounded-md bg-slate-800" />
        <div className="h-3 w-1/3 rounded-md bg-slate-800/60" />
      </div>
    </div>
    <div className="grid grid-cols-2 gap-4">
      <div className="space-y-2">
        <div className="h-3 w-16 rounded-md bg-slate-800" />
        <div className="h-8 w-24 rounded-md bg-slate-800" />
      </div>
      <div className="space-y-2">
        <div className="h-3 w-16 rounded-md bg-slate-800" />
        <div className="h-8 w-24 rounded-md bg-slate-800" />
      </div>
    </div>
  </div>
);

export const VerdictCardSkeleton: React.FC<{ className?: string }> = ({ className }) => (
  <div className={cn('rounded-2xl border border-slate-800 bg-slate-900/40 p-6 space-y-4 animate-pulse', className)}>
    <div className="flex items-center gap-3">
      <div className="w-10 h-10 rounded-full bg-slate-800" />
      <div className="space-y-1.5 flex-1">
        <div className="h-4 w-1/3 rounded-md bg-slate-800" />
        <div className="h-3 w-1/4 rounded-md bg-slate-800/60" />
      </div>
    </div>
    <div className="space-y-2">
      <div className="h-3 w-full rounded-md bg-slate-800/60" />
      <div className="h-3 w-5/6 rounded-md bg-slate-800/60" />
      <div className="h-3 w-2/3 rounded-md bg-slate-800/60" />
    </div>
    <div className="flex justify-between pt-2 border-t border-slate-800/60">
      <div className="h-8 w-24 rounded-lg bg-slate-800" />
      <div className="h-8 w-24 rounded-lg bg-slate-800" />
    </div>
  </div>
);

export const InventoryItemSkeleton: React.FC<{ className?: string }> = ({ className }) => (
  <div className={cn('rounded-2xl border border-slate-800 bg-slate-900/40 p-4 space-y-3 animate-pulse', className)}>
    <div className="flex justify-end">
      <div className="w-8 h-5 rounded-md bg-slate-800" />
    </div>
    <div className="flex flex-col items-center space-y-2">
      <div className="w-10 h-10 rounded-xl bg-slate-800" />
      <div className="h-3 w-3/4 rounded-md bg-slate-800" />
    </div>
  </div>
);
