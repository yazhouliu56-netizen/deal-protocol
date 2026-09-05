"use client"

import React from "react"
import Link from "next/link"
import { motion } from "framer-motion"
import { ThemeSwitcher } from "@/components/theme/theme-switcher"
import { useTheme, type ThemeMode } from "@/components/theme/theme-provider"
import { CyberOracleDialog } from "@/components/ui/cyber-oracle-dialog"
import { Scroll, Sparkles, Cpu, Zap, Lock } from "lucide-react"

const themeStyles: Record<ThemeMode, { bgGlow: string; accentBadge: string }> = {
  'cyber-pop': {
    bgGlow: 'from-cyan-500/10 to-purple-500/10',
    accentBadge: 'bg-cyan-950/80 border-cyan-500/40 text-cyan-300',
  },
  'soft-astral': {
    bgGlow: 'from-purple-600/20 to-indigo-600/20',
    accentBadge: 'bg-purple-950/80 border-purple-400/40 text-purple-300',
  },
  'tactical-hud': {
    bgGlow: 'from-emerald-500/20 to-teal-600/20',
    accentBadge: 'bg-emerald-950/80 border-emerald-400/40 text-emerald-300',
  },
  'pro-minimal': {
    bgGlow: 'from-blue-500/10 to-slate-500/10',
    accentBadge: 'bg-slate-900/80 border-slate-600/40 text-slate-300',
  },
}

export default function HomePage() {
  const { theme } = useTheme()
  const styles = themeStyles[theme]

  return (
    <div className="min-h-screen font-sans relative overflow-hidden flex flex-col justify-between"
      style={{ backgroundColor: 'var(--bg-primary)', color: 'var(--text-main)' }}>
      {/* 背景赛博发光粒子与网格线 */}
      <div className={`absolute top-0 right-1/4 w-[500px] h-[500px] bg-gradient-to-br ${styles.bgGlow} rounded-full blur-[120px] pointer-events-none`} />
      <div className={`absolute top-1/3 left-10 w-[500px] h-[500px] bg-gradient-to-br ${styles.bgGlow} rounded-full blur-[120px] pointer-events-none`} />
      <div className="absolute inset-0 bg-[size:4rem_4rem] [mask-image:radial-gradient(ellipse_60%_50%_at_50%_0%,#000_70%,transparent_100%)] opacity-25 pointer-events-none"
        style={{
          backgroundImage: `linear-gradient(to right, var(--border-theme) 1px, transparent 1px), linear-gradient(to bottom, var(--border-theme) 1px, transparent 1px)`,
        }} />

      {/* 顶部 Header Navigation */}
      <header className="relative z-20 border-b backdrop-blur-xl sticky top-0 px-4 sm:px-8 py-3.5 flex items-center justify-between"
        style={{ backgroundColor: 'var(--bg-primary)', borderColor: 'var(--border-theme)' }}>
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-cyan-500 to-purple-600 p-0.5 flex items-center justify-center shadow-lg shadow-cyan-500/20">
            <div className="w-full h-full rounded-[10px] flex items-center justify-center"
              style={{ backgroundColor: 'var(--bg-primary)', color: 'var(--accent-color)' }}>
              <Scroll className="w-5 h-5" />
            </div>
          </div>
          <span className="font-black text-base sm:text-lg tracking-tight text-white font-mono">
            deal-protocol <span className="text-xs font-normal ml-1" style={{ color: 'var(--accent-color)' }}>| 异世界冒险者公会</span>
          </span>
        </div>

        {/* 导航菜单与主题切换器 */}
        <div className="flex items-center gap-4 sm:gap-6">
          <nav className="hidden md:flex items-center gap-5 text-xs font-bold text-slate-300">
            <Link href="/dp" style={{ color: 'var(--accent-color)' }} className="transition">首页</Link>
            <Link href="/dp/provider/incoming" className="hover:text-cyan-300 transition">需求大厅</Link>
            {/* 我的协议：需求方订单列表页缺失（P1 缺口挂账），暂由 redirect 兜底进接单池。 */}
            <Link href="/dp/console" className="hover:text-cyan-300 transition">我的协议</Link>
            <Link href="/profile" className="hover:text-cyan-300 transition">个人中心</Link>
          </nav>
          <ThemeSwitcher />
        </div>
      </header>

      {/* 主体 Hero 展示区 */}
      <main className="relative z-10 max-w-6xl mx-auto px-4 sm:px-8 py-12 sm:py-20 space-y-16">

        {/* Banner 与主标语 */}
        <div className="text-center space-y-6 max-w-3xl mx-auto">
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            className={`inline-flex items-center gap-2 px-3.5 py-1 rounded-full text-xs font-black ${styles.accentBadge} shadow-[0_0_15px_var(--accent-glow)]`}
          >
            <Sparkles className="w-3.5 h-3.5 animate-pulse" />
            GUILD BOUNTY ECOSYSTEM v3.0
          </motion.div>

          <motion.h1
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.4 }}
            className="text-3xl sm:text-5xl md:text-6xl font-black text-transparent bg-clip-text bg-gradient-to-r from-white via-slate-100 to-cyan-300 tracking-tight leading-tight"
          >
            发布异世界悬赏 <br className="hidden sm:inline" /> 召集顶尖冒险者
          </motion.h1>

          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.2 }}
            className="text-xs sm:text-sm text-slate-300 leading-relaxed font-sans max-w-2xl mx-auto"
          >
            基于 AI 魔法阵自动解析奇遇契约，一键向全网冒险者公会广播，魔晶锁定，即时履约。
          </motion.p>

          {/* 核心行动按钮 */}
          <motion.div
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
            className="flex flex-col sm:flex-row items-center justify-center gap-3.5 pt-2"
          >
            {/* 需求侧 CTA：真实摄入端 /landing（/ 是 OTO 演示，不落库）。 */}
            <Link href="/landing" className="w-full sm:w-auto">
              <motion.button
                whileHover={{ scale: 1.04 }}
                whileTap={{ scale: 0.96 }}
                className="w-full px-8 py-3.5 rounded-2xl font-black text-sm bg-gradient-to-r from-cyan-500 via-blue-600 to-purple-600 text-white shadow-xl shadow-cyan-500/25 hover:shadow-cyan-500/40 transition-all flex items-center justify-center gap-2"
              >
                <Sparkles className="w-4 h-4" /> ✨ 开启奇遇，发布悬赏
              </motion.button>
            </Link>

            {/* 供给侧 CTA：真实接单池，一步到位。 */}
            <Link href="/dp/provider/incoming" className="w-full sm:w-auto">
              <motion.button
                whileHover={{ scale: 1.04 }}
                whileTap={{ scale: 0.96 }}
                className="w-full px-8 py-3.5 rounded-2xl font-black text-sm border transition-all flex items-center justify-center gap-2"
                style={{ backgroundColor: 'var(--bg-card)', borderColor: 'var(--border-theme)', color: 'var(--text-main)' }}
              >
                🗡️ 浏览冒险者大厅
              </motion.button>
            </Link>
          </motion.div>
        </div>

        {/* Galgame 赛博裁决姬 Live 引导 */}
        <CyberOracleDialog
          state="excited"
          speakerName="Cyber-Oracle姬"
          message="主人！异世界悬赏公会通道已全量打通！AI 魔法阵已就绪，随时为您解析契约并锁定魔晶！"
          confidenceScore={0.99}
          className="max-w-2xl mx-auto shadow-2xl"
        />

        {/* 三大核心魔法引擎卡片 */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 pt-4">
          <motion.div
            whileHover={{ y: -6, scale: 1.02 }}
            className="rounded-3xl border p-6 backdrop-blur-xl hover:shadow-[0_0_30px_var(--accent-glow)] transition-all space-y-3"
            style={{ backgroundColor: 'var(--bg-card)', borderColor: 'var(--border-theme)' }}
          >
            <div className="w-12 h-12 rounded-2xl bg-purple-950/80 border border-purple-500/40 flex items-center justify-center text-purple-300">
              <Cpu className="w-6 h-6" />
            </div>
            <h3 className="text-base font-bold">🔮 魔法阵契约构建</h3>
            <p className="text-xs text-slate-400 leading-relaxed">
              AI 自动提取自然语言要求，生成结构化悬赏条款与阶段魔晶分配方案，无缝契合 Zod 防御网关。
            </p>
          </motion.div>

          <motion.div
            whileHover={{ y: -6, scale: 1.02 }}
            className="rounded-3xl border p-6 backdrop-blur-xl hover:shadow-[0_0_30px_var(--accent-glow)] transition-all space-y-3"
            style={{ backgroundColor: 'var(--bg-card)', borderColor: 'var(--border-theme)' }}
          >
            <div className="w-12 h-12 rounded-2xl bg-cyan-950/80 border border-cyan-500/40 flex items-center justify-center text-cyan-300">
              <Zap className="w-6 h-6" />
            </div>
            <h3 className="text-base font-bold">⚡ 冒险者公会即时响应</h3>
            <p className="text-xs text-slate-400 leading-relaxed">
              基于 pgvector 向量检索与多臂老虎机 (Bandit) 算法，毫秒级即时匹配高分认证猎人。
            </p>
          </motion.div>

          <motion.div
            whileHover={{ y: -6, scale: 1.02 }}
            className="rounded-3xl border p-6 backdrop-blur-xl hover:shadow-[0_0_30px_var(--accent-glow)] transition-all space-y-3"
            style={{ backgroundColor: 'var(--bg-card)', borderColor: 'var(--border-theme)' }}
          >
            <div className="w-12 h-12 rounded-2xl bg-amber-950/80 border border-amber-500/40 flex items-center justify-center text-amber-300">
              <Lock className="w-6 h-6" />
            </div>
            <h3 className="text-base font-bold">🔒 魔晶契约托管</h3>
            <p className="text-xs text-slate-400 leading-relaxed">
              资金全程存入 7 态灵魂金库，结合 24h Checkpoint 自动解冻与判例 RAG 仲裁，保障双端绝对利益。
            </p>
          </motion.div>
        </div>
      </main>

      {/* Footer 底部对齐 */}
      <footer className="relative z-20 border-t py-6 px-4 text-center text-xs font-mono"
        style={{ backgroundColor: 'var(--bg-primary)', borderColor: 'var(--border-theme)', color: 'var(--text-main)' }}>
        <p style={{ opacity: 0.6 }}>异世界智能契约与可信魔晶托管协议架构 © 2026 deal-protocol</p>
      </footer>
    </div>
  )
}
