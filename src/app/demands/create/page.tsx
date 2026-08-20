'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import { ShieldCheck, Scroll, Zap, Cpu, Sparkles, CheckCircle2, AlertTriangle, type LucideIcon } from 'lucide-react';
import { createDemandSchema } from '@/lib/validations/api-schemas';
import { ThemeSwitcher } from '@/components/theme/theme-switcher';
import { CyberOracleDialog, OracleState } from '@/components/ui/cyber-oracle-dialog';

interface ModChipItem {
  id: string;
  name: string;
  desc: string;
  priceRatio: number;
  icon: LucideIcon;
}

const AVAILABLE_MOD_CHIPS: ModChipItem[] = [
  { id: 'chip-rush', name: '加急传送阵 (Speed Rush)', desc: '自动提升 20% 悬赏金优先广播至全网高分服务者', priceRatio: 0.2, icon: Zap },
  { id: 'chip-ai-radar', name: '赛博雷达 (AI Radar Sentinel)', desc: '开启 AI 履约进度打卡监控与异常风险预警', priceRatio: 0.05, icon: Cpu },
  { id: 'chip-extra-revisions', name: '无限重构包 (Infinite Revisions)', desc: '附带 3 次免费协议版本迭代与免费仲裁保障', priceRatio: 0.1, icon: Sparkles },
];

interface FormFields {
  title: string;
  category: string;
  budget: number;
  description: string;
}

export default function CreateDemandBountyPage() {
  const router = useRouter();
  const [formData, setFormData] = useState<FormFields>({
    title: '',
    category: 'tech',
    budget: 500,
    description: '',
  });

  const [selectedChips, setSelectedChips] = useState<string[]>(['chip-ai-radar']);
  const [oracleState, setOracleState] = useState<OracleState>('excited');
  const [oracleMsg, setOracleMsg] = useState('主人，填入悬赏令信息后，本姬将自动调用 DeepSeek 预估交期与违约风控！');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [showSeal, setShowSeal] = useState(false);

  const baseBudget = Number(formData.budget) || 0;
  const chipBonusRatio = selectedChips.reduce((acc, chipId) => {
    const found = AVAILABLE_MOD_CHIPS.find((c) => c.id === chipId);
    return acc + (found?.priceRatio || 0);
  }, 0);
  const finalBudget = Math.round(baseBudget * (1 + chipBonusRatio));

  const toggleChip = (chipId: string) => {
    if (selectedChips.includes(chipId)) {
      setSelectedChips(selectedChips.filter((id) => id !== chipId));
    } else {
      setSelectedChips([...selectedChips, chipId]);
    }
  };

  const handleInputChange = (field: keyof FormFields, value: string | number) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
    setFormError(null);

    if (field === 'title' && String(value).length > 5) {
      setOracleState('thinking');
      setOracleMsg(`已感知到主题「${value}」，正为您分析契约合规度...`);
    } else if (field === 'budget' && Number(value) > 2000) {
      setOracleState('excited');
      setOracleMsg(`高额悬赏金！已自动为您匹配专属 A 级精英公会专家库。`);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    const validation = createDemandSchema.safeParse({
      title: formData.title,
      category: formData.category,
      budget: finalBudget,
    });

    if (!validation.success) {
      const firstError = validation.error.errors[0]?.message || '表单参数不符合要求';
      setFormError(firstError);
      setOracleState('fallback');
      setOracleMsg(`检测到填报瑕疵：${firstError}，请修改后重新盖章！`);
      return;
    }

    setIsSubmitting(true);
    setOracleState('thinking');
    setOracleMsg('正在向 Supabase 灵魂金库广播悬赏令并生成链上存证...');

    try {
      const res = await fetch('/api/demands', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...validation.data,
          description: formData.description,
        }),
      });

      if (!res.ok) {
        const errJson: { error?: string } = await res.json().catch(() => ({}));
        throw new Error(errJson.error || '发布悬赏令失败');
      }

      const result: { id?: string } = await res.json();
      setShowSeal(true);
      setOracleState('excited');
      setOracleMsg('悬赏令发布成功！印章已落锁，正在跳转至公会雷达大屏...');

      setTimeout(() => {
        router.push(`/demands/${result.id || ''}`);
      }, 1800);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : '网络请求异常';
      setFormError(message);
      setOracleState('fallback');
      setOracleMsg(`公会广播失败：${message}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 p-4 sm:p-8 font-sans relative overflow-hidden">
      {/* 赛博网格背景线 */}
      <div className="absolute inset-0 bg-[linear-gradient(to_right,#1e293b_1px,transparent_1px),linear-gradient(to_bottom,#1e293b_1px,transparent_1px)] bg-[size:4rem_4rem] [mask-image:radial-gradient(ellipse_60%_50%_at_50%_0%,#000_70%,transparent_100%)] opacity-30 pointer-events-none" />

      <div className="max-w-4xl mx-auto relative z-10 space-y-6">
        {/* Header 区 */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pb-4 border-b border-slate-800/80">
          <div>
            <div className="flex items-center gap-2 text-cyan-400 text-xs font-mono font-bold tracking-widest uppercase">
              <Scroll className="w-4 h-4" /> Guild Bounty Board v2.5
            </div>
            <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-white mt-1">
              发布二次元赛博悬赏令
            </h1>
          </div>
          <ThemeSwitcher />
        </div>

        {/* AI 姬填表指导 */}
        <CyberOracleDialog
          state={oracleState}
          message={oracleMsg}
          confidenceScore={0.96}
        />

        {/* 悬赏令主单卡片 */}
        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="rounded-3xl border border-slate-800 bg-slate-900/60 p-6 backdrop-blur-xl space-y-5 shadow-2xl relative">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-bold text-slate-100 flex items-center gap-2">
                <ShieldCheck className="w-5 h-5 text-cyan-400" /> 主线契约参数 (Main Quest)
              </h3>
              <span className="text-xs text-slate-400 font-mono">01 / BASE_CONTRACT</span>
            </div>

            {/* 标题 */}
            <div>
              <label className="block text-xs font-bold text-slate-300 mb-1.5">
                悬赏任务名称 <span className="text-rose-400">*</span>
              </label>
              <input
                type="text"
                placeholder="例如：【二次元画师悬赏】赛博朋克风 CyberOracleDialog 角色设计"
                value={formData.title}
                onChange={(e) => handleInputChange('title', e.target.value)}
                className="w-full px-4 py-2.5 rounded-xl bg-slate-950/80 border border-slate-800 text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:border-cyan-400 transition"
              />
            </div>

            {/* 分类 & 预算 */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-slate-300 mb-1.5">
                  公会任务类型
                </label>
                <select
                  value={formData.category}
                  onChange={(e) => handleInputChange('category', e.target.value)}
                  className="w-full px-4 py-2.5 rounded-xl bg-slate-950/80 border border-slate-800 text-sm text-slate-100 focus:outline-none focus:border-cyan-400 transition"
                >
                  <option value="tech">软件代码 / 智能契约</option>
                  <option value="design">赛博美术 / ACGN 视觉设计</option>
                  <option value="content">文案创作 / 游戏世界观设定</option>
                  <option value="audit">安全审计 / 判例复核</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-300 mb-1.5">
                  基础悬赏金 (Soul Balance)
                </label>
                <div className="relative">
                  <input
                    type="number"
                    min={100}
                    value={formData.budget}
                    onChange={(e) => handleInputChange('budget', Number(e.target.value))}
                    className="w-full pl-4 pr-12 py-2.5 rounded-xl bg-slate-950/80 border border-slate-800 text-sm font-mono text-cyan-300 focus:outline-none focus:border-cyan-400 transition"
                  />
                  <span className="absolute right-4 top-2.5 text-xs font-bold text-slate-400">元</span>
                </div>
              </div>
            </div>

            {/* 描述 */}
            <div>
              <label className="block text-xs font-bold text-slate-300 mb-1.5">
                履约契约细则 (Markdown / 文本)
              </label>
              <textarea
                rows={3}
                placeholder="请输入详细的任务验收标准、交付时间点及质保期要求..."
                value={formData.description}
                onChange={(e) => handleInputChange('description', e.target.value)}
                className="w-full px-4 py-2.5 rounded-xl bg-slate-950/80 border border-slate-800 text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:border-cyan-400 transition"
              />
            </div>
          </div>

          {/* DLC Mod 插件芯片 Slot 槽 */}
          <div className="rounded-3xl border border-slate-800 bg-slate-900/60 p-6 backdrop-blur-xl space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-base font-bold text-slate-100 flex items-center gap-2">
                  <Cpu className="w-5 h-5 text-purple-400" /> 附加 Mod 插件芯片槽 (Mod Chips Slot)
                </h3>
                <p className="text-xs text-slate-400 mt-0.5">选择插槽芯片可增强公会悬赏广播权重与 AI 监督保障</p>
              </div>
              <span className="text-xs text-slate-400 font-mono">02 / DLC_SLOTS</span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {AVAILABLE_MOD_CHIPS.map((chip) => {
                const Icon = chip.icon;
                const isSelected = selectedChips.includes(chip.id);
                return (
                  <div
                    key={chip.id}
                    onClick={() => toggleChip(chip.id)}
                    className={`cursor-pointer rounded-2xl border p-4 transition-all duration-200 select-none ${
                      isSelected
                        ? 'border-purple-400 bg-purple-950/40 shadow-[0_0_15px_rgba(168,85,247,0.25)]'
                        : 'border-slate-800 bg-slate-950/60 hover:border-slate-700'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-2">
                      <Icon className={`w-4 h-4 ${isSelected ? 'text-purple-300' : 'text-slate-500'}`} />
                      <span className="text-xs font-mono text-purple-400">+{chip.priceRatio * 100}%</span>
                    </div>
                    <h4 className="text-xs font-bold text-slate-200">{chip.name}</h4>
                    <p className="text-xs text-slate-400 mt-1 leading-normal">{chip.desc}</p>
                  </div>
                );
              })}
            </div>
          </div>

          {/* 错误提示 */}
          {formError && (
            <div className="p-3 rounded-xl bg-rose-950/60 border border-rose-800/80 text-rose-300 text-xs flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 shrink-0" />
              <span>{formError}</span>
            </div>
          )}

          {/* 底部结算与盖章按钮 */}
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4 p-5 rounded-2xl bg-slate-900/80 border border-slate-800">
            <div>
              <span className="text-xs text-slate-400">最终预估托管资金:</span>
              <div className="text-2xl font-black font-mono text-cyan-400">
                ￥{finalBudget} <span className="text-xs text-slate-500 font-sans font-normal">(含 Mod 芯片)</span>
              </div>
            </div>

            <motion.button
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              disabled={isSubmitting}
              type="submit"
              className="w-full sm:w-auto px-8 py-3.5 rounded-xl font-bold text-sm bg-gradient-to-r from-cyan-500 via-blue-600 to-purple-600 text-white shadow-lg shadow-cyan-500/25 hover:shadow-cyan-500/40 disabled:opacity-50 transition-all flex items-center justify-center gap-2"
            >
              <CheckCircle2 className="w-4 h-4" />
              {isSubmitting ? '向链上公会广播中...' : '落锁印章 · 发布悬赏令'}
            </motion.button>
          </div>
        </form>

        {/* 成功落章印章动效遮罩 */}
        <AnimatePresence>
          {showSeal && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md"
            >
              <motion.div
                initial={{ scale: 2, rotate: -20, opacity: 0 }}
                animate={{ scale: 1, rotate: 0, opacity: 1 }}
                transition={{ type: 'spring', damping: 12, stiffness: 200 }}
                className="p-8 rounded-3xl border-2 border-amber-400 bg-slate-950 text-center shadow-[0_0_50px_rgba(251,191,36,0.5)]"
              >
                <div className="w-20 h-20 mx-auto rounded-full bg-amber-400/20 border-2 border-amber-400 flex items-center justify-center text-amber-300 font-black text-2xl mb-4">
                  SEALED
                </div>
                <h3 className="text-xl font-black text-amber-300">公会悬赏令已落印生效</h3>
                <p className="text-xs text-slate-400 mt-2">已成功注入资金托管状态机，正在跳转悬赏大屏...</p>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
