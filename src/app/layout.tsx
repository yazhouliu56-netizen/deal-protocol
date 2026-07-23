import type { Metadata } from "next";
import SessionProvider from "@/components/SessionProvider";
import Script from "next/script";
import Header from "@/components/Header";
import { UXProvider } from "@/components/providers/UXProvider";
import "./globals.css";

const SITE_URL =
  process.env.NEXT_PUBLIC_SITE_URL || "https://deal-protocol-phi.vercel.app";

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: "Deal Protocol — 去中心化服务交易与资金托管平台",
    template: "%s | Deal Protocol",
  },
  description:
    "AI 驱动的全品类服务交易平台，自然语言需求与链上协议匹配引擎，合约体系保障交易安全。家政维修、按摩推拿，一站式解决。",
  keywords: [
    "服务交易",
    "资金托管",
    "担保交易",
    "O2O 平台",
    "上门服务",
    "智能匹配",
    "协议模板",
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
    title: "Deal Protocol — 去中心化服务交易与资金托管平台",
    description:
      "AI 驱动的全品类服务交易平台，自然语言需求与链上协议匹配引擎，合约体系保障交易安全。",
    url: SITE_URL,
    locale: "zh_CN",
    images: [
      {
        url: "/opengraph-image",
        width: 1200,
        height: 630,
        alt: "Deal Protocol — 去中心化服务交易与资金托管平台",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "Deal Protocol — 去中心化服务交易与资金托管平台",
    description:
      "AI 驱动的全品类服务交易平台，自然语言需求与链上协议匹配引擎，合约体系保障交易安全。",
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
      <body className="min-h-full flex flex-col bg-slate-50 text-slate-900 dark:bg-zinc-950 dark:text-zinc-100">
        <SessionProvider>
          <UXProvider>
            <Header />
            <main className="flex-1">{children}</main>
          </UXProvider>
          <Script id="register-sw" strategy="afterInteractive">
            {`if ('serviceWorker' in navigator) { navigator.serviceWorker.register('/sw.js', { scope: '/' }); }`}
          </Script>
        </SessionProvider>
      </body>
    </html>
  );
}
