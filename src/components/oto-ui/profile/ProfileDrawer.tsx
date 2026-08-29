"use client";
import { useEffect, type ReactNode } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { lockEdgeGesture } from "@/components/oto-ui/edgeGestureLock";

/**
 * 个人中心 3 大抽屉式二级菜单的通用毛玻璃容器（VisionOS 质感与 AuthSheet 同源）：
 * 半屏底部滑出 + 背景虚化遮罩 + 顶部把手/标题/关闭 + 边缘滑动手势锁定。
 * 信息架构：18 层大平铺收敛为「主屏 4 卡 + 抽屉收纳」，功能零丢失。
 */
export default function ProfileDrawer({
  open,
  onClose,
  title,
  subtitle,
  icon,
  testId,
  children,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  subtitle: string;
  icon: string;
  testId: string;
  children: ReactNode;
}) {
  useEffect(() => {
    lockEdgeGesture(open);
  }, [open]);

  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.22 }}
            onClick={onClose}
            className="fixed inset-0 z-[60] bg-black/55 backdrop-blur-sm"
            data-testid={`${testId}-backdrop`}
          />
          <motion.div
            initial={{ y: "100%" }}
            animate={{ y: 0 }}
            exit={{ y: "100%" }}
            transition={{ type: "spring", stiffness: 320, damping: 32 }}
            className="fixed inset-x-0 bottom-0 z-[70] max-h-[86dvh] rounded-t-[28px] bg-white border-t-2 border-[#e5e5e5] shadow-2xl overflow-hidden flex flex-col"
            data-testid={testId}
            role="dialog"
            aria-label={title}
          >
            {/* 把手 */}
            <div className="flex justify-center pt-2.5 pb-1 shrink-0">
              <div className="w-10 h-1 rounded-full bg-[#e5e5e5]" />
            </div>
            {/* 标题行 */}
            <div className="flex items-center gap-2.5 px-4 pt-1 pb-3 shrink-0 border-b-2 border-[#f7f7f7]">
              <span className="w-9 h-9 rounded-xl bg-[#f7f7f7] border-2 border-[#e5e5e5] flex items-center justify-center text-base shrink-0">
                {icon}
              </span>
              <div className="flex-1 min-w-0">
                <h3 className="text-[13px] font-extrabold text-[#4b4b4b]">{title}</h3>
                <p className="text-xs text-[#777777] truncate">{subtitle}</p>
              </div>
              <button
                onClick={onClose}
                aria-label={`关闭${title}`}
                className="w-10 h-10 min-h-10 rounded-full bg-[#f7f7f7] border-2 border-[#e5e5e5] flex items-center justify-center text-[#4b4b4b] hover:border-[#58cc02]/30 active:scale-95 transition-[color,transform] shrink-0"
              >
                ✕
              </button>
            </div>
            {/* 内容滚动区 */}
            <div className="flex-1 min-h-0 overflow-y-auto no-scrollbar px-4 pb-8 space-y-4">
              {children}
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}