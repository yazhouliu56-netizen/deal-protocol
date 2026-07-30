import type { Metadata } from "next";
import SessionProvider from "@/components/SessionProvider";
import Script from "next/script";
import Header from "@/components/Header";
import { UXProvider } from "@/components/providers/UXProvider";
import { ThemeProvider } from "@/components/theme/theme-provider";
import "./globals.css";

const SITE_URL =
  process.env.NEXT_PUBLIC_SITE_URL || "https://deal-protocol-phi.vercel.app";

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: "Deal Protocol — 异世界智能契约与可信魔晶托管平台",
    template: "%s | Deal Protocol",
  },
  description:
    "基于AI魔法阵自动解析奇遇契约，一键向全网冒险者公会广播发布异世界悬赏，魔晶锁定即时履约。异世界智能契约与可信魔晶托管协议架构。",
  keywords: [
    "异世界悬赏",
    "冒险者公会",
    "魔晶托管",
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
    title: "Deal Protocol — 异世界智能契约与可信魔晶托管平台",
    description:
      "基于AI魔法阵自动解析奇遇契约，一键向全网冒险者公会广播发布异世界悬赏，魔晶锁定即时履约。",
    url: SITE_URL,
    locale: "zh_CN",
    images: [
      {
        url: "/opengraph-image",
        width: 1200,
        height: 630,
        alt: "Deal Protocol — 异世界智能契约与可信魔晶托管平台",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "Deal Protocol — 异世界智能契约与可信魔晶托管平台",
    description:
      "基于AI魔法阵自动解析奇遇契约，一键向全网冒险者公会广播发布异世界悬赏，魔晶锁定即时履约。",
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
      <body className="min-h-full flex flex-col antialiased">
        <SessionProvider>
          <UXProvider>
            <ThemeProvider>
              <Header />
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
