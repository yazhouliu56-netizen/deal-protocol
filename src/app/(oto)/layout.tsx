import type { Metadata, Viewport } from "next";
import { Nunito, Geist_Mono } from "next/font/google";
import PwaServiceWorker from "@/components/oto-ui/PwaServiceWorker";
import OnlineStatusBridge from "@/components/oto-ui/OnlineStatusBridge";
import IdentityRehydrator from "@/components/oto-ui/IdentityRehydrator";
import A2HSPromptHost from "@/components/oto-ui/A2HSPromptHost";
import "./globals.css";

/* Duo 圆体：Feather Bold 官方平替（拉丁+数字圆润粗体，中文回退系统粗黑，next/font 自托管离线可用） */
const duoRounded = Nunito({
  variable: "--font-duo-rounded",
  subsets: ["latin"],
  weight: ["700", "800", "900"],
  display: "swap",
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

/**
 * (oto) 路由组嵌套 Layout（D-09/D-10 裁决）：
 * - 根 layout 继续承载全局 Theme/Session/Provider（src/app/layout.tsx 不动）；
 * - 本层仅承载 oto 局部容器：Duo 圆体变量、PwaServiceWorker，
 *   并挂 .oto-app 作用域类（隔离 CSS 变量与 body 级样式，见 globals.css）。
 *   ToastHost 已上移根 layout 全局唯一挂载（P9-1 单轨，此处不再重复）。
 */
export const metadata: Metadata = {
  title: "Spatial OTO Platform",
  description:
    "VisionOS 空间级 1:1 高保真全感知空间 - OTO 全感官 3D/AR 网页空间",
  manifest: "/manifest.webmanifest",
  appleWebApp: {
    capable: true,
    title: "Spatial OTO Platform",
    statusBarStyle: "default",
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
    <div className={`oto-app ${duoRounded.variable} ${geistMono.variable} h-full`}>
      {children}
      {/* W6 总装：全局弱网离线指示器（navigator.onLine 桥，断网琥珀条 / 恢复绿 Toast） */}
      <OnlineStatusBridge />
      {/* D-20260825-01 根治：身份 persist 挂载后重水合闸门（首帧与 SSR 同构防 #418） */}
      <IdentityRehydrator />
      <PwaServiceWorker />
      {/* P2 总装：A2HS 价值时刻安装引导（首次结算 / 服务者上岗，7 天静默防骚扰） */}
      <A2HSPromptHost />
    </div>
  );
}