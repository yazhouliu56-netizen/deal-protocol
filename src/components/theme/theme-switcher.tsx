'use client';

import React from 'react';
import { useTheme, ThemeMode } from './theme-provider';
import { Palette, Sparkles, ShieldAlert, Laptop, type LucideIcon } from 'lucide-react';
import { motion } from 'framer-motion';

const themes: { id: ThemeMode; name: string; icon: LucideIcon; badgeBg: string }[] = [
  { id: 'cyber-pop', name: '赛博霓虹 (Cyber)', icon: Sparkles, badgeBg: 'from-purple-500 to-pink-500' },
  { id: 'soft-astral', name: '星空工坊 (Astral)', icon: Palette, badgeBg: 'from-blue-400 to-indigo-500' },
  { id: 'tactical-hud', name: '战术终端 (HUD)', icon: ShieldAlert, badgeBg: 'from-emerald-500 to-amber-500' },
  { id: 'pro-minimal', name: '极简干练 (Pro)', icon: Laptop, badgeBg: 'from-slate-500 to-slate-700' },
];

export const ThemeSwitcher: React.FC = () => {
  const { theme, setTheme } = useTheme();

  return (
    <div className="inline-flex items-center gap-1.5 p-1 rounded-2xl bg-slate-900/80 border border-slate-800 backdrop-blur-md">
      {themes.map((item) => {
        const Icon = item.icon;
        const isActive = theme === item.id;
        return (
          <button
            key={item.id}
            onClick={() => setTheme(item.id)}
            className={`relative flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold transition-all duration-200 ${
              isActive ? 'text-white' : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            {isActive && (
              <motion.div
                layoutId="activeThemeGlow"
                className={`absolute inset-0 rounded-xl bg-gradient-to-r ${item.badgeBg} opacity-90 shadow-lg`}
                transition={{ type: 'spring', stiffness: 350, damping: 30 }}
              />
            )}
            <span className="relative z-10 flex items-center gap-1.5">
              <Icon className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">{item.name}</span>
            </span>
          </button>
        );
      })}
    </div>
  );
};
