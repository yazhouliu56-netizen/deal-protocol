import Header from "@/components/Header";

/**
 * /dp 协议专区布局（C16 隔离后 + 根布局净化）：
 * - 根布局已彻底移除 Header，确保 / 纯净 OTO 空间视口零污染
 * - 本层专属挂载 Header，仅包裹 /dp 及其子路由（/dp/login、/dp/console、/dp/provider/* 等）
 * - Header 内部仍保留 /admin、/console、/dp/console、/dp/provider 等隐藏判定，全屏控制台保持沉浸式零干扰
 */
export default function DpLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <Header />
      {children}
    </>
  );
}
