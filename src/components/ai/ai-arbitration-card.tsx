'use client';

import React from 'react';
import { motion } from 'framer-motion';
import { Scale, AlertTriangle } from 'lucide-react';
import { CyberOracleDialog } from '@/components/ui/cyber-oracle-dialog';

interface AiArbitrationCardProps {
  confidenceScore: number;
  winner?: 'demander' | 'provider' | 'split';
  reasoning?: string;
  requiresHumanReview?: boolean;
  perspectives?: {
    contractRatio: number;
    commonSenseRatio: number;
    rightsRatio: number;
  };
}

export const AiArbitrationCard: React.FC<AiArbitrationCardProps> = ({
  confidenceScore,
  reasoning = '根据判例库 Top 3 相似证据链匹配，建议按 7:3 进行托管资金分段清算。',
  requiresHumanReview = false,
  perspectives = { contractRatio: 45, commonSenseRatio: 35, rightsRatio: 20 },
}) => {
  const isLowConfidence = confidenceScore < 0.85 || requiresHumanReview;

  return (
    <div className="rounded-3xl border border-slate-800 bg-slate-900/60 p-6 backdrop-blur-xl space-y-5">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="p-2 rounded-xl bg-purple-950/80 border border-purple-500/40 text-purple-300">
            <Scale className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-base font-bold text-slate-100">判例 RAG 多视角 AI 赛博裁决</h3>
            <p className="text-xs text-slate-400">结合契约条款、行业常理与权益保护原则落锤</p>
          </div>
        </div>

        <div className="text-right">
          <span className="text-[10px] font-mono text-slate-400">AI 置信度 (Confidence)</span>
          <div className={`text-lg font-black font-mono ${isLowConfidence ? 'text-amber-400' : 'text-cyan-400'}`}>
            {Math.round(confidenceScore * 100)}%
          </div>
        </div>
      </div>

      {isLowConfidence && (
        <div className="p-3.5 rounded-2xl bg-amber-950/50 border border-amber-500/40 text-amber-300 text-xs flex items-center gap-2.5">
          <AlertTriangle className="w-4 h-4 shrink-0 text-amber-400" />
          <div>
            <span className="font-bold">自动降级生效：</span> 置信度低于 85% 门槛，已平滑转交至公会长老/陪审团复核。
          </div>
        </div>
      )}

      <div className="space-y-2 pt-1">
        <div className="flex justify-between text-xs font-mono text-slate-300 font-semibold">
          <span>三视角比重分析</span>
          <span className="text-slate-500">契约 {perspectives.contractRatio}% / 常理 {perspectives.commonSenseRatio}% / 权益 {perspectives.rightsRatio}%</span>
        </div>

        <div className="h-3 w-full rounded-full bg-slate-950 overflow-hidden flex p-0.5 border border-slate-800">
          <motion.div
            initial={{ width: 0 }}
            animate={{ width: `${perspectives.contractRatio}%` }}
            className="h-full bg-cyan-400 rounded-l-full"
            title="契约派"
          />
          <motion.div
            initial={{ width: 0 }}
            animate={{ width: `${perspectives.commonSenseRatio}%` }}
            className="h-full bg-purple-500"
            title="常理派"
          />
          <motion.div
            initial={{ width: 0 }}
            animate={{ width: `${perspectives.rightsRatio}%` }}
            className="h-full bg-amber-400 rounded-r-full"
            title="权益派"
          />
        </div>
      </div>

      <CyberOracleDialog
        state={isLowConfidence ? 'fallback' : 'judge'}
        speakerName="Cyber-Judge"
        message={reasoning}
        confidenceScore={confidenceScore}
      />
    </div>
  );
};
