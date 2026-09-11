import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Deal-Protocol 智能协议托管平台",
    short_name: "DealProtocol",
    start_url: "/",
    display: "standalone",
    description: "AI 驱动的全品类服务交易平台 — 需求匹配、智能协议、交易保障",
    background_color: "#f7f7f7",
    theme_color: "#58cc02",
    icons: [
      {
        src: "/icon-192.png",
        sizes: "192x192",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/icon-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/icon-maskable-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
  };
}
