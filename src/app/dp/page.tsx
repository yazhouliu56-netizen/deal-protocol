"use client"

import React from "react"
import Link from "next/link"
import { motion } from "framer-motion"
import DuoButton from "@/components/ui/DuoButton"
import { Button } from "@/components/ui/button"
import { Scroll, Sparkles, Cpu, Zap, Lock, Info } from "lucide-react"

/** Batch3：锁死浅色 Feather 单一设计系统 —— 背景光晕与徽章不再跟随主题切换。 */
const BG_GLOW = "from-cyan-500/10 to-purple-500/10"
const ACCENT_BADGE = "bg-cyan-50 border-cyan-200 text-cyan-700"

export default function HomePage() {
  return (
    <div className="min-h-screen font-sans relative overflow-hidden flex flex-col justify-between bg-background text-foreground">
      {/* 背景柔光与网格线 */}
      <div className={`absolute top-0 right-1/4 w-[500px] h-[500px] bg-gradient-to-br ${BG_GLOW} rounded-full blur-[120px] pointer-events-none`} />
      <div className={`absolute top-1/3 left-10 w-[500px] h-[500px] bg-gradient-to-br ${BG_GLOW} rounded-full blur-[120px] pointer-events-none`} />
      <div className="absolute inset-0 bg-[size:4rem_4rem] [mask-image:radial-gradient(ellipse_60%_50%_at_50%_0%,#000_70%,transparent_100%)] opacity-25 pointer-events-none"
        style={{
          backgroundImage: `linear-gradient(to right, hsl(var(--border)) 1px, transparent 1px), linear-gradient(to bottom, hsl(var(--border)) 1px, transparent 1px)`,
        }} />

      {/* 顶部 Header Navigation */}
      <header className="relative z-20 border-b border-border bg-background/80 backdrop-blur-xl sticky top-0 px-4 sm:px-8 py-3.5 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-cyan-500 to-purple-600 p-0.5 flex items-center justify-center shadow-lg shadow-cyan-500/20">
            <div className="w-full h-full rounded-[10px] bg-background text-cyan-600 flex items-center justify-center">
              <Scroll className="w-5 h-5" />
            </div>
          </div>
          <span className="font-black text-base sm:text-lg tracking-tight text-foreground font-mono">
            deal-protocol <span className="text-xs font-normal ml-1 text-cyan-600">| 同城服务网络</span>
          </span>
        </div>

        {/* 导航菜单 */}
        <div className="flex items-center gap-4 sm:gap-6">
          <nav className="hidden md:flex items-center gap-5 text-xs font-bold text-muted-foreground">
            <Link href="/dp" className="text-cyan-600 transition">首页</Link>
            <Link href="/dp/provider/incoming" className="hover:text-cyan-600 transition">需求大厅</Link>
            {/* 我的协议：需求方订单列表页缺失（P1 缺口挂账），暂由 redirect 兜底进接单池。 */}
            <Link href="/dp/console" className="hover:text-cyan-600 transition">我的协议</Link>
            <Link href="/profile" className="hover:text-cyan-600 transition">个人中心</Link>
          </nav>
        </div>
      </header>

      {/* 主体 Hero 展示区 */}
      <main className="relative z-10 max-w-6xl mx-auto px-4 sm:px-8 py-12 sm:py-20 space-y-16">

        {/* Banner 与主标语 */}
        <div className="text-center space-y-6 max-w-3xl mx-auto">
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            className={`inline-flex items-center gap-2 px-3.5 py-1 rounded-full text-xs font-black border ${ACCENT_BADGE} shadow-sm`}
          >
            <Sparkles className="w-3.5 h-3.5 animate-pulse" />
            GUILD BOUNTY ECOSYSTEM v3.0
          </motion.div>

          <motion.h1
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.3 }}
            className="text-3xl sm:text-5xl md:text-6xl font-black text-transparent bg-clip-text bg-gradient-to-r from-slate-900 via-slate-800 to-cyan-600 tracking-tight leading-tight"
          >
            发布服务委托 <br className="hidden sm:inline" /> 召集认证工程师
          </motion.h1>

          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.2 }}
            className="text-xs sm:text-sm text-muted-foreground leading-relaxed font-sans max-w-2xl mx-auto"
          >
            基于 AI 智能解析服务需求，一键向认证工程师网络广播，资金托管，即时履约。
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
              <DuoButton variant="primary" size="lg" className="w-full sm:w-auto">
                <Sparkles className="w-4 h-4" /> 发布服务委托
              </DuoButton>
            </Link>

            {/* 供给侧 CTA：真实接单池，一步到位。 */}
            <Link href="/dp/provider/incoming" className="w-full sm:w-auto">
              <Button variant="outline" size="lg" className="w-full sm:w-auto px-8">
                浏览工程师大厅
              </Button>
            </Link>
          </motion.div>
        </div>

        {/* Batch1：CyberOracleDialog 已降解删除 → 中性公告卡（文案原样，Batch2 收敛） */}
        <div className="max-w-2xl mx-auto rounded-xl border border-input bg-card text-card-foreground p-4 flex items-start gap-3">
          <div className="w-9 h-9 shrink-0 rounded-lg bg-muted flex items-center justify-center text-muted-foreground">
            <Info className="w-5 h-5" />
          </div>
          <div className="text-left">
            <p className="text-xs font-bold">平台助手 <span className="font-mono font-normal text-muted-foreground">在线</span></p>
            <p className="text-xs text-muted-foreground mt-1 leading-relaxed">服务委托通道已全量打通！AI 解析已就绪，随时为您匹配工程师并托管资金！</p>
          </div>
        </div>

        {/* 三大核心魔法引擎卡片 */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 pt-4">
          <motion.div
            whileHover={{ y: -6, scale: 1.02 }}
            className="rounded-3xl border border-border bg-card p-6 hover:shadow-lg transition-all space-y-3"
          >
            <div className="w-12 h-12 rounded-2xl bg-purple-100 border border-purple-200 flex items-center justify-center text-purple-600">
              <Cpu className="w-6 h-6" />
            </div>
            <h3 className="text-base font-bold text-foreground">智能需求解析</h3>
            <p className="text-xs text-muted-foreground leading-relaxed">
              AI 自动提取自然语言要求，生成结构化服务条款与阶段资金分配方案，无缝契合 Zod 防御网关。
            </p>
          </motion.div>

          <motion.div
            whileHover={{ y: -6, scale: 1.02 }}
            className="rounded-3xl border border-border bg-card p-6 hover:shadow-lg transition-all space-y-3"
          >
            <div className="w-12 h-12 rounded-2xl bg-cyan-100 border border-cyan-200 flex items-center justify-center text-cyan-600">
              <Zap className="w-6 h-6" />
            </div>
            <h3 className="text-base font-bold text-foreground">认证工程师即时响应</h3>
            <p className="text-xs text-muted-foreground leading-relaxed">
              基于 pgvector 向量检索与多臂老虎机 (Bandit) 算法，毫秒级即时匹配高分认证工程师。
            </p>
          </motion.div>

          <motion.div
            whileHover={{ y: -6, scale: 1.02 }}
            className="rounded-3xl border border-border bg-card p-6 hover:shadow-lg transition-all space-y-3"
          >
            <div className="w-12 h-12 rounded-2xl bg-amber-100 border border-amber-200 flex items-center justify-center text-amber-600">
              <Lock className="w-6 h-6" />
            </div>
            <h3 className="text-base font-bold text-foreground">资金托管结算</h3>
            <p className="text-xs text-muted-foreground leading-relaxed">
              资金全程平台托管，结合 24h 自动解冻与判例仲裁，保障双端利益。
            </p>
          </motion.div>
        </div>
      </main>

      {/* Footer 底部对齐 */}
      <footer className="relative z-20 border-t border-border bg-background py-6 px-4 text-center text-xs font-mono text-muted-foreground">
        <p>同城服务委托与资金托管平台 © 2026 deal-protocol</p>
      </footer>
    </div>
  )
}
