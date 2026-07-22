"use client";

import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";

interface GrabConsoleProps {
  demandId: string;
  initialTimeLeft: number;
  initialCompetitors: any[];
  onGrabSuccess: () => void;
  onGrabFailure: (reason: string) => void;
  verificationStatus?: string;
}

export default function GrabConsole({
  demandId,
  initialTimeLeft,
  initialCompetitors,
  onGrabSuccess,
  onGrabFailure,
  verificationStatus,
}: GrabConsoleProps) {
  const [status, setStatus] = useState<"idle" | "grabbing" | "success" | "failed">("idle");
  const [timeLeft, setTimeLeft] = useState(initialTimeLeft);

  useEffect(() => {
    if (timeLeft <= 0 || status === "success" || status === "failed") return;
    const timer = setInterval(() => setTimeLeft((prev) => prev - 1), 1000);
    return () => clearInterval(timer);
  }, [timeLeft, status]);

  const [showVerifyBanner, setShowVerifyBanner] = useState(false);

  const handleGrabClick = async () => {
    if (status === "grabbing" || status === "success") return;

    if (verificationStatus && verificationStatus !== "approved") {
      setShowVerifyBanner(true);
      return;
    }

    setStatus("grabbing");

    try {
      const res = await fetch(`/api/demands/${demandId}/assign`, { method: "POST" });
      const data = await res.json();

      if (res.ok) {
        setStatus("success");
        setTimeout(() => {
          onGrabSuccess();
        }, 1200);
      } else {
        setStatus("failed");
        onGrabFailure(data.reason || "手慢了，订单已被其他师傅接到");
      }
    } catch (error) {
      setStatus("failed");
      onGrabFailure("网络异常，请稍后重试");
    }
  };

  const cardAnimationVariants = {
    idle: { scale: 1 },
    grabbing: { scale: 0.98, opacity: 0.95 },
    success: { 
      scale: 1.03,
      boxShadow: "0px 25px 50px -12px rgba(34, 197, 94, 0.4)",
      transition: { type: "spring", stiffness: 300, damping: 15 }
    },
    failed: {
      x: [0, -12, 12, -12, 12, -6, 6, 0],
      opacity: 0.65,
      transition: { 
        x: { duration: 0.45, ease: "easeInOut" },
        opacity: { duration: 0.3 }
      }
    }
  } as any;

  return (
    <motion.div
      variants={cardAnimationVariants}
      animate={status}
      className={`relative max-w-md w-full mx-auto bg-white dark:bg-zinc-900 border border-gray-100 dark:border-zinc-800 rounded-3xl p-6 shadow-xl overflow-hidden transition-shadow duration-300 ${
        status === "failed" ? "grayscale brightness-75" : ""
      }`}
    >
      <AnimatePresence>
        {status === "success" && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 bg-emerald-500 z-50 flex flex-col items-center justify-center text-white p-6"
          >
            <motion.div
              initial={{ scale: 0, rotate: -60 }}
              animate={{ scale: 1, rotate: 0 }}
              transition={{ type: "spring", stiffness: 260, damping: 20, delay: 0.1 }}
              className="bg-white/20 p-4 rounded-full mb-4"
            >
              <svg className="w-16 h-16 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
              </svg>
            </motion.div>
            <motion.h3 
              initial={{ y: 15, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ delay: 0.2 }}
              className="text-2xl font-bold"
            >
              抢单成功！
            </motion.h3>
            <motion.p 
              initial={{ y: 15, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ delay: 0.3 }}
              className="text-emerald-100 text-sm mt-1"
            >
              正在为您锁定订单，请稍候...
            </motion.p>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {showVerifyBanner && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="rounded-xl border border-red-500/20 bg-red-500/10 p-4 text-center"
          >
            <p className="text-sm font-semibold text-red-400">抢单失败：请先完成实名身份验证！</p>
              <a
              href="/verification"
              className="mt-2 inline-flex items-center gap-1 text-xs font-medium text-red-300 underline underline-offset-2 hover:text-red-200"
            >
              前往认证 →
            </a>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="flex flex-col items-center text-center space-y-6">
        <h2 className="text-lg font-semibold text-gray-800 dark:text-zinc-200">紧急竞抢控制台</h2>

        <div className="relative w-32 h-32 flex items-center justify-center">
          <span className={`text-2xl font-mono font-bold ${status === 'failed' ? 'text-gray-400' : 'text-orange-500'}`}>
            {timeLeft > 0 ? `${Math.floor(timeLeft / 60)}:${String(timeLeft % 60).padStart(2, '0')}` : "0:00"}
          </span>
        </div>

        <div className="text-xs text-gray-400">
          已有 {initialCompetitors.length} 位师傅在周围伺机而动
        </div>

        <button
          onClick={handleGrabClick}
          disabled={status !== "idle"}
          className={`w-full py-4 rounded-xl font-bold text-white shadow-lg transition-all active:scale-95 duration-150
            ${status === "idle" ? "bg-gradient-to-r from-orange-500 to-red-500 hover:brightness-110 shadow-orange-500/20" : ""}
            ${status === "grabbing" ? "bg-gray-400 cursor-wait" : ""}
            ${status === "failed" ? "bg-zinc-700 cursor-not-allowed shadow-none" : ""}
          `}
        >
          {status === "idle" && "🚀 立即抢单"}
          {status === "grabbing" && "正在向云端派单..."}
          {status === "failed" && "抢单已结束"}
        </button>
      </div>
    </motion.div>
  );
}
