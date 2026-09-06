import type { Metadata, Viewport } from "next";
import SessionProvider from "@/components/SessionProvider";
import Script from "next/script";
import { UXProvider } from "@/components/providers/UXProvider";
import { ThemeProvider } from "@/components/theme/theme-provider";
import "./globals.css";

const SITE_URL =
  process.env.NEXT_PUBLIC_SITE_URL || "https://deal-protocol-phi.vercel.app";

/**
 * PWA Native-Like 严格视口（白皮书 §九 Design QA 验收项 V-1）：
 * - viewport-fit=cover：刘海屏内容铺满真实视口（配合 env(safe-area-inset-*)）；
 * - 锁定缩放（userScalable=false + maximumScale=1）：消除双击缩放（配合
 *   touch-action: manipulation 触控类）与桌面端手动缩放的布局漂移。
 */
export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: "cover",
};

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: "Deal Protocol — 同城服务委托与资金托管平台",
    template: "%s | Deal Protocol",
  },
  description:
    "基于AI智能解析服务需求，一键向认证工程师网络广播发布服务委托，资金托管即时履约。同城服务委托与资金托管平台。",
  keywords: [
    "服务委托",
    "认证工程师",
    "资金托管",
    "智能契约",
    "资金托管",
    "担保交易",
    "智能匹配",
    "Deal Protocol",
  ],
  manifest: "/manifest.webmanifest",
  appleWebApp: {
    capable: true,
    title: "DealProtocol",
    statusBarStyle: "black-translucent",
  },
  formatDetection: {
    telephone: false,
  },
  openGraph: {
    type: "website",
    siteName: "Deal Protocol",
    title: "Deal Protocol — 同城服务委托与资金托管平台",
    description:
      "基于AI智能解析服务需求，一键向认证工程师网络广播发布服务委托，资金托管即时履约。",
    url: SITE_URL,
    locale: "zh_CN",
    images: [
      {
        url: "/opengraph-image",
        width: 1200,
        height: 630,
        alt: "Deal Protocol — 同城服务委托与资金托管平台",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "Deal Protocol — 同城服务委托与资金托管平台",
    description:
      "基于AI智能解析服务需求，一键向认证工程师网络广播发布服务委托，资金托管即时履约。",
    images: ["/opengraph-image"],
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="zh" className="h-full antialiased">
      <body
        className="min-h-full flex flex-col antialiased"
        style={{ WebkitTapHighlightColor: "transparent" }}
      >
        <SessionProvider>
          <UXProvider>
            <ThemeProvider>
              <main className="flex-1">{children}</main>
            </ThemeProvider>
          </UXProvider>
          <Script id="register-sw" strategy="afterInteractive">
            {`if ('serviceWorker' in navigator) { navigator.serviceWorker.register('/sw.js', { scope: '/' }); }`}
          </Script>
        </SessionProvider>
      </body>
    </html>
  );
}
