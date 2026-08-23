import type { MetadataRoute } from "next"

const BASE_URL =
  process.env.NEXT_PUBLIC_SITE_URL || "https://deal-protocol-phi.vercel.app"

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        // Step 1-D 出清批次：allow/disallow 中已删除的旧宇宙页面路径同步移除
        allow: [
          "/",
          "/landing",
          "/rights",
        ],
        disallow: [
          "/api/",
          "/admin/",
          "/register",
          "/login",
          "/profile",
          "/verification",
          "/console",
          "/_next/",
          "/offline",
        ],
      },
    ],
    sitemap: `${BASE_URL}/sitemap.xml`,
  }
}
