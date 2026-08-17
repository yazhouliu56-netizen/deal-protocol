'use client';

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ArrowRight } from 'lucide-react';
import { CyberOracleDialog } from '@/components/ui/cyber-oracle-dialog';

interface GuildRegistrationModalProps {
  onComplete: () => void;
}

export const GuildRegistrationModal: React.FC<GuildRegistrationModalProps> = ({ onComplete }) => {
  const [mounted, setMounted] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  const [name, setName] = useState('Cyber_Hunter_01');
  const [quiz, setQuiz] = useState('code');

  useEffect(() => {
    const init = async () => {
      await Promise.resolve();
      setMounted(true);
      const registered = localStorage.getItem('deal_guild_registered');
      if (!registered) {
        setIsOpen(true);
      }
    };
    init();
  }, []);

  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [isOpen]);

  const handleRegister = () => {
    localStorage.setItem('deal_guild_registered', 'true');
    setIsOpen(false);
    onComplete();
  };

  if (!mounted) return null;

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-xl">
          <motion.div
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="relative w-full max-w-md overflow-hidden rounded-3xl border border-cyan-500/40 bg-slate-950 p-6 shadow-2xl space-y-5"
          >
            <CyberOracleDialog
              state="excited"
              speakerName="赛博精灵"
              message="哈罗！新来的冒险者！欢迎来到 deal-protocol 赛博公会，先录入你的代号领取新手御守吧！"
            />

            <div className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-300 mb-1">冒险者代号</label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full px-4 py-2.5 rounded-xl bg-slate-900 border border-slate-800 text-xs text-cyan-300 font-mono focus:outline-none focus:border-cyan-400"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-300 mb-1">灵能扫描 · 选择本命流派</label>
                <div className="grid grid-cols-3 gap-2">
                  {[
                    { id: 'code', label: '代码禁咒' },
                    { id: 'art', label: '魔法绘图' },
                    { id: 'law', label: '契约仲裁' },
                  ].map((item) => (
                    <button
                      key={item.id}
                      onClick={() => setQuiz(item.id)}
                      className={`py-2 rounded-xl text-xs font-bold border transition ${
                        quiz === item.id
                          ? 'border-cyan-400 bg-cyan-950/50 text-cyan-300'
                          : 'border-slate-800 bg-slate-900 text-slate-400'
                      }`}
                    >
                      {item.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <motion.button
              whileHover={{ scale: 1.03 }}
              whileTap={{ scale: 0.97 }}
              onClick={handleRegister}
              className="w-full py-3.5 rounded-xl font-extrabold text-sm bg-gradient-to-r from-cyan-500 via-blue-600 to-purple-600 text-white shadow-lg shadow-cyan-500/25 flex items-center justify-center gap-1.5"
            >
              完成注册 · 抽取 15 元新手御守 <ArrowRight className="w-4 h-4" />
            </motion.button>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
};
