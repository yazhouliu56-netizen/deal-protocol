import type { Metadata } from "next";
import SessionProvider from "@/components/SessionProvider";
import Script from "next/script";
import Header from "@/components/Header";
import { UXProvider } from "@/components/providers/UXProvider";
import "./globals.css";

export const metadata: Metadata = {
  title: "deal-protocol | 链上协议实时交易平台",
  description:
    "AI 驱动的全品类服务交易平台，自然语言需求与链上协议匹配引擎，合约体系保障交易安全。家政维修、按摩推拿，一站式解决。",
  manifest: "/manifest.webmanifest",
  appleWebApp: {
    capable: true,
    title: "DealProtocol",
    statusBarStyle: "black-translucent",
  },
  formatDetection: {
    telephone: false,
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
