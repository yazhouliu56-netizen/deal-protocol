import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import PwaServiceWorker from "@/components/oto-ui/PwaServiceWorker";
import ToastHost from "@/components/oto-ui/ToastHost";
import OnlineStatusBridge from "@/components/oto-ui/OnlineStatusBridge";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

/**
 * (oto) 路由组嵌套 Layout（D-09/D-10 裁决）：
 * - 根 layout 继续承载全局 Theme/Session/Provider（src/app/layout.tsx 不动）；
 * - 本层仅承载 oto 局部容器：Geist 字体变量、ToastHost、PwaServiceWorker，
 *   并挂 .oto-app 作用域类（隔离 CSS 变量与 body 级样式，见 globals.css）。
 */
export const metadata: Metadata = {
  title: "Spatial OTO Platform",
  description:
    "VisionOS 空间级 1:1 高保真全感知空间 - OTO 全感官 3D/AR 网页空间",
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    title: "Spatial OTO Platform",
    statusBarStyle: "black-translucent",
  },
  icons: {
    icon: [
      { url: "/oto-icon-192.png", sizes: "192x192", type: "image/png" },
      { url: "/oto-icon-512.png", sizes: "512x512", type: "image/png" },
    ],
    apple: [{ url: "/oto-icon-192.png", sizes: "192x192", type: "image/png" }],
  },
  formatDetection: {
    telephone: false,
  },
  other: {
    "apple-mobile-web-app-capable": "yes",
  },
};

export const viewport: Viewport = {
  themeColor: "#07080D",
};

export default function OtoLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <div className={`oto-app ${geistSans.variable} ${geistMono.variable} h-full`}>
      {children}
      {/* W6 总装：全局弱网离线指示器（navigator.onLine 桥，断网琥珀条 / 恢复绿 Toast） */}
      <OnlineStatusBridge />
      <ToastHost />
      <PwaServiceWorker />
    </div>
  );
}